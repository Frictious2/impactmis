const pool = require("../db/pool");

async function listIndicators(tenantId, projectId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_indicators
      WHERE tenant_id = ?
        AND project_id = ?
      ORDER BY created_at DESC, id DESC
    `,
    [tenantId, projectId]
  );
  return rows;
}

async function findIndicatorById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_indicators
      WHERE tenant_id = ?
        AND id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function createIndicator(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO project_indicators (
        tenant_id, project_id, indicator_name, description, target_value, current_value, unit, status, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.project_id,
      payload.indicator_name,
      payload.description,
      payload.target_value,
      payload.current_value,
      payload.unit,
      payload.status,
      userId,
      userId
    ]
  );
  return findIndicatorById(tenantId, result.insertId, db);
}

async function updateIndicator(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE project_indicators
      SET
        indicator_name = ?,
        description = ?,
        target_value = ?,
        unit = ?,
        status = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.indicator_name,
      payload.description,
      payload.target_value,
      payload.unit,
      payload.status,
      userId,
      tenantId,
      id
    ]
  );
  return findIndicatorById(tenantId, id, db);
}

async function addIndicatorUpdate(tenantId, indicatorId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO indicator_updates (
        tenant_id, indicator_id, activity_report_id, update_value, notes, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      indicatorId,
      payload.activity_report_id,
      payload.update_value,
      payload.notes,
      userId
    ]
  );

  await db.query(
    `
      UPDATE project_indicators
      SET current_value = current_value + ?, updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [payload.update_value, userId, tenantId, indicatorId]
  );

  const [rows] = await db.query(
    `
      SELECT iu.*, ar.report_code
      FROM indicator_updates iu
      LEFT JOIN activity_reports ar ON ar.id = iu.activity_report_id AND ar.tenant_id = iu.tenant_id
      WHERE iu.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );
  return rows[0] || null;
}

async function listIndicatorUpdates(tenantId, indicatorId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        iu.*,
        u.full_name AS updated_by_name,
        ar.report_code
      FROM indicator_updates iu
      LEFT JOIN users u ON u.id = iu.updated_by
      LEFT JOIN activity_reports ar ON ar.id = iu.activity_report_id AND ar.tenant_id = iu.tenant_id
      WHERE iu.tenant_id = ?
        AND iu.indicator_id = ?
      ORDER BY iu.created_at DESC, iu.id DESC
    `,
    [tenantId, indicatorId]
  );
  return rows;
}

async function listRecentUpdatesByProjectId(tenantId, projectId, limit = 10, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        iu.*,
        pi.indicator_name,
        ar.report_code
      FROM indicator_updates iu
      INNER JOIN project_indicators pi ON pi.id = iu.indicator_id AND pi.tenant_id = iu.tenant_id
      LEFT JOIN activity_reports ar ON ar.id = iu.activity_report_id AND ar.tenant_id = iu.tenant_id
      WHERE iu.tenant_id = ?
        AND pi.project_id = ?
      ORDER BY iu.created_at DESC, iu.id DESC
      LIMIT ?
    `,
    [tenantId, projectId, Number(limit)]
  );
  return rows;
}

async function listUpdatesByReportId(tenantId, reportId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        iu.*,
        pi.indicator_name,
        u.full_name AS updated_by_name,
        ar.report_code
      FROM indicator_updates iu
      INNER JOIN project_indicators pi ON pi.id = iu.indicator_id AND pi.tenant_id = iu.tenant_id
      LEFT JOIN users u ON u.id = iu.updated_by
      LEFT JOIN activity_reports ar ON ar.id = iu.activity_report_id AND ar.tenant_id = iu.tenant_id
      WHERE iu.tenant_id = ?
        AND iu.activity_report_id = ?
      ORDER BY iu.created_at DESC, iu.id DESC
    `,
    [tenantId, reportId]
  );
  return rows;
}

module.exports = {
  listIndicators,
  findIndicatorById,
  createIndicator,
  updateIndicator,
  addIndicatorUpdate,
  listIndicatorUpdates,
  listRecentUpdatesByProjectId,
  listUpdatesByReportId
};
