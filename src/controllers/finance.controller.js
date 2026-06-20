const { validationResult } = require("express-validator");
const financeService = require("../services/finance.service");
const budgetService = require("../services/budget.service");
const expenseService = require("../services/expense.service");
const financeRepo = require("../repos/finance.repo");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const {
  buildExpenseFilters,
  buildExpenseFormData,
  getExpenseStatusOptions,
  getPaymentMethodOptions,
  statusBadge,
  formatDate,
  money
} = require("../utils/finance-form");

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

function financeBreadcrumbs(...items) {
  return [{ label: "Dashboard", href: "/dashboard" }, { label: "Finance", href: "/expenses" }, ...items];
}

async function categories(req, res, next) {
  try {
    const filters = {
      search: req.query.search || "",
      category_type: req.query.category_type || "",
      status: req.query.status || ""
    };
    const categoriesList = await financeService.listCategories(req.currentUser.tenant_id, filters);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Finance Categories",
      contentPartial: "../pages/tenant/finance/categories",
      breadcrumbs: financeBreadcrumbs({ label: "Categories" }),
      categories: categoriesList,
      filters,
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/finance/categories");
    }
    await financeService.createCategory(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Finance category created.");
    return res.redirect("/finance/categories");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/finance/categories");
    }
    return next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/finance/categories");
    }
    await financeService.updateCategory(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Finance category updated.");
    return res.redirect("/finance/categories");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/finance/categories");
    }
    return next(error);
  }
}

async function projectBudgets(req, res, next) {
  try {
    const [project, budgetContext, categoriesList] = await Promise.all([
      projectRepo.findProject(req.currentUser.tenant_id, req.params.id),
      budgetService.listProjectBudgets(req.currentUser.tenant_id, req.params.id),
      financeRepo.listCategories(req.currentUser.tenant_id, { category_type: "expense", status: "active" })
    ]);
    if (!project) {
      return renderNotFound(res, "Project Not Found");
    }
    return res.render("layouts/tenant-layout", {
      pageTitle: `Budget - ${project.project_name}`,
      contentPartial: "../pages/tenant/finance/project-budgets",
      breadcrumbs: financeBreadcrumbs({ label: "Projects", href: "/projects" }, { label: project.project_name }),
      project,
      categories: categoriesList,
      ...budgetContext,
      validationErrors: [],
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function saveProjectBudget(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/projects/${req.params.id}/budgets`);
    }
    await budgetService.createOrUpdateProjectBudget(
      req.currentUser.tenant_id,
      { ...req.body, project_id: req.params.id },
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Project budget saved.");
    return res.redirect(`/projects/${req.params.id}/budgets`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/projects/${req.params.id}/budgets`);
    }
    return next(error);
  }
}

async function expenses(req, res, next) {
  try {
    const filters = buildExpenseFilters(req.query);
    const [rows, projects, branches, categoriesList] = await Promise.all([
      expenseService.listExpenses(req.currentUser.tenant_id, filters),
      projectRepo.listProjects(req.currentUser.tenant_id, {}),
      branchRepo.listByTenantId(req.currentUser.tenant_id),
      financeRepo.listCategories(req.currentUser.tenant_id, { category_type: "expense" })
    ]);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Expenses",
      contentPartial: "../pages/tenant/finance/expenses/index",
      breadcrumbs: financeBreadcrumbs({ label: "Expenses" }),
      expenses: rows,
      projects,
      branches,
      categories: categoriesList,
      filters,
      statusOptions: getExpenseStatusOptions(),
      paymentMethodOptions: getPaymentMethodOptions(),
      canCreateExpense: expenseService.CREATE_ROLES.has(req.currentUser.role),
      statusBadge,
      formatDate,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function loadExpenseFormContext(req, formData) {
  const [projects, branches, categoriesList] = await Promise.all([
    projectRepo.listProjects(req.currentUser.tenant_id, {}),
    branchRepo.listByTenantId(req.currentUser.tenant_id),
    financeRepo.listCategories(req.currentUser.tenant_id, { category_type: "expense", status: "active" })
  ]);
  return {
    projects,
    branches,
    categories: categoriesList,
    formData,
    paymentMethodOptions: getPaymentMethodOptions(),
    validationErrors: []
  };
}

async function showCreateExpense(req, res, next) {
  try {
    const context = await loadExpenseFormContext(req, buildExpenseFormData());
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Expense",
      contentPartial: "../pages/tenant/finance/expenses/create",
      breadcrumbs: financeBreadcrumbs({ label: "Expenses", href: "/expenses" }, { label: "Create" }),
      ...context
    });
  } catch (error) {
    return next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const context = await loadExpenseFormContext(req, buildExpenseFormData(req.body));
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Create Expense",
        contentPartial: "../pages/tenant/finance/expenses/create",
        breadcrumbs: financeBreadcrumbs({ label: "Expenses", href: "/expenses" }, { label: "Create" }),
        ...context,
        validationErrors: errors.array()
      });
    }
    const expense = await expenseService.createExpense(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    if (req.file) {
      await addUploadedFile(req, expense.id);
    }
    req.flash("success", "Expense created.");
    return res.redirect(`/expenses/${expense.id}`);
  } catch (error) {
    return next(error);
  }
}

function normalizeUploadedFile(req) {
  if (!req.file) {
    return null;
  }
  const tenantId = req.currentUser.tenant_id;
  return {
    original_name: req.file.originalname,
    stored_name: req.file.filename,
    file_path: `/uploads/expenses/${tenantId}/${req.file.filename}`,
    mime_type: req.file.mimetype,
    file_size: req.file.size
  };
}

async function addUploadedFile(req, expenseId) {
  const file = normalizeUploadedFile(req);
  if (!file) {
    return;
  }
  await expenseService.addAttachment(req.currentUser.tenant_id, expenseId, file, req.currentUser.id, req.ip);
}

async function expenseDetail(req, res, next) {
  try {
    const context = await expenseService.findExpenseById(req.currentUser.tenant_id, req.params.id);
    if (!context) {
      return renderNotFound(res, "Expense Not Found");
    }
    const activity = await auditLogRepo.listTenantEntityAuditLogs(
      req.currentUser.tenant_id,
      "expense",
      context.expense.id,
      50
    );
    return res.render("layouts/tenant-layout", {
      pageTitle: context.expense.expense_code,
      contentPartial: "../pages/tenant/finance/expenses/show",
      breadcrumbs: financeBreadcrumbs({ label: "Expenses", href: "/expenses" }, { label: context.expense.expense_code }),
      ...context,
      activity,
      canApproveExpense: expenseService.APPROVE_ROLES.has(req.currentUser.role),
      canEditExpense: expenseService.CREATE_ROLES.has(req.currentUser.role) && !["approved", "paid"].includes(context.expense.status),
      statusBadge,
      formatDate,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditExpense(req, res, next) {
  try {
    const context = await expenseService.findExpenseById(req.currentUser.tenant_id, req.params.id);
    if (!context) {
      return renderNotFound(res, "Expense Not Found");
    }
    const formContext = await loadExpenseFormContext(req, buildExpenseFormData(context.expense));
    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${context.expense.expense_code}`,
      contentPartial: "../pages/tenant/finance/expenses/edit",
      breadcrumbs: financeBreadcrumbs({ label: "Expenses", href: "/expenses" }, { label: context.expense.expense_code, href: `/expenses/${context.expense.id}` }, { label: "Edit" }),
      expense: context.expense,
      ...formContext
    });
  } catch (error) {
    return next(error);
  }
}

async function updateExpense(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/expenses/${req.params.id}/edit`);
    }
    const expense = await expenseService.updateExpense(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    if (req.file) {
      await addUploadedFile(req, expense.id);
    }
    req.flash("success", "Expense updated.");
    return res.redirect(`/expenses/${expense.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/expenses/${req.params.id}`);
    }
    return next(error);
  }
}

async function transition(req, res, next, action) {
  try {
    const map = {
      submit: () => expenseService.submitExpense(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip),
      approve: () => expenseService.approveExpense(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip),
      reject: () =>
        expenseService.rejectExpense(
          req.currentUser.tenant_id,
          req.params.id,
          req.currentUser.id,
          req.body.rejection_reason,
          req.ip
        ),
      paid: () => expenseService.markExpensePaid(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip),
      cancel: () => expenseService.cancelExpense(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip)
    };
    const expense = await map[action]();
    req.flash("success", `Expense status changed to ${expense.status}.`);
    return res.redirect(`/expenses/${req.params.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/expenses/${req.params.id}`);
    }
    return next(error);
  }
}

async function addAttachment(req, res, next) {
  try {
    if (!req.file) {
      req.flash("error", "Please choose a receipt file.");
      return res.redirect(`/expenses/${req.params.id}`);
    }
    await addUploadedFile(req, req.params.id);
    req.flash("success", "Receipt attachment uploaded.");
    return res.redirect(`/expenses/${req.params.id}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  categories,
  createCategory,
  updateCategory,
  projectBudgets,
  saveProjectBudget,
  expenses,
  showCreateExpense,
  createExpense,
  expenseDetail,
  showEditExpense,
  updateExpense,
  submitExpense: (req, res, next) => transition(req, res, next, "submit"),
  approveExpense: (req, res, next) => transition(req, res, next, "approve"),
  rejectExpense: (req, res, next) => transition(req, res, next, "reject"),
  markExpensePaid: (req, res, next) => transition(req, res, next, "paid"),
  cancelExpense: (req, res, next) => transition(req, res, next, "cancel"),
  addAttachment
};
