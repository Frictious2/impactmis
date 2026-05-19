const pool = require("../db/pool");
const staffRepo = require("../repos/staff.repo");
const departmentRepo = require("../repos/department.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeEmail, normalizeNullable } = require("../utils/tenant-form");

function normalizeStaffPayload(payload) {
  return {
    staff_code: normalizeNullable(payload.staff_code),
    first_name: payload.first_name.trim(),
    middle_name: normalizeNullable(payload.middle_name),
    last_name: payload.last_name.trim(),
    gender: normalizeNullable(payload.gender),
    date_of_birth: normalizeNullable(payload.date_of_birth),
    phone: normalizeNullable(payload.phone),
    email: normalizeEmail(payload.email),
    address: normalizeNullable(payload.address),
    department_id: normalizeNullable(payload.department_id),
    position_title: payload.position_title.trim(),
    employment_type: payload.employment_type,
    start_date: payload.start_date,
    end_date: normalizeNullable(payload.end_date),
    status: payload.status || "active",
    emergency_contact_name: normalizeNullable(payload.emergency_contact_name),
    emergency_contact_phone: normalizeNullable(payload.emergency_contact_phone),
    notes: normalizeNullable(payload.notes)
  };
}

async function assertDepartmentBelongsToTenant(tenantId, departmentId, db = pool) {
  if (!departmentId) {
    return null;
  }

  const department = await departmentRepo.findByIdForTenant(departmentId, tenantId, db);
  if (!department) {
    const error = new Error("Selected department was not found.");
    error.statusCode = 404;
    throw error;
  }

  return department;
}

async function listStaff(tenantId, filters) {
  return staffRepo.listStaff(tenantId, filters);
}

async function findStaffById(tenantId, id) {
  return staffRepo.findStaffById(tenantId, id);
}

async function createStaff(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalized = normalizeStaffPayload(payload);
    await assertDepartmentBelongsToTenant(tenantId, normalized.department_id, connection);

    normalized.staff_code =
      normalized.staff_code ||
      (await staffRepo.generateStaffCode(tenantId, normalized.employment_type, connection));

    const staff = await staffRepo.createStaff(tenantId, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "staff.created",
        entity_type: "staff_member",
        entity_id: String(staff.id),
        metadata_json: {
          staff_id: staff.id,
          staff_code: staff.staff_code,
          full_name: staff.full_name
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return staff;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStaff(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await staffRepo.findStaffById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Staff record not found.");
      error.statusCode = 404;
      throw error;
    }

    const normalized = normalizeStaffPayload(payload);
    await assertDepartmentBelongsToTenant(tenantId, normalized.department_id, connection);

    normalized.staff_code =
      normalized.staff_code ||
      existing.staff_code ||
      (await staffRepo.generateStaffCode(tenantId, normalized.employment_type, connection));

    const staff = await staffRepo.updateStaff(tenantId, id, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "staff.updated",
        entity_type: "staff_member",
        entity_id: String(staff.id),
        metadata_json: {
          staff_id: staff.id,
          staff_code: staff.staff_code,
          full_name: staff.full_name
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return staff;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function changeStaffStatus(tenantId, id, status, endDate, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await staffRepo.findStaffById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Staff record not found.");
      error.statusCode = 404;
      throw error;
    }

    const nextEndDate = status === "exited" ? normalizeNullable(endDate) : null;
    const staff = await staffRepo.changeStaffStatus(
      tenantId,
      id,
      status,
      nextEndDate,
      userId,
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "staff.status_changed",
        entity_type: "staff_member",
        entity_id: String(staff.id),
        metadata_json: {
          staff_id: staff.id,
          staff_code: staff.staff_code,
          status: staff.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return staff;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generateStaffCode(tenantId, employmentType) {
  return staffRepo.generateStaffCode(tenantId, employmentType);
}

module.exports = {
  listStaff,
  findStaffById,
  createStaff,
  updateStaff,
  changeStaffStatus,
  generateStaffCode
};
