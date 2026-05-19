const pool = require("../db/pool");
const attendanceRepo = require("../repos/attendance.repo");
const staffRepo = require("../repos/staff.repo");
const auditLogRepo = require("../repos/audit-log.repo");
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
    attendance_date: payload.attendance_date,
    status: payload.status,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    hours_worked: calculateHoursWorked(checkInTime, checkOutTime),
    location: normalizeNullable(payload.location),
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

function assertApproverRole(user) {
  if (!user || !APPROVER_ROLES.has(user.role)) {
    const error = new Error("You are not allowed to approve attendance.");
    error.statusCode = 403;
    throw error;
  }
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
          attendance_id: attendance.id,
          staff_member_id: attendance.staff_member_id,
          attendance_date: attendance.attendance_date,
          status: attendance.status,
          staff_code: staffMember.staff_code
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
        approval_status: "submitted"
      });

      const staffMember = await assertActiveStaffMember(tenantId, normalized.staff_member_id, connection);
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
            attendance_id: attendance.id,
            staff_member_id: attendance.staff_member_id,
            attendance_date: attendance.attendance_date,
            status: attendance.status,
            staff_code: staffMember.staff_code
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
          status: updated.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return updated;
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
  rejectAttendance
};
