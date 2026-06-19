const pool = require("../db/pool");

async function listProjects(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["p.tenant_id = ?"];

  if (filters.status) {
    where.push("p.status = ?");
    params.push(filters.status);
  }

  if (filters.branch_id) {
    where.push("p.branch_id = ?");
    params.push(filters.branch_id);
  }

  if (filters.project_manager_id) {
    where.push("p.project_manager_id = ?");
    params.push(filters.project_manager_id);
  }

  const [rows] = await db.query(
    `
      SELECT
        p.*,
        b.name AS branch_name,
        manager.full_name AS project_manager_name,
        (
          SELECT COUNT(*)
          FROM project_assignments pa
          WHERE pa.tenant_id = p.tenant_id
            AND pa.project_id = p.id
            AND pa.status = 'active'
        ) AS active_assignment_count,
        (
          SELECT COUNT(*)
          FROM project_tasks pt
          WHERE pt.tenant_id = p.tenant_id
            AND pt.project_id = p.id
            AND pt.status <> 'completed'
        ) AS open_task_count
      FROM projects p
      LEFT JOIN branches b
        ON b.id = p.branch_id
       AND b.tenant_id = p.tenant_id
      LEFT JOIN users manager
        ON manager.id = p.project_manager_id
       AND manager.tenant_id = p.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.created_at DESC, p.id DESC
    `,
    params
  );

  return rows;
}

async function findProject(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        p.*,
        b.name AS branch_name,
        manager.full_name AS project_manager_name,
        creator.full_name AS created_by_name,
        updater.full_name AS updated_by_name
      FROM projects p
      LEFT JOIN branches b
        ON b.id = p.branch_id
       AND b.tenant_id = p.tenant_id
      LEFT JOIN users manager
        ON manager.id = p.project_manager_id
       AND manager.tenant_id = p.tenant_id
      LEFT JOIN users creator ON creator.id = p.created_by
      LEFT JOIN users updater ON updater.id = p.updated_by
      WHERE p.tenant_id = ?
        AND p.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );

  return rows[0] || null;
}

async function createProject(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO projects (
        tenant_id,
        project_code,
        project_name,
        project_description,
        branch_id,
        project_manager_id,
        donor_name,
        budget,
        start_date,
        end_date,
        status,
        completion_percentage,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.project_code,
      payload.project_name,
      payload.project_description,
      payload.branch_id,
      payload.project_manager_id,
      payload.donor_name,
      payload.budget,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.completion_percentage,
      userId,
      userId
    ]
  );

  return findProject(tenantId, result.insertId, db);
}

async function updateProject(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE projects
      SET
        project_code = ?,
        project_name = ?,
        project_description = ?,
        branch_id = ?,
        project_manager_id = ?,
        donor_name = ?,
        budget = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        completion_percentage = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.project_code,
      payload.project_name,
      payload.project_description,
      payload.branch_id,
      payload.project_manager_id,
      payload.donor_name,
      payload.budget,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.completion_percentage,
      userId,
      tenantId,
      id
    ]
  );

  return findProject(tenantId, id, db);
}

async function changeProjectStatus(tenantId, id, status, completionPercentage, userId, db = pool) {
  await db.query(
    `
      UPDATE projects
      SET
        status = ?,
        completion_percentage = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [status, completionPercentage, userId, tenantId, id]
  );

  return findProject(tenantId, id, db);
}

async function existsProjectCode(tenantId, projectCode, excludeId = null, db = pool) {
  const params = [tenantId, projectCode];
  let sql = "SELECT id FROM projects WHERE tenant_id = ? AND project_code = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function listAssignments(tenantId, projectId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pa.*,
        sm.staff_code,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.position_title,
        sm.employment_type,
        d.department_name,
        creator.full_name AS created_by_name
      FROM project_assignments pa
      INNER JOIN staff_members sm
        ON sm.id = pa.staff_member_id
       AND sm.tenant_id = pa.tenant_id
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN users creator ON creator.id = pa.created_by
      WHERE pa.tenant_id = ?
        AND pa.project_id = ?
      ORDER BY pa.created_at DESC, pa.id DESC
    `,
    [tenantId, projectId]
  );

  return rows;
}

async function findAssignment(tenantId, assignmentId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_assignments
      WHERE tenant_id = ?
        AND id = ?
      LIMIT 1
    `,
    [tenantId, assignmentId]
  );

  return rows[0] || null;
}

async function findActiveAssignment(tenantId, projectId, staffMemberId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_assignments
      WHERE tenant_id = ?
        AND project_id = ?
        AND staff_member_id = ?
        AND status = 'active'
      LIMIT 1
    `,
    [tenantId, projectId, staffMemberId]
  );

  return rows[0] || null;
}

async function assignStaff(tenantId, projectId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO project_assignments (
        tenant_id,
        project_id,
        staff_member_id,
        assignment_role,
        assigned_date,
        status,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      projectId,
      payload.staff_member_id,
      payload.assignment_role,
      payload.assigned_date,
      payload.status || "active",
      userId
    ]
  );

  return findAssignment(tenantId, result.insertId, db);
}

async function removeStaff(tenantId, assignmentId, db = pool) {
  await db.query(
    `
      UPDATE project_assignments
      SET status = 'removed'
      WHERE tenant_id = ?
        AND id = ?
    `,
    [tenantId, assignmentId]
  );

  return findAssignment(tenantId, assignmentId, db);
}

async function listTasks(tenantId, projectId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pt.*,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS assigned_staff_name,
        sm.staff_code,
        creator.full_name AS created_by_name,
        updater.full_name AS updated_by_name
      FROM project_tasks pt
      LEFT JOIN staff_members sm
        ON sm.id = pt.assigned_staff_id
       AND sm.tenant_id = pt.tenant_id
      LEFT JOIN users creator ON creator.id = pt.created_by
      LEFT JOIN users updater ON updater.id = pt.updated_by
      WHERE pt.tenant_id = ?
        AND pt.project_id = ?
      ORDER BY
        CASE pt.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        pt.due_date IS NULL,
        pt.due_date ASC,
        pt.id DESC
    `,
    [tenantId, projectId]
  );

  return rows;
}

async function findTask(tenantId, taskId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_tasks
      WHERE tenant_id = ?
        AND id = ?
      LIMIT 1
    `,
    [tenantId, taskId]
  );

  return rows[0] || null;
}

async function createTask(tenantId, projectId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO project_tasks (
        tenant_id,
        project_id,
        assigned_staff_id,
        title,
        description,
        due_date,
        priority,
        status,
        completion_percentage,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      projectId,
      payload.assigned_staff_id,
      payload.title,
      payload.description,
      payload.due_date,
      payload.priority,
      payload.status,
      payload.completion_percentage,
      userId,
      userId
    ]
  );

  return findTask(tenantId, result.insertId, db);
}

async function updateTask(tenantId, taskId, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE project_tasks
      SET
        assigned_staff_id = ?,
        title = ?,
        description = ?,
        due_date = ?,
        priority = ?,
        status = ?,
        completion_percentage = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.assigned_staff_id,
      payload.title,
      payload.description,
      payload.due_date,
      payload.priority,
      payload.status,
      payload.completion_percentage,
      userId,
      tenantId,
      taskId
    ]
  );

  return findTask(tenantId, taskId, db);
}

async function updateTaskStatus(tenantId, taskId, status, completionPercentage, userId, db = pool) {
  await db.query(
    `
      UPDATE project_tasks
      SET
        status = ?,
        completion_percentage = ?,
        updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [status, completionPercentage, userId, tenantId, taskId]
  );

  return findTask(tenantId, taskId, db);
}

async function countActiveByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM projects
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [tenantId]
  );

  return row.total;
}

async function countCompletedByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM projects
      WHERE tenant_id = ?
        AND status = 'completed'
    `,
    [tenantId]
  );

  return row.total;
}

async function countAssignedStaffByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(DISTINCT staff_member_id) AS total
      FROM project_assignments
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [tenantId]
  );

  return row.total;
}

async function countOverdueTasksByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM project_tasks
      WHERE tenant_id = ?
        AND due_date IS NOT NULL
        AND due_date < CURDATE()
        AND status <> 'completed'
    `,
    [tenantId]
  );

  return row.total;
}

async function countIndicatorsByProjectId(tenantId, projectId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM project_indicators
      WHERE tenant_id = ?
        AND project_id = ?
        AND status = 'active'
    `,
    [tenantId, projectId]
  );
  return row.total;
}

module.exports = {
  listProjects,
  findProject,
  createProject,
  updateProject,
  changeProjectStatus,
  existsProjectCode,
  listAssignments,
  findAssignment,
  findActiveAssignment,
  assignStaff,
  removeStaff,
  listTasks,
  findTask,
  createTask,
  updateTask,
  updateTaskStatus,
  countActiveByTenantId,
  countCompletedByTenantId,
  countAssignedStaffByTenantId,
  countOverdueTasksByTenantId,
  countIndicatorsByProjectId
};
