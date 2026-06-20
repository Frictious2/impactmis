const pool = require("../db/pool");

async function findByProjectId(tenantId, projectId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM logframes WHERE tenant_id = ? AND project_id = ? ORDER BY status = 'active' DESC, id DESC LIMIT 1",
    [tenantId, projectId]
  );
  return rows[0] || null;
}

async function findById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM logframes WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function createLogFrame(tenantId, payload, userId, db = pool) {
  if (payload.status === "active") {
    await db.query("UPDATE logframes SET status = 'archived' WHERE tenant_id = ? AND project_id = ? AND status = 'active'", [
      tenantId,
      payload.project_id
    ]);
  }
  const [result] = await db.query(
    `INSERT INTO logframes (tenant_id, project_id, title, description, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, payload.project_id, payload.title, payload.description || null, payload.status || "draft", userId || null, userId || null]
  );
  return findById(tenantId, result.insertId, db);
}

async function createOutcome(tenantId, payload, db = pool) {
  const [result] = await db.query(
    `INSERT INTO logframe_outcomes (tenant_id, logframe_id, outcome_code, outcome_statement, assumptions_risks, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, payload.logframe_id, payload.outcome_code, payload.outcome_statement, payload.assumptions_risks || null, payload.sort_order || 0]
  );
  return findOutcome(tenantId, result.insertId, db);
}

async function findOutcome(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM logframe_outcomes WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function createOutput(tenantId, payload, db = pool) {
  const [result] = await db.query(
    `INSERT INTO logframe_outputs (tenant_id, outcome_id, output_code, output_statement, assumptions_risks, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, payload.outcome_id, payload.output_code, payload.output_statement, payload.assumptions_risks || null, payload.sort_order || 0]
  );
  return findOutput(tenantId, result.insertId, db);
}

async function findOutput(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM logframe_outputs WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function createActivity(tenantId, payload, db = pool) {
  const [result] = await db.query(
    `INSERT INTO logframe_activities (tenant_id, output_id, activity_code, activity_statement, planned_start_date, planned_end_date, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      payload.output_id,
      payload.activity_code,
      payload.activity_statement,
      payload.planned_start_date || null,
      payload.planned_end_date || null,
      payload.status || "not_started",
      payload.sort_order || 0
    ]
  );
  return findActivity(tenantId, result.insertId, db);
}

async function findActivity(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM logframe_activities WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function updateActivityStatus(tenantId, id, status, db = pool) {
  await db.query("UPDATE logframe_activities SET status = ? WHERE tenant_id = ? AND id = ?", [status, tenantId, id]);
  return findActivity(tenantId, id, db);
}

async function listHierarchy(tenantId, projectId, db = pool) {
  const logframe = await findByProjectId(tenantId, projectId, db);
  if (!logframe) return { logframe: null, outcomes: [] };
  const [outcomes] = await db.query(
    "SELECT * FROM logframe_outcomes WHERE tenant_id = ? AND logframe_id = ? ORDER BY sort_order ASC, id ASC",
    [tenantId, logframe.id]
  );
  const [outputs] = await db.query(
    `SELECT o.*
     FROM logframe_outputs o
     INNER JOIN logframe_outcomes lo ON lo.tenant_id = o.tenant_id AND lo.id = o.outcome_id
     WHERE o.tenant_id = ? AND lo.logframe_id = ?
     ORDER BY o.sort_order ASC, o.id ASC`,
    [tenantId, logframe.id]
  );
  const [activities] = await db.query(
    `SELECT a.*
     FROM logframe_activities a
     INNER JOIN logframe_outputs op ON op.tenant_id = a.tenant_id AND op.id = a.output_id
     INNER JOIN logframe_outcomes lo ON lo.tenant_id = op.tenant_id AND lo.id = op.outcome_id
     WHERE a.tenant_id = ? AND lo.logframe_id = ?
     ORDER BY a.sort_order ASC, a.id ASC`,
    [tenantId, logframe.id]
  );
  return {
    logframe,
    outcomes: outcomes.map((outcome) => ({
      ...outcome,
      outputs: outputs
        .filter((output) => Number(output.outcome_id) === Number(outcome.id))
        .map((output) => ({
          ...output,
          activities: activities.filter((activity) => Number(activity.output_id) === Number(output.id))
        }))
    }))
  };
}

async function countActiveByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM logframes WHERE tenant_id = ? AND status = 'active'", [tenantId]);
  return Number(row.total || 0);
}

async function listActiveSummariesForDonor(tenantId, db = pool) {
  const [rows] = await db.query(
    `SELECT lf.*, p.project_code, p.project_name
     FROM logframes lf
     INNER JOIN projects p ON p.tenant_id = lf.tenant_id AND p.id = lf.project_id
     WHERE lf.tenant_id = ? AND lf.status = 'active' AND p.status IN ('active', 'completed')
     ORDER BY p.project_name ASC`,
    [tenantId]
  );
  return rows;
}

module.exports = {
  findByProjectId,
  findById,
  createLogFrame,
  createOutcome,
  findOutcome,
  createOutput,
  findOutput,
  createActivity,
  findActivity,
  updateActivityStatus,
  listHierarchy,
  countActiveByTenantId,
  listActiveSummariesForDonor
};
