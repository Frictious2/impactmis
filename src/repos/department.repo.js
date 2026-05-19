const pool = require("../db/pool");

async function listByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        d.*,
        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.department_id = d.id
            AND u.tenant_id = d.tenant_id
        ) AS user_count
      FROM departments d
      WHERE d.tenant_id = ?
      ORDER BY d.department_name ASC
    `,
    [tenantId]
  );

  return rows;
}

async function findByIdForTenant(id, tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM departments WHERE id = ? AND tenant_id = ? LIMIT 1",
    [id, tenantId]
  );

  return rows[0] || null;
}

async function existsByNameForTenant(departmentName, tenantId, excludeId = null, db = pool) {
  const params = [tenantId, departmentName];
  let sql = "SELECT id FROM departments WHERE tenant_id = ? AND department_name = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function create(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO departments (tenant_id, department_name, description, status)
      VALUES (?, ?, ?, ?)
    `,
    [payload.tenant_id, payload.department_name, payload.description, payload.status]
  );

  return findByIdForTenant(result.insertId, payload.tenant_id, db);
}

async function update(id, tenantId, payload, db = pool) {
  await db.query(
    `
      UPDATE departments
      SET department_name = ?, description = ?, status = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
    `,
    [payload.department_name, payload.description, payload.status, id, tenantId]
  );

  return findByIdForTenant(id, tenantId, db);
}

async function remove(id, tenantId, db = pool) {
  await db.query("UPDATE users SET department_id = NULL WHERE department_id = ? AND tenant_id = ?", [id, tenantId]);
  await db.query("DELETE FROM departments WHERE id = ? AND tenant_id = ?", [id, tenantId]);
}

async function countByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM departments WHERE tenant_id = ?",
    [tenantId]
  );

  return row.total;
}

module.exports = {
  listByTenantId,
  findByIdForTenant,
  existsByNameForTenant,
  create,
  update,
  remove,
  countByTenantId
};
