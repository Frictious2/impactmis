const pool = require("../db/pool");

async function findById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        u.*,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.status AS tenant_status,
        d.department_name
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function findByEmailCandidates(email) {
  const [rows] = await pool.query(
    `
      SELECT
        u.*,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.status AS tenant_status,
        d.department_name
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE LOWER(u.email) = LOWER(?)
      ORDER BY u.user_type = 'developer' DESC, u.created_at ASC
    `,
    [email]
  );

  return rows;
}

async function listAdminUsersByTenantId(tenantId) {
  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, role, status, must_change_password, last_login_at, created_at
      FROM users
      WHERE tenant_id = ?
        AND role = 'Tenant Admin'
      ORDER BY created_at DESC, id DESC
    `,
    [tenantId]
  );

  return rows;
}

async function existsByEmailForTenant(email, tenantId) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM users
      WHERE tenant_id = ?
        AND LOWER(email) = LOWER(?)
      LIMIT 1
    `,
    [tenantId, email]
  );

  return Boolean(rows[0]);
}

async function listByTenantId(tenantId) {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.user_type,
        u.must_change_password,
        u.last_login_at,
        u.created_at,
        d.department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.tenant_id = ?
      ORDER BY u.created_at DESC, u.id DESC
    `,
    [tenantId]
  );

  return rows;
}

async function create(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO users (
        tenant_id,
        full_name,
        email,
        password_hash,
        role,
        department_id,
        user_type,
        status,
        must_change_password,
        tenant_scope_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.tenant_id,
      payload.full_name,
      payload.email,
      payload.password_hash,
      payload.role,
      payload.department_id || null,
      payload.user_type,
      payload.status,
      payload.must_change_password,
      payload.tenant_scope_key
    ]
  );

  const [rows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [result.insertId]);
  return rows[0] || null;
}

async function countActiveByTenantId(tenantId) {
  const [[row]] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [tenantId]
  );

  return row.total;
}

async function updateLastLogin(id) {
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  findById,
  findByEmailCandidates,
  listAdminUsersByTenantId,
  listByTenantId,
  existsByEmailForTenant,
  create,
  countActiveByTenantId,
  updateLastLogin
};
