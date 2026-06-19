const pool = require("../db/pool");
const expenseRepo = require("../repos/expense.repo");
const financeRepo = require("../repos/finance.repo");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const budgetService = require("./budget.service");
const auditLogRepo = require("../repos/audit-log.repo");
const notificationService = require("./notification.service");
const { normalizeNullable } = require("../utils/tenant-form");

const VIEW_ROLES = new Set(["Tenant Admin", "Finance Manager", "Project Manager", "Auditor"]);
const CREATE_ROLES = new Set(["Tenant Admin", "Finance Manager", "Project Manager", "Data Entry Officer"]);
const APPROVE_ROLES = new Set(["Tenant Admin", "Finance Manager"]);

function normalizeExpense(payload) {
  return {
    expense_code: normalizeNullable(payload.expense_code),
    project_id: normalizeNullable(payload.project_id),
    branch_id: normalizeNullable(payload.branch_id),
    category_id: Number(payload.category_id),
    expense_date: payload.expense_date,
    vendor_name: normalizeNullable(payload.vendor_name),
    description: String(payload.description || "").trim(),
    amount: Number(payload.amount || 0),
    payment_method: payload.payment_method,
    receipt_number: normalizeNullable(payload.receipt_number),
    receipt_file_path: normalizeNullable(payload.receipt_file_path),
    status: payload.status || "submitted"
  };
}

async function assertRefs(tenantId, payload, db = pool) {
  if (payload.project_id) {
    const project = await projectRepo.findProject(tenantId, payload.project_id, db);
    if (!project) {
      const error = new Error("Selected project was not found.");
      error.statusCode = 404;
      throw error;
    }
  }
  if (payload.branch_id) {
    const branch = await branchRepo.findByIdForTenant(payload.branch_id, tenantId, db);
    if (!branch) {
      const error = new Error("Selected branch was not found.");
      error.statusCode = 404;
      throw error;
    }
  }
  const category = await financeRepo.findCategoryById(tenantId, payload.category_id, db);
  if (!category || category.category_type !== "expense") {
    const error = new Error("Selected expense category was not found.");
    error.statusCode = 404;
    throw error;
  }
}

async function logAudit(db, tenantId, userId, ipAddress, action, expense) {
  await auditLogRepo.create(
    {
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity_type: "expense",
      entity_id: String(expense.id),
      metadata_json: {
        expense_id: expense.id,
        expense_code: expense.expense_code,
        project_id: expense.project_id,
        category_id: expense.category_id,
        amount: Number(expense.amount || 0),
        status: expense.status
      },
      ip_address: ipAddress
    },
    db
  );
}

async function recalcBudgetsForExpense(tenantId, before, after, db = pool) {
  const touched = new Set();
  for (const expense of [before, after]) {
    if (expense?.project_id && expense?.category_id) {
      touched.add(`${expense.project_id}:${expense.category_id}`);
    }
  }
  for (const key of touched) {
    const [projectId, categoryId] = key.split(":");
    await budgetService.updateSpentAmount(tenantId, projectId, categoryId, db);
  }
}

async function listExpenses(tenantId, filters) {
  return expenseRepo.listExpenses(tenantId, filters);
}

async function findExpenseById(tenantId, id) {
  const expense = await expenseRepo.findExpenseById(tenantId, id);
  if (!expense) {
    return null;
  }
  const attachments = await expenseRepo.listAttachments(tenantId, id);
  return { expense, attachments };
}

async function createExpense(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeExpense(payload);
    await assertRefs(tenantId, normalized, connection);
    normalized.expense_code = normalized.expense_code || (await expenseRepo.generateExpenseCode(tenantId, connection));
    const expense = await expenseRepo.createExpense(tenantId, normalized, userId, connection);
    await recalcBudgetsForExpense(tenantId, null, expense, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "expense.created", expense);
    await connection.commit();
    if (expense.status === "submitted") {
      notificationService.notifyRoles(tenantId, ["Tenant Admin", "Finance Manager"], {
        title: "Expense submitted",
        message: `${expense.expense_code} is waiting for approval.`,
        type: "warning",
        category: "finance",
        link_url: `/expenses/${expense.id}`,
        created_by: userId
      });
    }
    return expense;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateExpense(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await expenseRepo.findExpenseById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }
    if (["approved", "paid"].includes(existing.status)) {
      const error = new Error("Approved or paid expenses cannot be edited.");
      error.statusCode = 422;
      throw error;
    }
    const normalized = normalizeExpense({ ...payload, expense_code: existing.expense_code, status: existing.status });
    await assertRefs(tenantId, normalized, connection);
    const expense = await expenseRepo.updateExpense(tenantId, id, normalized, connection);
    await recalcBudgetsForExpense(tenantId, existing, expense, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "expense.updated", expense);
    await connection.commit();
    return expense;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function transitionExpense(tenantId, id, userId, ipAddress, nextStatus, options = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await expenseRepo.findExpenseById(tenantId, id, connection);
    if (!existing) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }
    if (existing.status === "paid" && nextStatus !== "paid") {
      const error = new Error("Paid expenses cannot be changed.");
      error.statusCode = 422;
      throw error;
    }
    if (options.validStatuses && !options.validStatuses.has(existing.status)) {
      const error = new Error(`Expense cannot be changed from ${existing.status} to ${nextStatus}.`);
      error.statusCode = 422;
      throw error;
    }
    if (nextStatus === "rejected" && !String(options.rejection_reason || "").trim()) {
      const error = new Error("Rejection reason is required.");
      error.statusCode = 422;
      throw error;
    }
    const expense = await expenseRepo.updateStatus(
      tenantId,
      id,
      nextStatus,
      options.userColumn,
      options.dateColumn,
      userId,
      { rejection_reason: options.rejection_reason },
      connection
    );
    await recalcBudgetsForExpense(tenantId, existing, expense, connection);
    await logAudit(connection, tenantId, userId, ipAddress, options.auditAction, expense);
    await connection.commit();
    if (["approved", "rejected", "paid"].includes(nextStatus)) {
      notificationService.safeUserNotification(tenantId, existing.submitted_by, {
        title: `Expense ${nextStatus}`,
        message: `${expense.expense_code} was ${nextStatus}.`,
        type: nextStatus === "rejected" ? "danger" : "success",
        category: "finance",
        link_url: `/expenses/${expense.id}`,
        created_by: userId
      });
    }
    return expense;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submitExpense(tenantId, id, userId, ipAddress) {
  return transitionExpense(tenantId, id, userId, ipAddress, "submitted", {
    userColumn: "submitted_by",
    validStatuses: new Set(["draft", "rejected"]),
    auditAction: "expense.submitted"
  });
}

async function approveExpense(tenantId, id, approverId, ipAddress) {
  return transitionExpense(tenantId, id, approverId, ipAddress, "approved", {
    userColumn: "approved_by",
    dateColumn: "approved_at",
    validStatuses: new Set(["submitted"]),
    auditAction: "expense.approved"
  });
}

async function rejectExpense(tenantId, id, approverId, reason, ipAddress) {
  return transitionExpense(tenantId, id, approverId, ipAddress, "rejected", {
    userColumn: "approved_by",
    dateColumn: "approved_at",
    rejection_reason: reason,
    validStatuses: new Set(["submitted"]),
    auditAction: "expense.rejected"
  });
}

async function markExpensePaid(tenantId, id, userId, ipAddress) {
  return transitionExpense(tenantId, id, userId, ipAddress, "paid", {
    userColumn: "paid_by",
    dateColumn: "paid_at",
    validStatuses: new Set(["approved"]),
    auditAction: "expense.paid"
  });
}

async function cancelExpense(tenantId, id, userId, ipAddress) {
  return transitionExpense(tenantId, id, userId, ipAddress, "cancelled", {
    validStatuses: new Set(["draft", "submitted", "approved", "rejected"]),
    auditAction: "expense.cancelled"
  });
}

async function addAttachment(tenantId, expenseId, file, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const expense = await expenseRepo.findExpenseById(tenantId, expenseId, connection);
    if (!expense) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }
    await expenseRepo.createAttachment(tenantId, expenseId, file, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "expense.attachment_added", expense);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  VIEW_ROLES,
  CREATE_ROLES,
  APPROVE_ROLES,
  listExpenses,
  findExpenseById,
  createExpense,
  updateExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  cancelExpense,
  addAttachment
};
