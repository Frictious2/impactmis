const pool = require("../db/pool");
const { parseJsonField } = require("../utils/tenant-form");

async function create(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.tenant_id || null,
      payload.user_id || null,
      payload.action,
      payload.entity_type,
      payload.entity_id || null,
      payload.metadata_json ? JSON.stringify(payload.metadata_json) : null,
      payload.ip_address || null
    ]
  );

  return result.insertId;
}

async function listRecentByTenantId(tenantId, limit = 10) {
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, Number(limit)]
  );

  return rows.map((row) => ({
    ...row,
    metadata_json: parseJsonField(row.metadata_json, null)
  }));
}

async function listByTenantId(tenantId, limit = 50) {
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, Number(limit)]
  );

  return rows.map((row) => ({
    ...row,
    metadata_json: parseJsonField(row.metadata_json, null)
  }));
}

async function countByTenantId(tenantId) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS total FROM audit_logs WHERE tenant_id = ?",
    [tenantId]
  );

  return row.total;
}

async function listProjectActivityByTenantId(tenantId, projectId, limit = 50) {
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
        AND (
          (al.entity_type = 'project' AND al.entity_id = ?)
          OR JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.project_id')) = ?
        )
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, String(projectId), String(projectId), Number(limit)]
  );

  return rows.map((row) => ({
    ...row,
    metadata_json: parseJsonField(row.metadata_json, null)
  }));
}

async function listActivityReportActivityByTenantId(tenantId, reportId, limit = 100) {
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
        AND (
          (al.entity_type = 'activity_report' AND al.entity_id = ?)
          OR JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.report_id')) = ?
        )
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, String(reportId), String(reportId), Number(limit)]
  );

  return rows.map((row) => ({
    ...row,
    metadata_json: parseJsonField(row.metadata_json, null)
  }));
}

module.exports = {
  create,
  listRecentByTenantId,
  listByTenantId,
  countByTenantId,
  listProjectActivityByTenantId,
  listActivityReportActivityByTenantId
};
