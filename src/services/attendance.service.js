const pool = require("../db/pool");
const attendanceRepo = require("../repos/attendance.repo");
const staffRepo = require("../repos/staff.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const branchRepo = require("../repos/branch.repo");
const geofenceService = require("./geofence.service");
const notificationService = require("./notification.service");
const { normalizeNullable } = require("../utils/tenant-form");

const APPROVER_ROLES = new Set([
  "Tenant Admin",
  "HR Manager",
  "Manager",
  "Project Manager",
  "Finance Manager"
]);

function calculateHoursWorked(checkInTime, checkOutTime) {
  if (!checkInTime || !checkOutTime) {
    return null;
  }

  const [inHour, inMinute] = String(checkInTime).split(":").map(Number);
  const [outHour, outMinute] = String(checkOutTime).split(":").map(Number);
  const startMinutes = inHour * 60 + inMinute;
  const endMinutes = outHour * 60 + outMinute;

  if (endMinutes < startMinutes) {
    return null;
  }

  return ((endMinutes - startMinutes) / 60).toFixed(2);
}

function normalizeAttendancePayload(payload) {
  const checkInTime = normalizeNullable(payload.check_in_time);
  const checkOutTime = normalizeNullable(payload.check_out_time);

  return {
    staff_member_id: Number(payload.staff_member_id),
    branch_id: payload.branch_id ? Number(payload.branch_id) : null,
    capture_method: payload.capture_method || "manual_entry",
    attendance_date: payload.attendance_date,
    status: payload.status,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    hours_worked: calculateHoursWorked(checkInTime, checkOutTime),
    location: normalizeNullable(payload.location),
    latitude:
      payload.latitude === null || payload.latitude === undefined || payload.latitude === ""
        ? null
        : Number(payload.latitude),
    longitude:
      payload.longitude === null || payload.longitude === undefined || payload.longitude === ""
        ? null
        : Number(payload.longitude),
    distance_from_branch_meters:
      payload.distance_from_branch_meters === null ||
      payload.distance_from_branch_meters === undefined ||
      payload.distance_from_branch_meters === ""
        ? null
        : Number(payload.distance_from_branch_meters),
    geofence_status: payload.geofence_status || "not_checked",
    device_info: normalizeNullable(payload.device_info),
    notes: normalizeNullable(payload.notes),
    approved_by: null,
    approval_status: payload.approval_status || "submitted",
    rejection_reason: normalizeNullable(payload.rejection_reason)
  };
}

async function assertActiveStaffMember(tenantId, staffMemberId, db = pool) {
  const staffMember = await staffRepo.findStaffById(tenantId, staffMemberId, db);
  if (!staffMember) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  if (staffMember.status !== "active") {
    const error = new Error("Only active staff or volunteers can be used for attendance.");
    error.statusCode = 422;
    throw error;
  }

  return staffMember;
}

async function resolveBranchForStaff(tenantId, staffMember, db = pool) {
  if (!staffMember.branch_id) {
    return null;
  }

  return branchRepo.findByIdForTenant(staffMember.branch_id, tenantId, db);
}

function assertApproverRole(user) {
  if (!user || !APPROVER_ROLES.has(user.role)) {
    const error = new Error("You are not allowed to approve attendance.");
    error.statusCode = 403;
    throw error;
  }
}

function buildAttendanceAuditMetadata(attendance, staffMember, extras = {}) {
  return {
    attendance_id: attendance.id,
    staff_member_id: attendance.staff_member_id,
    attendance_date: attendance.attendance_date,
    status: attendance.status,
    staff_code: staffMember.staff_code,
    branch_id: attendance.branch_id || staffMember.branch_id || null,
    geofence_status: attendance.geofence_status || "not_checked",
    ...extras
  };
}

async function listAttendance(tenantId, filters) {
  return attendanceRepo.listAttendance(tenantId, filters);
}

async function findAttendanceById(tenantId, id) {
  return attendanceRepo.findAttendanceById(tenantId, id);
}

async function createOrUpdateAttendance(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalized = normalizeAttendancePayload(payload);
    const staffMember = await assertActiveStaffMember(tenantId, normalized.staff_member_id, connection);
    const branch = await resolveBranchForStaff(tenantId, staffMember, connection);
    const targetId = payload.id ? Number(payload.id) : null;
    let targetRecord = null;

    if (targetId) {
      targetRecord = await attendanceRepo.findAttendanceById(tenantId, targetId, connection);
      if (!targetRecord) {
        const error = new Error("Attendance record not found.");
        error.statusCode = 404;
        throw error;
      }
    }

    normalized.branch_id = branch ? branch.id : null;
    normalized.capture_method = payload.capture_method || "manual_entry";
    normalized.geofence_status = payload.geofence_status || "not_checked";
    if (normalized.capture_method !== "self_check_in") {
      normalized.latitude = null;
      normalized.longitude = null;
      normalized.distance_from_branch_meters = null;
      normalized.device_info = null;
    }

    const existing = await attendanceRepo.findByStaffAndDate(
      tenantId,
      normalized.staff_member_id,
      normalized.attendance_date,
      connection
    );

    let attendance;
    let action;

    if (existing && (!targetId || existing.id === targetId)) {
      attendance = await attendanceRepo.update(
        tenantId,
        targetId || existing.id,
        {
          ...normalized,
          approval_status:
            payload.approval_status ||
            (targetRecord ? targetRecord.approval_status : existing.approval_status) ||
            "submitted",
          approved_by: (targetRecord ? targetRecord.approved_by : existing.approved_by) || null,
          rejection_reason: normalized.approval_status === "rejected" ? normalized.rejection_reason : null
        },
        userId,
        connection
      );
      action = "attendance.updated";
    } else if (existing && targetId && existing.id !== targetId) {
      const error = new Error("Attendance already exists for this staff member on the selected date.");
      error.statusCode = 422;
      throw error;
    } else if (targetId) {
      attendance = await attendanceRepo.update(
        tenantId,
        targetId,
        {
          ...normalized,
          approval_status: payload.approval_status || targetRecord.approval_status || "submitted",
          approved_by: targetRecord.approved_by || null,
          rejection_reason: normalized.approval_status === "rejected" ? normalized.rejection_reason : null
        },
        userId,
        connection
      );
      action = "attendance.updated";
    } else {
      attendance = await attendanceRepo.create(tenantId, normalized, userId, connection);
      action = "attendance.created";
    }

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action,
        entity_type: "attendance_record",
        entity_id: String(attendance.id),
        metadata_json: {
          ...buildAttendanceAuditMetadata(attendance, staffMember)
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    if (action === "attendance.created" && attendance.approval_status === "submitted") {
      notificationService.notifyRoles(tenantId, ["Tenant Admin", "HR Manager"], {
        title: "Attendance submitted",
        message: `Attendance for ${staffMember.staff_code} is waiting for approval.`,
        type: "info",
        category: "attendance",
        link_url: `/attendance/${attendance.id}`,
        created_by: userId
      });
    }
    return attendance;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function bulkCreateAttendance(tenantId, attendanceDate, entries, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const results = [];
    for (const entry of entries) {
      if (!entry.staff_member_id || !entry.status) {
        continue;
      }

      const normalized = normalizeAttendancePayload({
        ...entry,
        attendance_date: attendanceDate,
        approval_status: "submitted",
        capture_method: "bulk_entry",
        geofence_status: "not_checked"
      });

      const staffMember = await assertActiveStaffMember(tenantId, normalized.staff_member_id, connection);
      const branch = await resolveBranchForStaff(tenantId, staffMember, connection);
      normalized.branch_id = branch ? branch.id : null;
      normalized.latitude = null;
      normalized.longitude = null;
      normalized.distance_from_branch_meters = null;
      normalized.device_info = null;
      const existing = await attendanceRepo.findByStaffAndDate(
        tenantId,
        normalized.staff_member_id,
        normalized.attendance_date,
        connection
      );

      let attendance;
      let action;

      if (existing) {
        attendance = await attendanceRepo.update(
          tenantId,
          existing.id,
          {
            ...normalized,
            approval_status: existing.approval_status === "approved" ? "approved" : "submitted",
            approved_by: existing.approved_by || null,
            rejection_reason: null
          },
          userId,
          connection
        );
        action = "attendance.updated";
      } else {
        attendance = await attendanceRepo.create(tenantId, normalized, userId, connection);
        action = "attendance.created";
      }

      await auditLogRepo.create(
        {
          tenant_id: tenantId,
          user_id: userId,
          action,
          entity_type: "attendance_record",
          entity_id: String(attendance.id),
          metadata_json: {
            ...buildAttendanceAuditMetadata(attendance, staffMember)
          },
          ip_address: ipAddress
        },
        connection
      );

      results.push(attendance);
    }

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "attendance.bulk_created",
        entity_type: "attendance_record",
        entity_id: null,
        metadata_json: {
          attendance_date: attendanceDate,
          status: "submitted",
          total_entries: results.length
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    if (results.length) {
      notificationService.notifyRoles(tenantId, ["Tenant Admin", "HR Manager"], {
        title: "Bulk attendance submitted",
        message: `${results.length} attendance entries are waiting for approval.`,
        type: "info",
        category: "attendance",
        link_url: "/attendance",
        created_by: userId
      });
    }
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAttendanceStatus(tenantId, id, payload, userId, ipAddress) {
  return createOrUpdateAttendance(tenantId, { ...payload, id }, userId, ipAddress);
}

async function approveAttendance(tenantId, id, approver, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    assertApproverRole(approver);

    const attendance = await attendanceRepo.findAttendanceById(tenantId, id, connection);
    if (!attendance) {
      const error = new Error("Attendance record not found.");
      error.statusCode = 404;
      throw error;
    }

    const updated = await attendanceRepo.approveAttendance(tenantId, id, approver.id, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: approver.id,
        action: "attendance.approved",
        entity_type: "attendance_record",
        entity_id: String(updated.id),
        metadata_json: {
          attendance_id: updated.id,
          staff_member_id: updated.staff_member_id,
          attendance_date: updated.attendance_date,
          status: updated.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    notificationService.safeUserNotification(tenantId, attendance.entered_by, {
      title: "Attendance approved",
      message: "Your attendance entry was approved.",
      type: "success",
      category: "attendance",
      link_url: `/attendance/${updated.id}`,
      created_by: approver.id
    });
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectAttendance(tenantId, id, approver, reason, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    assertApproverRole(approver);

    const attendance = await attendanceRepo.findAttendanceById(tenantId, id, connection);
    if (!attendance) {
      const error = new Error("Attendance record not found.");
      error.statusCode = 404;
      throw error;
    }

    const updated = await attendanceRepo.rejectAttendance(
      tenantId,
      id,
      approver.id,
      reason,
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: approver.id,
        action: "attendance.rejected",
        entity_type: "attendance_record",
        entity_id: String(updated.id),
        metadata_json: {
          attendance_id: updated.id,
          staff_member_id: updated.staff_member_id,
          attendance_date: updated.attendance_date,
          status: updated.status,
          branch_id: updated.branch_id || null,
          geofence_status: updated.geofence_status || "not_checked"
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    notificationService.safeUserNotification(tenantId, attendance.entered_by, {
      title: "Attendance rejected",
      message: "Your attendance entry was rejected.",
      type: "danger",
      category: "attendance",
      link_url: `/attendance/${updated.id}`,
      created_by: approver.id
    });
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function selfCheckin(tenantId, user, payload, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const staffMember = await staffRepo.findActiveByEmailForTenant(
      tenantId,
      user.email,
      connection
    );

    if (!staffMember) {
      const error = new Error("No active staff or volunteer profile is linked to your account email.");
      error.statusCode = 422;
      throw error;
    }

    const branch = await resolveBranchForStaff(tenantId, staffMember, connection);
    if (!branch || branch.status !== "active") {
      const error = new Error("You do not have an active branch assigned for self check-in.");
      error.statusCode = 422;
      throw error;
    }

    const geofenceResult = geofenceService.isInsideGeofence(
      Number(branch.latitude),
      Number(branch.longitude),
      Number(branch.geofence_radius_meters),
      Number(payload.latitude),
      Number(payload.longitude)
    );

    const today = new Date();
    const attendanceDate = today.toISOString().slice(0, 10);
    const checkInTime = today.toTimeString().slice(0, 5);

    if (!geofenceResult.inside) {
      await auditLogRepo.create(
        {
          tenant_id: tenantId,
          user_id: user.id,
          action: "attendance.geofence_failed",
          entity_type: "attendance_record",
          entity_id: null,
          metadata_json: {
            branch_id: branch.id,
            staff_member_id: staffMember.id,
            distance: Number(geofenceResult.distance.toFixed(2)),
            geofence_status: "outside",
            attendance_date: attendanceDate,
            status: "present"
          },
          ip_address: ipAddress
        },
        connection
      );

      const error = new Error("You are outside your assigned branch attendance area.");
      error.statusCode = 422;
      throw error;
    }

    const normalized = normalizeAttendancePayload({
      staff_member_id: staffMember.id,
      branch_id: branch.id,
      capture_method: "self_check_in",
      attendance_date: attendanceDate,
      status: "present",
      check_in_time: checkInTime,
      check_out_time: null,
      location: payload.location,
      latitude: payload.latitude,
      longitude: payload.longitude,
      distance_from_branch_meters: Number(geofenceResult.distance.toFixed(2)),
      geofence_status: "inside",
      device_info: payload.device_info,
      notes: payload.notes || "",
      approval_status: "submitted"
    });

    const existing = await attendanceRepo.findByStaffAndDate(
      tenantId,
      staffMember.id,
      attendanceDate,
      connection
    );

    const attendance = existing
      ? await attendanceRepo.update(
          tenantId,
          existing.id,
          {
            ...normalized,
            approval_status: existing.approval_status === "approved" ? "approved" : "submitted",
            approved_by: existing.approved_by || null,
            rejection_reason: null
          },
          user.id,
          connection
        )
      : await attendanceRepo.create(tenantId, normalized, user.id, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: user.id,
        action: "attendance.self_checkin",
        entity_type: "attendance_record",
        entity_id: String(attendance.id),
        metadata_json: {
          ...buildAttendanceAuditMetadata(attendance, staffMember, {
            distance: normalized.distance_from_branch_meters
          })
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return attendance;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  APPROVER_ROLES,
  listAttendance,
  findAttendanceById,
  createOrUpdateAttendance,
  bulkCreateAttendance,
  updateAttendanceStatus,
  approveAttendance,
  rejectAttendance,
  selfCheckin
};
