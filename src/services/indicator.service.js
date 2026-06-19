const pool = require("../db/pool");
const indicatorRepo = require("../repos/indicator.repo");
const projectRepo = require("../repos/project.repo");
const activityReportRepo = require("../repos/activity-report.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function normalizeIndicatorPayload(payload, projectId) {
  return {
    project_id: Number(projectId || payload.project_id),
    indicator_name: String(payload.indicator_name || "").trim(),
    description: normalizeNullable(payload.description),
    target_value: Number(payload.target_value),
    current_value:
      payload.current_value === null || payload.current_value === undefined || payload.current_value === ""
        ? 0
        : Number(payload.current_value),
    unit: normalizeNullable(payload.unit),
    status: payload.status || "active"
  };
}

function normalizeUpdatePayload(payload) {
  return {
    activity_report_id: normalizeNullable(payload.activity_report_id),
    update_value: Number(payload.update_value),
    notes: normalizeNullable(payload.notes)
  };
}

async function assertProjectBelongsToTenant(tenantId, projectId, db = pool) {
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) {
    const error = new Error("Selected project was not found.");
    error.statusCode = 404;
    throw error;
  }
  return project;
}

async function listIndicators(tenantId, projectId) {
  return indicatorRepo.listIndicators(tenantId, projectId);
}

async function createIndicator(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeIndicatorPayload(payload);
    const project = await assertProjectBelongsToTenant(tenantId, normalized.project_id, connection);
    const indicator = await indicatorRepo.createIndicator(tenantId, normalized, userId, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "indicator.created",
        entity_type: "project_indicator",
        entity_id: String(indicator.id),
        metadata_json: { indicator_id: indicator.id, project_id: project.id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return indicator;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateIndicator(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await indicatorRepo.findIndicatorById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Project indicator not found.");
      error.statusCode = 404;
      throw error;
    }
    await assertProjectBelongsToTenant(tenantId, existing.project_id, connection);
    const normalized = normalizeIndicatorPayload({ ...payload, project_id: existing.project_id });
    const indicator = await indicatorRepo.updateIndicator(tenantId, id, normalized, userId, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "indicator.updated",
        entity_type: "project_indicator",
        entity_id: String(indicator.id),
        metadata_json: { indicator_id: indicator.id, project_id: indicator.project_id },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return indicator;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addIndicatorUpdate(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const indicator = await indicatorRepo.findIndicatorById(tenantId, id, connection);
    if (!indicator) {
      const error = new Error("Project indicator not found.");
      error.statusCode = 404;
      throw error;
    }

    const normalized = normalizeUpdatePayload(payload);
    if (normalized.activity_report_id) {
      const report = await activityReportRepo.findReportById(tenantId, normalized.activity_report_id, connection);
      if (!report) {
        const error = new Error("Selected activity report was not found.");
        error.statusCode = 404;
        throw error;
      }
    }

    const update = await indicatorRepo.addIndicatorUpdate(tenantId, id, normalized, userId, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "indicator.progress_updated",
        entity_type: "indicator_update",
        entity_id: String(update.id),
        metadata_json: { indicator_id: indicator.id, project_id: indicator.project_id, update_value: update.update_value },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return update;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listIndicators,
  createIndicator,
  updateIndicator,
  addIndicatorUpdate
};
