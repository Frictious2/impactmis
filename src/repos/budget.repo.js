const pool = require("../db/pool");

async function listProjectBudgets(tenantId, projectId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT pb.*, fc.name AS category_name, fc.code AS category_code
      FROM project_budgets pb
      INNER JOIN finance_categories fc
        ON fc.id = pb.category_id
       AND fc.tenant_id = pb.tenant_id
      WHERE pb.tenant_id = ?
        AND pb.project_id = ?
      ORDER BY pb.status ASC, fc.name ASC
    `,
    [tenantId, projectId]
  );
  return rows;
}

async function findBudgetByProjectCategory(tenantId, projectId, categoryId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM project_budgets
      WHERE tenant_id = ?
        AND project_id = ?
        AND category_id = ?
      ORDER BY status = 'active' DESC, id DESC
      LIMIT 1
    `,
    [tenantId, projectId, categoryId]
  );
  return rows[0] || null;
}

async function createBudget(tenantId, payload, userId, db = pool) {
  const activeKey = payload.status === "active" ? `${payload.project_id}:${payload.category_id}` : null;
  const [result] = await db.query(
    `
      INSERT INTO project_budgets (
        tenant_id, project_id, category_id, active_budget_key, budget_amount, spent_amount, notes, status, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.project_id,
      payload.category_id,
      activeKey,
      payload.budget_amount,
      payload.notes,
      payload.status,
      userId || null,
      userId || null
    ]
  );
  return findBudgetById(tenantId, result.insertId, db);
}

async function updateBudget(tenantId, id, payload, userId, db = pool) {
  const activeKey = payload.status === "active" ? `${payload.project_id}:${payload.category_id}` : null;
  await db.query(
    `
      UPDATE project_budgets
      SET active_budget_key = ?, budget_amount = ?, notes = ?, status = ?, updated_by = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [activeKey, payload.budget_amount, payload.notes, payload.status, userId || null, tenantId, id]
  );
  return findBudgetById(tenantId, id, db);
}

async function findBudgetById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM project_budgets WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, id]);
  return rows[0] || null;
}

async function updateSpentAmount(tenantId, projectId, categoryId, db = pool) {
  await db.query(
    `
      UPDATE project_budgets pb
      SET spent_amount = (
        SELECT COALESCE(SUM(e.amount), 0)
        FROM expenses e
        WHERE e.tenant_id = pb.tenant_id
          AND e.project_id = pb.project_id
          AND e.category_id = pb.category_id
          AND e.status IN ('approved', 'paid')
      )
      WHERE pb.tenant_id = ?
        AND pb.project_id = ?
        AND pb.category_id = ?
        AND pb.status = 'active'
    `,
    [tenantId, projectId, categoryId]
  );
}

async function getProjectBudgetSummary(tenantId, projectId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT
        COALESCE(SUM(budget_amount), 0) AS total_budget,
        COALESCE(SUM(spent_amount), 0) AS total_spent
      FROM project_budgets
      WHERE tenant_id = ?
        AND project_id = ?
        AND status = 'active'
    `,
    [tenantId, projectId]
  );
  return {
    total_budget: Number(row.total_budget || 0),
    total_spent: Number(row.total_spent || 0),
    remaining: Number(row.total_budget || 0) - Number(row.total_spent || 0)
  };
}

async function getTenantBudgetUtilization(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT
        COALESCE(SUM(budget_amount), 0) AS total_budget,
        COALESCE(SUM(spent_amount), 0) AS total_spent
      FROM project_budgets
      WHERE tenant_id = ?
        AND status = 'active'
    `,
    [tenantId]
  );
  const totalBudget = Number(row.total_budget || 0);
  const totalSpent = Number(row.total_spent || 0);
  return totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
}

module.exports = {
  listProjectBudgets,
  findBudgetByProjectCategory,
  createBudget,
  updateBudget,
  updateSpentAmount,
  getProjectBudgetSummary,
  getTenantBudgetUtilization
};
