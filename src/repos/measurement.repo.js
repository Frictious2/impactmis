const pool = require("../db/pool");

async function addMeasurement(tenantId, indicatorId, payload, userId, db = pool) {
  const [result] = await db.query(
    `INSERT INTO indicator_measurements (tenant_id, indicator_id, measurement_type, measurement_date, value, comments, entered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, indicatorId, payload.measurement_type, payload.measurement_date, payload.value, payload.comments || null, userId || null]
  );
  return findById(tenantId, result.insertId, db);
}

async function findById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM indicator_measurements WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function listMeasurements(tenantId, indicatorId, db = pool) {
  const [rows] = await db.query(
    `SELECT im.*, u.full_name AS entered_by_name
     FROM indicator_measurements im
     LEFT JOIN users u ON u.id = im.entered_by
     WHERE im.tenant_id = ? AND im.indicator_id = ?
     ORDER BY im.measurement_date ASC, im.id ASC`,
    [tenantId, indicatorId]
  );
  return rows;
}

async function countOnTrack(tenantId, db = pool) {
  const [[onTrack]] = await db.query(
    `SELECT COUNT(*) AS total FROM project_indicators WHERE tenant_id = ? AND status = 'active' AND (target_value = 0 OR current_value >= target_value)`,
    [tenantId]
  );
  const [[offTrack]] = await db.query(
    `SELECT COUNT(*) AS total FROM project_indicators WHERE tenant_id = ? AND status = 'active' AND target_value > 0 AND current_value < target_value`,
    [tenantId]
  );
  return { onTrack: Number(onTrack.total || 0), offTrack: Number(offTrack.total || 0) };
}

module.exports = { addMeasurement, findById, listMeasurements, countOnTrack };
