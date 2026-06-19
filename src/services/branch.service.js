const pool = require("../db/pool");
const branchRepo = require("../repos/branch.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function normalizeBranchPayload(payload, tenantId) {
  return {
    tenant_id: tenantId,
    branch_code: String(payload.branch_code || "").trim().toUpperCase(),
    name: String(payload.name || "").trim(),
    address: String(payload.address || "").trim(),
    city: normalizeNullable(payload.city),
    district: normalizeNullable(payload.district),
    country: String(payload.country || "Sierra Leone").trim(),
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    geofence_radius_meters: Number(payload.geofence_radius_meters || 100),
    contact_name: normalizeNullable(payload.contact_name),
    contact_phone: normalizeNullable(payload.contact_phone),
    status: payload.status || "active"
  };
}

async function createBranch(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const branch = await branchRepo.create(normalizeBranchPayload(payload, tenantId), userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "branch.created",
        entity_type: "branch",
        entity_id: String(branch.id),
        metadata_json: {
          branch_id: branch.id,
          branch_code: branch.branch_code,
          geofence_radius_meters: branch.geofence_radius_meters
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return branch;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateBranch(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await branchRepo.findByIdForTenant(id, tenantId, connection);
    if (!existing) {
      const error = new Error("Branch not found.");
      error.statusCode = 404;
      throw error;
    }

    const branch = await branchRepo.update(id, tenantId, normalizeBranchPayload(payload, tenantId), userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "branch.updated",
        entity_type: "branch",
        entity_id: String(branch.id),
        metadata_json: {
          branch_id: branch.id,
          branch_code: branch.branch_code,
          geofence_radius_meters: branch.geofence_radius_meters
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return branch;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateBranchStatus(tenantId, id, status, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const branch = await branchRepo.updateStatus(id, tenantId, status, userId, connection);
    if (!branch) {
      const error = new Error("Branch not found.");
      error.statusCode = 404;
      throw error;
    }

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "branch.status_changed",
        entity_type: "branch",
        entity_id: String(branch.id),
        metadata_json: {
          branch_id: branch.id,
          branch_code: branch.branch_code,
          status: branch.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return branch;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createBranch,
  updateBranch,
  updateBranchStatus
};
