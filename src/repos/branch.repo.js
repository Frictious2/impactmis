const pool = require("../db/pool");

async function listByTenantId(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["tenant_id = ?"];

  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push("(branch_code LIKE ? OR name LIKE ? OR district LIKE ?)");
    params.push(term, term, term);
  }

  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }

  const [rows] = await db.query(
    `
      SELECT *
      FROM branches
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
    `,
    params
  );

  return rows;
}

async function listActiveByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM branches
      WHERE tenant_id = ?
        AND status = 'active'
      ORDER BY name ASC
    `,
    [tenantId]
  );

  return rows;
}

async function findByIdForTenant(id, tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1",
    [id, tenantId]
  );

  return rows[0] || null;
}

async function existsByCodeForTenant(branchCode, tenantId, excludeId = null, db = pool) {
  const params = [tenantId, branchCode];
  let sql = "SELECT id FROM branches WHERE tenant_id = ? AND branch_code = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function create(payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO branches (
        tenant_id,
        branch_code,
        name,
        address,
        city,
        district,
        country,
        latitude,
        longitude,
        geofence_radius_meters,
        contact_name,
        contact_phone,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.tenant_id,
      payload.branch_code,
      payload.name,
      payload.address,
      payload.city,
      payload.district,
      payload.country,
      payload.latitude,
      payload.longitude,
      payload.geofence_radius_meters,
      payload.contact_name,
      payload.contact_phone,
      payload.status,
      userId || null,
      userId || null
    ]
  );

  return findByIdForTenant(result.insertId, payload.tenant_id, db);
}

async function update(id, tenantId, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE branches
      SET
        branch_code = ?,
        name = ?,
        address = ?,
        city = ?,
        district = ?,
        country = ?,
        latitude = ?,
        longitude = ?,
        geofence_radius_meters = ?,
        contact_name = ?,
        contact_phone = ?,
        status = ?,
        updated_by = ?
      WHERE id = ?
        AND tenant_id = ?
    `,
    [
      payload.branch_code,
      payload.name,
      payload.address,
      payload.city,
      payload.district,
      payload.country,
      payload.latitude,
      payload.longitude,
      payload.geofence_radius_meters,
      payload.contact_name,
      payload.contact_phone,
      payload.status,
      userId || null,
      id,
      tenantId
    ]
  );

  return findByIdForTenant(id, tenantId, db);
}

async function updateStatus(id, tenantId, status, userId, db = pool) {
  await db.query(
    `
      UPDATE branches
      SET status = ?, updated_by = ?
      WHERE id = ?
        AND tenant_id = ?
    `,
    [status, userId || null, id, tenantId]
  );

  return findByIdForTenant(id, tenantId, db);
}

async function countByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM branches WHERE tenant_id = ?",
    [tenantId]
  );

  return row.total;
}

module.exports = {
  listByTenantId,
  listActiveByTenantId,
  findByIdForTenant,
  existsByCodeForTenant,
  create,
  update,
  updateStatus,
  countByTenantId
};
