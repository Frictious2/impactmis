const pool = require("../db/pool");

async function findActiveByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM licenses
      WHERE tenant_id = ?
        AND status = 'active'
        AND NOW() BETWEEN starts_at AND expires_at
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    [tenantId]
  );

  return rows[0] || null;
}

async function findLatestByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM licenses
      WHERE tenant_id = ?
      ORDER BY starts_at DESC, id DESC
      LIMIT 1
    `,
    [tenantId]
  );

  return rows[0] || null;
}

async function findCurrentOrLatestByTenantId(tenantId, db = pool) {
  const activeLicense = await findActiveByTenantId(tenantId, db);

  if (activeLicense) {
    return activeLicense;
  }

  return findLatestByTenantId(tenantId, db);
}

async function findByIdForTenant(tenantId, licenseId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM licenses
      WHERE tenant_id = ?
        AND id = ?
      LIMIT 1
    `,
    [tenantId, licenseId]
  );

  return rows[0] || null;
}

async function listForDeveloper() {
  const [rows] = await pool.query(
    `
      SELECT
        l.*,
        t.name AS tenant_name,
        t.tenant_code,
        t.status AS tenant_status
      FROM licenses l
      INNER JOIN tenants t ON t.id = l.tenant_id
      ORDER BY l.starts_at DESC, l.id DESC
    `
  );

  return rows;
}

async function create(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO licenses (
        tenant_id,
        plan_name,
        duration_months,
        starts_at,
        expires_at,
        status,
        modules_json,
        seat_limit
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.tenant_id,
      payload.plan_name,
      payload.duration_months,
      payload.starts_at,
      payload.expires_at,
      payload.status,
      JSON.stringify(payload.modules_json),
      payload.seat_limit
    ]
  );

  const [rows] = await db.query("SELECT * FROM licenses WHERE id = ? LIMIT 1", [result.insertId]);
  return rows[0] || null;
}

async function reclassifyPreviousActiveLicenses(tenantId, startsAt, db = pool) {
  await db.query(
    `
      UPDATE licenses
      SET status = CASE
        WHEN expires_at < ? THEN 'expired'
        ELSE 'revoked'
      END,
      updated_at = NOW()
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [startsAt, tenantId]
  );
}

async function updateForTenant(tenantId, licenseId, payload, db = pool) {
  await db.query(
    `
      UPDATE licenses
      SET
        plan_name = ?,
        duration_months = ?,
        starts_at = ?,
        expires_at = ?,
        status = ?,
        modules_json = ?,
        seat_limit = ?,
        updated_at = NOW()
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.plan_name,
      payload.duration_months,
      payload.starts_at,
      payload.expires_at,
      payload.status,
      JSON.stringify(payload.modules_json),
      payload.seat_limit,
      tenantId,
      licenseId
    ]
  );

  return findByIdForTenant(tenantId, licenseId, db);
}

module.exports = {
  findActiveByTenantId,
  findLatestByTenantId,
  findCurrentOrLatestByTenantId,
  findByIdForTenant,
  listForDeveloper,
  create,
  reclassifyPreviousActiveLicenses,
  updateForTenant
};
