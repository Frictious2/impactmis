const pool = require("../db/pool");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const userRepo = require("../repos/user.repo");
const staffRepo = require("../repos/staff.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");
const notificationService = require("./notification.service");

function normalizeMoney(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

function normalizeProjectPayload(payload) {
  return {
    project_code: String(payload.project_code || "").trim().toUpperCase(),
    project_name: String(payload.project_name || "").trim(),
    project_description: String(payload.project_description || "").trim(),
    branch_id: normalizeNullable(payload.branch_id),
    project_manager_id: normalizeNullable(payload.project_manager_id),
    donor_name: normalizeNullable(payload.donor_name),
    budget: normalizeMoney(payload.budget),
    start_date: payload.start_date,
    end_date: normalizeNullable(payload.end_date),
    status: payload.status || "planning",
    completion_percentage: Number(payload.completion_percentage || 0)
  };
}

function normalizeAssignmentPayload(payload) {
  return {
    staff_member_id: Number(payload.staff_member_id),
    assignment_role: String(payload.assignment_role || "").trim(),
    assigned_date: payload.assigned_date
  };
}

function normalizeTaskPayload(payload) {
  return {
    assigned_staff_id: normalizeNullable(payload.assigned_staff_id),
    title: String(payload.title || "").trim(),
    description: normalizeNullable(payload.description),
    due_date: normalizeNullable(payload.due_date),
    priority: payload.priority || "medium",
    status: payload.status || "pending",
    completion_percentage: Number(payload.completion_percentage || 0)
  };
}

async function assertProjectBelongsToTenant(tenantId, projectId, db = pool) {
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }

  return project;
}

async function assertBranchBelongsToTenant(tenantId, branchId, db = pool) {
  if (!branchId) {
    return null;
  }

  const branch = await branchRepo.findByIdForTenant(branchId, tenantId, db);
  if (!branch) {
    const error = new Error("Selected branch was not found.");
    error.statusCode = 404;
    throw error;
  }

  return branch;
}

async function assertUserBelongsToTenant(tenantId, userId, db = pool) {
  if (!userId) {
    return null;
  }

  const user = await userRepo.findByIdForTenant(userId, tenantId, db);
  if (!user) {
    const error = new Error("Selected project manager was not found.");
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function assertStaffBelongsToTenant(tenantId, staffId, db = pool) {
  if (!staffId) {
    return null;
  }

  const staff = await staffRepo.findStaffById(tenantId, staffId, db);
  if (!staff) {
    const error = new Error("Selected staff member was not found.");
    error.statusCode = 404;
    throw error;
  }

  return staff;
}

async function listProjects(tenantId, filters) {
  return projectRepo.listProjects(tenantId, filters);
}

async function findProject(tenantId, id) {
  return projectRepo.findProject(tenantId, id);
}

async function createProject(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalized = normalizeProjectPayload(payload);
    await assertBranchBelongsToTenant(tenantId, normalized.branch_id, connection);
    await assertUserBelongsToTenant(tenantId, normalized.project_manager_id, connection);

    const project = await projectRepo.createProject(tenantId, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.created",
        entity_type: "project",
        entity_id: String(project.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return project;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateProject(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assertProjectBelongsToTenant(tenantId, id, connection);

    const normalized = normalizeProjectPayload(payload);
    await assertBranchBelongsToTenant(tenantId, normalized.branch_id, connection);
    await assertUserBelongsToTenant(tenantId, normalized.project_manager_id, connection);

    const project = await projectRepo.updateProject(tenantId, id, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.updated",
        entity_type: "project",
        entity_id: String(project.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return project;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function changeProjectStatus(tenantId, id, status, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await assertProjectBelongsToTenant(tenantId, id, connection);
    const completionPercentage =
      status === "completed" ? 100 : status === "planning" ? 0 : existing.completion_percentage;
    const project = await projectRepo.changeProjectStatus(
      tenantId,
      id,
      status,
      completionPercentage,
      userId,
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.status_changed",
        entity_type: "project",
        entity_id: String(project.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          status: project.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return project;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assignStaff(tenantId, projectId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const project = await assertProjectBelongsToTenant(tenantId, projectId, connection);
    const normalized = normalizeAssignmentPayload(payload);
    const staffMember = await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    const existing = await projectRepo.findActiveAssignment(
      tenantId,
      projectId,
      normalized.staff_member_id,
      connection
    );

    if (existing) {
      const error = new Error("This staff member is already actively assigned to the project.");
      error.statusCode = 422;
      throw error;
    }

    const assignment = await projectRepo.assignStaff(
      tenantId,
      projectId,
      normalized,
      userId,
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.assignment_added",
        entity_type: "project_assignment",
        entity_id: String(assignment.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          staff_member_id: staffMember.id
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return assignment;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function removeStaff(tenantId, projectId, assignmentId, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const project = await assertProjectBelongsToTenant(tenantId, projectId, connection);
    const assignment = await projectRepo.findAssignment(tenantId, assignmentId, connection);

    if (!assignment || Number(assignment.project_id) !== Number(projectId)) {
      const error = new Error("Project assignment not found.");
      error.statusCode = 404;
      throw error;
    }

    const updated = await projectRepo.removeStaff(tenantId, assignmentId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.assignment_removed",
        entity_type: "project_assignment",
        entity_id: String(updated.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          staff_member_id: updated.staff_member_id
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listAssignments(tenantId, projectId) {
  return projectRepo.listAssignments(tenantId, projectId);
}

async function createTask(tenantId, projectId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const project = await assertProjectBelongsToTenant(tenantId, projectId, connection);
    const normalized = normalizeTaskPayload(payload);
    const staffMember = await assertStaffBelongsToTenant(
      tenantId,
      normalized.assigned_staff_id,
      connection
    );

    const task = await projectRepo.createTask(tenantId, projectId, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.task_created",
        entity_type: "project_task",
        entity_id: String(task.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          task_id: task.id,
          staff_member_id: staffMember ? staffMember.id : null
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    if (staffMember?.user_id) {
      notificationService.safeUserNotification(tenantId, staffMember.user_id, {
        title: "Project task assigned",
        message: `A task was assigned to you on ${project.project_name}.`,
        type: "info",
        category: "project",
        link_url: `/projects/${project.id}?tab=tasks`,
        created_by: userId
      });
    }
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateTask(tenantId, taskId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await projectRepo.findTask(tenantId, taskId, connection);
    if (!existing) {
      const error = new Error("Project task not found.");
      error.statusCode = 404;
      throw error;
    }

    const project = await assertProjectBelongsToTenant(tenantId, existing.project_id, connection);
    const normalized = normalizeTaskPayload(payload);
    const staffMember = await assertStaffBelongsToTenant(
      tenantId,
      normalized.assigned_staff_id,
      connection
    );

    const task = await projectRepo.updateTask(tenantId, taskId, normalized, userId, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.task_updated",
        entity_type: "project_task",
        entity_id: String(task.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          task_id: task.id,
          staff_member_id: staffMember ? staffMember.id : null
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    if (status === "completed") {
      notificationService.notifyRoles(tenantId, ["Project Manager"], {
        title: "Project task completed",
        message: `A task was completed on ${project.project_name}.`,
        type: "success",
        category: "project",
        link_url: `/projects/${project.id}?tab=tasks`,
        created_by: userId
      });
    }
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateTaskStatus(tenantId, taskId, status, userId, ipAddress) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await projectRepo.findTask(tenantId, taskId, connection);
    if (!existing) {
      const error = new Error("Project task not found.");
      error.statusCode = 404;
      throw error;
    }

    const project = await assertProjectBelongsToTenant(tenantId, existing.project_id, connection);
    const completionPercentage =
      status === "completed" ? 100 : status === "in_progress" ? Math.max(existing.completion_percentage, 25) : 0;
    const task = await projectRepo.updateTaskStatus(
      tenantId,
      taskId,
      status,
      completionPercentage,
      userId,
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: status === "completed" ? "project.task_completed" : "project.task_updated",
        entity_type: "project_task",
        entity_id: String(task.id),
        metadata_json: {
          project_id: project.id,
          project_code: project.project_code,
          task_id: task.id,
          staff_member_id: task.assigned_staff_id || null
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listProjects,
  findProject,
  createProject,
  updateProject,
  changeProjectStatus,
  assignStaff,
  removeStaff,
  listAssignments,
  createTask,
  updateTask,
  updateTaskStatus
};
