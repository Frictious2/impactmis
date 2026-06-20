const pool = require("../db/pool");
const logframeRepo = require("../repos/logframe.repo");
const projectRepo = require("../repos/project.repo");
const auditLogRepo = require("../repos/audit-log.repo");

const MANAGE_ROLES = new Set(["Tenant Admin", "Project Manager", "M&E Officer"]);
const VIEW_ROLES = new Set(["Tenant Admin", "Project Manager", "M&E Officer", "Auditor", "Data Entry Officer"]);

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function assertProject(tenantId, projectId, db = pool) {
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) throw appError("Project was not found.", 404);
  return project;
}

async function audit(db, tenantId, userId, ipAddress, action, entityType, entityId, metadata = {}) {
  await auditLogRepo.create(
    { tenant_id: tenantId, user_id: userId, action, entity_type: entityType, entity_id: String(entityId), metadata_json: metadata, ip_address: ipAddress },
    db
  );
}

async function createLogFrame(tenantId, projectId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const project = await assertProject(tenantId, projectId, db);
    const logframe = await logframeRepo.createLogFrame(
      tenantId,
      {
        project_id: project.id,
        title: String(payload.title || "").trim(),
        description: payload.description || null,
        status: payload.status || "draft"
      },
      userId,
      db
    );
    await audit(db, tenantId, userId, ipAddress, "logframe.created", "logframe", logframe.id, {
      logframe_id: logframe.id,
      project_id: project.id
    });
    await db.commit();
    return logframe;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function createOutcome(tenantId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const logframe = await logframeRepo.findById(tenantId, payload.logframe_id, db);
    if (!logframe) throw appError("LogFrame was not found.", 404);
    const outcome = await logframeRepo.createOutcome(tenantId, payload, db);
    await audit(db, tenantId, userId, ipAddress, "outcome.created", "logframe_outcome", outcome.id, {
      logframe_id: logframe.id,
      outcome_id: outcome.id
    });
    await db.commit();
    return outcome;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function createOutput(tenantId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const outcome = await logframeRepo.findOutcome(tenantId, payload.outcome_id, db);
    if (!outcome) throw appError("Outcome was not found.", 404);
    const output = await logframeRepo.createOutput(tenantId, payload, db);
    await audit(db, tenantId, userId, ipAddress, "output.created", "logframe_output", output.id, {
      outcome_id: outcome.id,
      output_id: output.id
    });
    await db.commit();
    return output;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function createActivity(tenantId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const output = await logframeRepo.findOutput(tenantId, payload.output_id, db);
    if (!output) throw appError("Output was not found.", 404);
    const activity = await logframeRepo.createActivity(tenantId, payload, db);
    await audit(db, tenantId, userId, ipAddress, "activity.created", "logframe_activity", activity.id, {
      output_id: output.id,
      activity_id: activity.id
    });
    await db.commit();
    return activity;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function updateActivityStatus(tenantId, id, status, userId, ipAddress) {
  if (!["not_started", "in_progress", "completed", "cancelled"].includes(status)) throw appError("Invalid activity status.");
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const activity = await logframeRepo.findActivity(tenantId, id, db);
    if (!activity) throw appError("Activity was not found.", 404);
    const updated = await logframeRepo.updateActivityStatus(tenantId, id, status, db);
    await audit(db, tenantId, userId, ipAddress, status === "completed" ? "activity.completed" : "activity.status_changed", "logframe_activity", id, {
      activity_id: id,
      status
    });
    await db.commit();
    return updated;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function listProjectLogFrame(tenantId, projectId) {
  await assertProject(tenantId, projectId);
  return logframeRepo.listHierarchy(tenantId, projectId);
}

module.exports = {
  MANAGE_ROLES,
  VIEW_ROLES,
  createLogFrame,
  createOutcome,
  createOutput,
  createActivity,
  updateActivityStatus,
  listProjectLogFrame
};
