const pool = require("../db/pool");

async function listAttendance(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?"];

  if (filters.date_from) {
    where.push("ar.attendance_date >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("ar.attendance_date <= ?");
    params.push(filters.date_to);
  }

  if (filters.staff_member_id) {
    where.push("ar.staff_member_id = ?");
    params.push(filters.staff_member_id);
  }

  if (filters.department_id) {
    where.push("sm.department_id = ?");
    params.push(filters.department_id);
  }

  if (filters.status) {
    where.push("ar.status = ?");
    params.push(filters.status);
  }

  if (filters.approval_status) {
    where.push("ar.approval_status = ?");
    params.push(filters.approval_status);
  }

  const [rows] = await db.query(
    `
      SELECT
        ar.*,
        sm.staff_code,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.department_id,
        d.department_name,
        ar.branch_id,
        b.name AS branch_name,
        entered_by_user.full_name AS entered_by_name,
        approved_by_user.full_name AS approved_by_name
      FROM attendance_records ar
      INNER JOIN staff_members sm
        ON sm.id = ar.staff_member_id
       AND sm.tenant_id = ar.tenant_id
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b
        ON b.id = ar.branch_id
       AND b.tenant_id = ar.tenant_id
      LEFT JOIN users entered_by_user ON entered_by_user.id = ar.entered_by
      LEFT JOIN users approved_by_user ON approved_by_user.id = ar.approved_by
      WHERE ${where.join(" AND ")}
      ORDER BY ar.attendance_date DESC, sm.staff_code ASC, ar.id DESC
    `,
    params
  );

  return rows;
}

async function findAttendanceById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        ar.*,
        sm.staff_code,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.position_title,
        sm.employment_type,
        sm.department_id,
        d.department_name,
        ar.branch_id,
        b.name AS branch_name,
        entered_by_user.full_name AS entered_by_name,
        approved_by_user.full_name AS approved_by_name
      FROM attendance_records ar
      INNER JOIN staff_members sm
        ON sm.id = ar.staff_member_id
       AND sm.tenant_id = ar.tenant_id
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b
        ON b.id = ar.branch_id
       AND b.tenant_id = ar.tenant_id
      LEFT JOIN users entered_by_user ON entered_by_user.id = ar.entered_by
      LEFT JOIN users approved_by_user ON approved_by_user.id = ar.approved_by
      WHERE ar.tenant_id = ?
        AND ar.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function findByStaffAndDate(tenantId, staffMemberId, attendanceDate, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM attendance_records
      WHERE tenant_id = ?
        AND staff_member_id = ?
        AND attendance_date = ?
      LIMIT 1
    `,
    [tenantId, staffMemberId, attendanceDate]
  );

  return rows[0] || null;
}

async function create(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO attendance_records (
        tenant_id,
        staff_member_id,
        branch_id,
        capture_method,
        attendance_date,
        status,
        check_in_time,
        check_out_time,
        hours_worked,
        location,
        latitude,
        longitude,
        distance_from_branch_meters,
        geofence_status,
        device_info,
        notes,
        entered_by,
        approved_by,
        approval_status,
        rejection_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.staff_member_id,
      payload.branch_id,
      payload.capture_method,
      payload.attendance_date,
      payload.status,
      payload.check_in_time,
      payload.check_out_time,
      payload.hours_worked,
      payload.location,
      payload.latitude,
      payload.longitude,
      payload.distance_from_branch_meters,
      payload.geofence_status,
      payload.device_info,
      payload.notes,
      userId || null,
      payload.approved_by || null,
      payload.approval_status,
      payload.rejection_reason
    ]
  );

  return findAttendanceById(tenantId, result.insertId, db);
}

async function update(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE attendance_records
      SET
        staff_member_id = ?,
        branch_id = ?,
        capture_method = ?,
        attendance_date = ?,
        status = ?,
        check_in_time = ?,
        check_out_time = ?,
        hours_worked = ?,
        location = ?,
        latitude = ?,
        longitude = ?,
        distance_from_branch_meters = ?,
        geofence_status = ?,
        device_info = ?,
        notes = ?,
        entered_by = COALESCE(entered_by, ?),
        approved_by = ?,
        approval_status = ?,
        rejection_reason = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.staff_member_id,
      payload.branch_id,
      payload.capture_method,
      payload.attendance_date,
      payload.status,
      payload.check_in_time,
      payload.check_out_time,
      payload.hours_worked,
      payload.location,
      payload.latitude,
      payload.longitude,
      payload.distance_from_branch_meters,
      payload.geofence_status,
      payload.device_info,
      payload.notes,
      userId || null,
      payload.approved_by || null,
      payload.approval_status,
      payload.rejection_reason,
      tenantId,
      id
    ]
  );

  return findAttendanceById(tenantId, id, db);
}

async function approveAttendance(tenantId, id, approverId, db = pool) {
  await db.query(
    `
      UPDATE attendance_records
      SET approval_status = 'approved',
          approved_by = ?,
          rejection_reason = NULL
      WHERE tenant_id = ?
        AND id = ?
    `,
    [approverId, tenantId, id]
  );

  return findAttendanceById(tenantId, id, db);
}

async function rejectAttendance(tenantId, id, approverId, reason, db = pool) {
  await db.query(
    `
      UPDATE attendance_records
      SET approval_status = 'rejected',
          approved_by = ?,
          rejection_reason = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [approverId, reason, tenantId, id]
  );

  return findAttendanceById(tenantId, id, db);
}

async function countTodayByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM attendance_records
      WHERE tenant_id = ?
        AND attendance_date = CURDATE()
    `,
    [tenantId]
  );

  return row.total;
}

async function countPendingApprovalsByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM attendance_records
      WHERE tenant_id = ?
        AND approval_status = 'submitted'
    `,
    [tenantId]
  );

  return row.total;
}

async function countTodaySelfCheckinsByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM attendance_records
      WHERE tenant_id = ?
        AND attendance_date = CURDATE()
        AND capture_method = 'self_check_in'
    `,
    [tenantId]
  );

  return row.total;
}

async function countOutsideGeofenceAttemptsByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM audit_logs
      WHERE tenant_id = ?
        AND action = 'attendance.geofence_failed'
    `,
    [tenantId]
  );

  return row.total;
}

module.exports = {
  listAttendance,
  findAttendanceById,
  findByStaffAndDate,
  create,
  update,
  approveAttendance,
  rejectAttendance,
  countTodayByTenantId,
  countPendingApprovalsByTenantId,
  countTodaySelfCheckinsByTenantId,
  countOutsideGeofenceAttemptsByTenantId
};
