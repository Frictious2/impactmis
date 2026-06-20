const pool = require("../db/pool");

function parseJsonField(value, fallback = null) {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

const TENANT_OPERATIONAL_PREFIXES = [
  "staff.",
  "branch.",
  "attendance.",
  "project.",
  "activity_report.",
  "logframe.",
  "outcome.",
  "output.",
  "activity.",
  "indicator.",
  "measurement.",
  "survey.",
  "payroll.",
  "finance.",
  "expense.",
  "accounting.",
  "notification.",
  "message.",
  "report."
];

const TENANT_AUDIT_BLOCKED_PREFIXES = ["developer.", "tenant.", "license.", "security.", "system."];

function mapAuditRows(rows) {
  return rows.map((row) => ({
    ...row,
    metadata_json: parseJsonField(row.metadata_json, null)
  }));
}

function tenantOperationalActionWhere(alias = "al") {
  const allow = TENANT_OPERATIONAL_PREFIXES.map(() => `${alias}.action LIKE ?`).join(" OR ");
  const block = TENANT_AUDIT_BLOCKED_PREFIXES.map(() => `${alias}.action NOT LIKE ?`).join(" AND ");
  return {
    sql: `(${allow}) AND ${block}`,
    params: [
      ...TENANT_OPERATIONAL_PREFIXES.map((prefix) => `${prefix}%`),
      ...TENANT_AUDIT_BLOCKED_PREFIXES.map((prefix) => `${prefix}%`)
    ]
  };
}

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

  return mapAuditRows(rows);
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

  return mapAuditRows(rows);
}

async function countByTenantId(tenantId) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS total FROM audit_logs WHERE tenant_id = ?",
    [tenantId]
  );

  return row.total;
}

async function listDeveloperAuditLogs(filters = {}, limit = 100) {
  const params = [];
  const where = [];

  if (filters.tenant_id) {
    where.push("al.tenant_id = ?");
    params.push(filters.tenant_id);
  }

  if (filters.action) {
    where.push("al.action LIKE ?");
    params.push(`${filters.action}%`);
  }

  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name,
        t.name AS tenant_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN tenants t ON t.id = al.tenant_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [...params, Number(limit)]
  );

  return mapAuditRows(rows);
}

async function listTenantAuditLogs(tenantId, filters = {}, limit = 100) {
  const actionScope = tenantOperationalActionWhere("al");
  const params = [tenantId, ...actionScope.params];
  const where = [`al.tenant_id = ?`, actionScope.sql];

  if (filters.action) {
    where.push("al.action LIKE ?");
    params.push(`${filters.action}%`);
  }

  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [...params, Number(limit)]
  );

  return mapAuditRows(rows);
}

async function countTenantAuditLogs(tenantId) {
  const actionScope = tenantOperationalActionWhere("al");
  const [[row]] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM audit_logs al
      WHERE al.tenant_id = ?
        AND ${actionScope.sql}
    `,
    [tenantId, ...actionScope.params]
  );

  return Number(row.total || 0);
}

async function listTenantEntityAuditLogs(tenantId, entityType, entityId, limit = 100) {
  const actionScope = tenantOperationalActionWhere("al");
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
        AND al.entity_type = ?
        AND al.entity_id = ?
        AND ${actionScope.sql}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, entityType, String(entityId), ...actionScope.params, Number(limit)]
  );

  return mapAuditRows(rows);
}

async function listProjectActivityByTenantId(tenantId, projectId, limit = 50) {
  const actionScope = tenantOperationalActionWhere("al");
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
        AND ${actionScope.sql}
        AND (
          (al.entity_type = 'project' AND al.entity_id = ?)
          OR JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.project_id')) = ?
        )
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, ...actionScope.params, String(projectId), String(projectId), Number(limit)]
  );

  return mapAuditRows(rows);
}

async function listActivityReportActivityByTenantId(tenantId, reportId, limit = 100) {
  const actionScope = tenantOperationalActionWhere("al");
  const [rows] = await pool.query(
    `
      SELECT
        al.*,
        u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
        AND ${actionScope.sql}
        AND (
          (al.entity_type = 'activity_report' AND al.entity_id = ?)
          OR JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.report_id')) = ?
        )
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [tenantId, ...actionScope.params, String(reportId), String(reportId), Number(limit)]
  );

  return mapAuditRows(rows);
}

module.exports = {
  create,
  listRecentByTenantId,
  listByTenantId,
  countByTenantId,
  listDeveloperAuditLogs,
  listTenantAuditLogs,
  countTenantAuditLogs,
  listTenantEntityAuditLogs,
  listProjectActivityByTenantId,
  listActivityReportActivityByTenantId,
  TENANT_OPERATIONAL_PREFIXES,
  TENANT_AUDIT_BLOCKED_PREFIXES
};
