const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const organizationProfileRepo = require("../repos/organization-profile.repo");
const departmentRepo = require("../repos/department.repo");
const userRepo = require("../repos/user.repo");
const approvalWorkflowRepo = require("../repos/approval-workflow.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeEmail, normalizeNullable } = require("../utils/tenant-form");

async function saveOrganizationProfile({ tenantId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const profile = await organizationProfileRepo.upsertByTenantId(
      tenantId,
      {
        organization_name: payload.organization_name.trim(),
        logo: normalizeNullable(payload.logo),
        address: normalizeNullable(payload.address),
        city: normalizeNullable(payload.city),
        district: normalizeNullable(payload.district),
        country: payload.country.trim(),
        registration_number: normalizeNullable(payload.registration_number),
        website: normalizeNullable(payload.website),
        email: normalizeEmail(payload.email),
        phone: normalizeNullable(payload.phone),
        mission_statement: normalizeNullable(payload.mission_statement),
        organization_type: normalizeNullable(payload.organization_type),
        fiscal_year_start_month: Number(payload.fiscal_year_start_month)
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "organization_profile.saved",
        entity_type: "organization_profile",
        entity_id: String(profile.id),
        metadata_json: {
          organization_name: profile.organization_name,
          fiscal_year_start_month: profile.fiscal_year_start_month
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return profile;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createDepartment({ tenantId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const department = await departmentRepo.create(
      {
        tenant_id: tenantId,
        department_name: payload.department_name.trim(),
        description: normalizeNullable(payload.description),
        status: payload.status
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "department.created",
        entity_type: "department",
        entity_id: String(department.id),
        metadata_json: {
          department_name: department.department_name,
          status: department.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return department;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDepartment({ tenantId, departmentId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const department = await departmentRepo.update(
      departmentId,
      tenantId,
      {
        department_name: payload.department_name.trim(),
        description: normalizeNullable(payload.description),
        status: payload.status
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "department.updated",
        entity_type: "department",
        entity_id: String(department.id),
        metadata_json: {
          department_name: department.department_name,
          status: department.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return department;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteDepartment({ tenantId, departmentId, actor, ipAddress }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const department = await departmentRepo.findByIdForTenant(departmentId, tenantId, connection);

    await departmentRepo.remove(departmentId, tenantId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "department.deleted",
        entity_type: "department",
        entity_id: String(departmentId),
        metadata_json: {
          department_name: department ? department.department_name : null
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createTenantUser({ tenantId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const passwordHash = await bcrypt.hash(payload.password, 12);

    const user = await userRepo.create(
      {
        tenant_id: tenantId,
        full_name: payload.full_name.trim(),
        email: normalizeEmail(payload.email),
        password_hash: passwordHash,
        role: payload.role,
        department_id: payload.department_id || null,
        user_type: "tenant",
        status: payload.status,
        must_change_password: true,
        tenant_scope_key: `tenant:${tenantId}`
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "tenant_user.created",
        entity_type: "user",
        entity_id: String(user.id),
        metadata_json: {
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          department_id: user.department_id
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return user;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveApprovalWorkflow({ tenantId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const workflow = await approvalWorkflowRepo.upsertByTenantId(
      tenantId,
      {
        attendance_approvals: Number(payload.attendance_approvals),
        payroll_approvals: Number(payload.payroll_approvals),
        expense_approvals: Number(payload.expense_approvals),
        project_report_approvals: Number(payload.project_report_approvals),
        staff_approvals: Number(payload.staff_approvals)
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "approval_workflow.saved",
        entity_type: "approval_workflow",
        entity_id: String(workflow.id),
        metadata_json: {
          attendance_approvals: workflow.attendance_approvals,
          payroll_approvals: workflow.payroll_approvals,
          expense_approvals: workflow.expense_approvals,
          project_report_approvals: workflow.project_report_approvals,
          staff_approvals: workflow.staff_approvals
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return workflow;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  saveOrganizationProfile,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createTenantUser,
  saveApprovalWorkflow
};
