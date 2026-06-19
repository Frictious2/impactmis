const pool = require("../db/pool");
const budgetRepo = require("../repos/budget.repo");
const financeRepo = require("../repos/finance.repo");
const projectRepo = require("../repos/project.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function normalizeBudget(payload) {
  return {
    project_id: Number(payload.project_id),
    category_id: Number(payload.category_id),
    budget_amount: Number(payload.budget_amount || 0),
    notes: normalizeNullable(payload.notes),
    status: payload.status || "active"
  };
}

async function assertProject(tenantId, projectId, db = pool) {
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }
  return project;
}

async function assertCategory(tenantId, categoryId, db = pool) {
  const category = await financeRepo.findCategoryById(tenantId, categoryId, db);
  if (!category) {
    const error = new Error("Finance category not found.");
    error.statusCode = 404;
    throw error;
  }
  return category;
}

async function listProjectBudgets(tenantId, projectId) {
  await assertProject(tenantId, projectId);
  const [budgets, summary] = await Promise.all([
    budgetRepo.listProjectBudgets(tenantId, projectId),
    budgetRepo.getProjectBudgetSummary(tenantId, projectId)
  ]);
  return { budgets, summary };
}

async function createOrUpdateProjectBudget(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeBudget(payload);
    const project = await assertProject(tenantId, normalized.project_id, connection);
    await assertCategory(tenantId, normalized.category_id, connection);
    let budget = await budgetRepo.findBudgetByProjectCategory(
      tenantId,
      normalized.project_id,
      normalized.category_id,
      connection
    );
    if (budget) {
      budget = await budgetRepo.updateBudget(tenantId, budget.id, normalized, userId, connection);
    } else {
      budget = await budgetRepo.createBudget(tenantId, normalized, userId, connection);
    }
    await budgetRepo.updateSpentAmount(tenantId, normalized.project_id, normalized.category_id, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "project.budget_set",
        entity_type: "project",
        entity_id: String(project.id),
        metadata_json: {
          project_id: project.id,
          category_id: normalized.category_id,
          amount: normalized.budget_amount,
          status: normalized.status
        },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return budget;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSpentAmount(tenantId, projectId, categoryId, db = pool) {
  if (projectId && categoryId) {
    await budgetRepo.updateSpentAmount(tenantId, projectId, categoryId, db);
  }
}

module.exports = { listProjectBudgets, createOrUpdateProjectBudget, updateSpentAmount };
