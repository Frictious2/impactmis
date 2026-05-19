const pool = require("../db/pool");

async function listStaff(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["sm.tenant_id = ?"];

  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      "(sm.staff_code LIKE ? OR sm.first_name LIKE ? OR sm.last_name LIKE ? OR COALESCE(sm.email, '') LIKE ?)"
    );
    params.push(term, term, term, term);
  }

  if (filters.department_id) {
    where.push("sm.department_id = ?");
    params.push(filters.department_id);
  }

  if (filters.employment_type) {
    where.push("sm.employment_type = ?");
    params.push(filters.employment_type);
  }

  if (filters.status) {
    where.push("sm.status = ?");
    params.push(filters.status);
  }

  const [rows] = await db.query(
    `
      SELECT
        sm.*,
        d.department_name,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS full_name
      FROM staff_members sm
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY sm.created_at DESC, sm.id DESC
    `,
    params
  );

  return rows;
}

async function findStaffById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        sm.*,
        d.department_name,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS full_name,
        creator.full_name AS created_by_name,
        updater.full_name AS updated_by_name
      FROM staff_members sm
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN users creator ON creator.id = sm.created_by
      LEFT JOIN users updater ON updater.id = sm.updated_by
      WHERE sm.tenant_id = ?
        AND sm.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function createStaff(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO staff_members (
        tenant_id,
        staff_code,
        first_name,
        middle_name,
        last_name,
        gender,
        date_of_birth,
        phone,
        email,
        address,
        department_id,
        position_title,
        employment_type,
        start_date,
        end_date,
        status,
        emergency_contact_name,
        emergency_contact_phone,
        notes,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.staff_code,
      payload.first_name,
      payload.middle_name,
      payload.last_name,
      payload.gender,
      payload.date_of_birth,
      payload.phone,
      payload.email,
      payload.address,
      payload.department_id,
      payload.position_title,
      payload.employment_type,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.emergency_contact_name,
      payload.emergency_contact_phone,
      payload.notes,
      userId || null,
      userId || null
    ]
  );

  return findStaffById(tenantId, result.insertId, db);
}

async function updateStaff(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE staff_members
      SET
        staff_code = ?,
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        gender = ?,
        date_of_birth = ?,
        phone = ?,
        email = ?,
        address = ?,
        department_id = ?,
        position_title = ?,
        employment_type = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        emergency_contact_name = ?,
        emergency_contact_phone = ?,
        notes = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.staff_code,
      payload.first_name,
      payload.middle_name,
      payload.last_name,
      payload.gender,
      payload.date_of_birth,
      payload.phone,
      payload.email,
      payload.address,
      payload.department_id,
      payload.position_title,
      payload.employment_type,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.emergency_contact_name,
      payload.emergency_contact_phone,
      payload.notes,
      userId || null,
      tenantId,
      id
    ]
  );

  return findStaffById(tenantId, id, db);
}

async function changeStaffStatus(tenantId, id, status, endDate, userId, db = pool) {
  await db.query(
    `
      UPDATE staff_members
      SET
        status = ?,
        end_date = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [status, endDate, userId || null, tenantId, id]
  );

  return findStaffById(tenantId, id, db);
}

async function generateStaffCode(tenantId, employmentType, db = pool) {
  const prefixMap = {
    staff: "STF",
    volunteer: "VOL",
    consultant: "CNS",
    intern: "INT"
  };
  const prefix = prefixMap[employmentType] || "STF";

  const [rows] = await db.query(
    `
      SELECT staff_code
      FROM staff_members
      WHERE tenant_id = ?
        AND employment_type = ?
        AND staff_code LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [tenantId, employmentType, `${prefix}-%`]
  );

  const lastCode = rows[0]?.staff_code || `${prefix}-0000`;
  const lastNumber = Number(String(lastCode).split("-")[1] || 0);
  return `${prefix}-${String(lastNumber + 1).padStart(4, "0")}`;
}

async function existsStaffCodeForTenant(tenantId, staffCode, excludeId = null, db = pool) {
  const params = [tenantId, staffCode];
  let sql = "SELECT id FROM staff_members WHERE tenant_id = ? AND staff_code = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function existsEmailForTenant(tenantId, email, excludeId = null, db = pool) {
  const params = [tenantId, email];
  let sql = "SELECT id FROM staff_members WHERE tenant_id = ? AND LOWER(email) = LOWER(?)";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function countActiveByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM staff_members
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [tenantId]
  );

  return row.total;
}

async function countActiveVolunteersByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM staff_members
      WHERE tenant_id = ?
        AND status = 'active'
        AND employment_type = 'volunteer'
    `,
    [tenantId]
  );

  return row.total;
}

module.exports = {
  listStaff,
  findStaffById,
  createStaff,
  updateStaff,
  changeStaffStatus,
  generateStaffCode,
  existsStaffCodeForTenant,
  existsEmailForTenant,
  countActiveByTenantId,
  countActiveVolunteersByTenantId
};
