const { validationResult } = require("express-validator");
const accountingService = require("../services/accounting.service");
const bankService = require("../services/bank.service");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const {
  accountTypes,
  statusOptions,
  journalStatusOptions,
  transactionTypes,
  money,
  formatDate,
  statusBadge,
  accountTypeLabel
} = require("../utils/accounting-form");

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

function accountingBreadcrumbs(...items) {
  return [{ label: "Dashboard", href: "/dashboard" }, { label: "Accounting", href: "/accounting/accounts" }, ...items];
}

function handleKnownError(req, res, error, fallbackUrl, next) {
  if (error.statusCode) {
    req.flash("error", error.message);
    return res.redirect(fallbackUrl);
  }
  return next(error);
}

async function getFormRefs(tenantId) {
  const [accounts, projects, branches] = await Promise.all([
    accountingService.listAccounts(tenantId, { status: "active" }),
    projectRepo.listProjects(tenantId, {}),
    branchRepo.listByTenantId(tenantId)
  ]);
  return { accounts, projects, branches };
}

async function accounts(req, res, next) {
  try {
    const filters = {
      search: req.query.search || "",
      account_type: req.query.account_type || "",
      status: req.query.status || ""
    };
    const rows = await accountingService.listAccounts(req.currentUser.tenant_id, filters);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Chart of Accounts",
      contentPartial: "../pages/tenant/accounting/accounts/index",
      breadcrumbs: accountingBreadcrumbs({ label: "Chart of Accounts" }),
      accounts: rows,
      filters,
      accountTypes,
      statusOptions,
      statusBadge,
      accountTypeLabel
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateAccount(req, res, next) {
  try {
    const parentAccounts = await accountingService.listAccounts(req.currentUser.tenant_id, {});
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Account",
      contentPartial: "../pages/tenant/accounting/accounts/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Chart of Accounts", href: "/accounting/accounts" }, { label: "Create" }),
      account: {},
      parentAccounts,
      accountTypes,
      statusOptions,
      formAction: "/accounting/accounts"
    });
  } catch (error) {
    return next(error);
  }
}

async function createAccount(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/accounting/accounts/create");
    }
    await accountingService.createAccount(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Account created.");
    return res.redirect("/accounting/accounts");
  } catch (error) {
    return handleKnownError(req, res, error, "/accounting/accounts/create", next);
  }
}

async function showEditAccount(req, res, next) {
  try {
    const [account, parentAccounts] = await Promise.all([
      accountingService.findAccount(req.currentUser.tenant_id, req.params.id),
      accountingService.listAccounts(req.currentUser.tenant_id, {})
    ]);
    if (!account) return renderNotFound(res, "Account Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: "Edit Account",
      contentPartial: "../pages/tenant/accounting/accounts/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Chart of Accounts", href: "/accounting/accounts" }, { label: "Edit" }),
      account,
      parentAccounts: parentAccounts.filter((row) => Number(row.id) !== Number(account.id)),
      accountTypes,
      statusOptions,
      formAction: `/accounting/accounts/${account.id}/edit`
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAccount(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/accounting/accounts/${req.params.id}/edit`);
    }
    await accountingService.updateAccount(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Account updated.");
    return res.redirect("/accounting/accounts");
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/accounts/${req.params.id}/edit`, next);
  }
}

async function journals(req, res, next) {
  try {
    const filters = {
      search: req.query.search || "",
      status: req.query.status || "",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || ""
    };
    const rows = await accountingService.listJournals(req.currentUser.tenant_id, filters);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Journal Entries",
      contentPartial: "../pages/tenant/accounting/journals/index",
      breadcrumbs: accountingBreadcrumbs({ label: "Journals" }),
      journals: rows,
      filters,
      journalStatusOptions,
      statusBadge,
      money,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateJournal(req, res, next) {
  try {
    const refs = await getFormRefs(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Journal",
      contentPartial: "../pages/tenant/accounting/journals/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Journals", href: "/accounting/journals" }, { label: "Create" }),
      journal: { journal_date: new Date() },
      lines: [{}, {}],
      formAction: "/accounting/journals",
      ...refs,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function createJournal(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/accounting/journals/create");
    }
    const journal = await accountingService.createJournal(req.currentUser.tenant_id, req.body, req.body.lines, req.currentUser.id, req.ip);
    req.flash("success", "Journal entry created.");
    return res.redirect(`/accounting/journals/${journal.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, "/accounting/journals/create", next);
  }
}

async function journalDetail(req, res, next) {
  try {
    const data = await accountingService.findJournal(req.currentUser.tenant_id, req.params.id);
    if (!data) return renderNotFound(res, "Journal Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: data.journal.journal_number,
      contentPartial: "../pages/tenant/accounting/journals/show",
      breadcrumbs: accountingBreadcrumbs({ label: "Journals", href: "/accounting/journals" }, { label: data.journal.journal_number }),
      ...data,
      statusBadge,
      money,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditJournal(req, res, next) {
  try {
    const data = await accountingService.findJournal(req.currentUser.tenant_id, req.params.id);
    if (!data) return renderNotFound(res, "Journal Not Found");
    if (data.journal.status !== "draft") {
      req.flash("error", "Only draft journals can be edited.");
      return res.redirect(`/accounting/journals/${req.params.id}`);
    }
    const refs = await getFormRefs(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Edit Journal",
      contentPartial: "../pages/tenant/accounting/journals/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Journals", href: "/accounting/journals" }, { label: "Edit" }),
      journal: data.journal,
      lines: data.lines,
      formAction: `/accounting/journals/${data.journal.id}/edit`,
      ...refs,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function updateJournal(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/accounting/journals/${req.params.id}/edit`);
    }
    await accountingService.updateJournal(req.currentUser.tenant_id, req.params.id, req.body, req.body.lines, req.currentUser.id, req.ip);
    req.flash("success", "Journal entry updated.");
    return res.redirect(`/accounting/journals/${req.params.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/journals/${req.params.id}/edit`, next);
  }
}

async function postJournal(req, res, next) {
  try {
    await accountingService.postJournal(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", "Journal entry posted.");
    return res.redirect(`/accounting/journals/${req.params.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/journals/${req.params.id}`, next);
  }
}

async function cancelJournal(req, res, next) {
  try {
    await accountingService.cancelJournal(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", "Journal entry cancelled.");
    return res.redirect(`/accounting/journals/${req.params.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/journals/${req.params.id}`, next);
  }
}

async function bankAccounts(req, res, next) {
  try {
    const rows = await bankService.listBankAccounts(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Bank Accounts",
      contentPartial: "../pages/tenant/accounting/bank-accounts/index",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Accounts" }),
      bankAccounts: rows,
      statusBadge,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateBankAccount(req, res, next) {
  try {
    const accounts = await accountingService.listAccounts(req.currentUser.tenant_id, { account_type: "asset", status: "active" });
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Bank Account",
      contentPartial: "../pages/tenant/accounting/bank-accounts/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Accounts", href: "/accounting/bank-accounts" }, { label: "Create" }),
      bankAccount: {},
      accounts,
      statusOptions,
      formAction: "/accounting/bank-accounts"
    });
  } catch (error) {
    return next(error);
  }
}

async function createBankAccount(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/accounting/bank-accounts/create");
    }
    await bankService.createBankAccount(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Bank account created.");
    return res.redirect("/accounting/bank-accounts");
  } catch (error) {
    return handleKnownError(req, res, error, "/accounting/bank-accounts/create", next);
  }
}

async function showEditBankAccount(req, res, next) {
  try {
    const [bankAccount, accounts] = await Promise.all([
      bankService.findBankAccount(req.currentUser.tenant_id, req.params.id),
      accountingService.listAccounts(req.currentUser.tenant_id, { account_type: "asset", status: "active" })
    ]);
    if (!bankAccount) return renderNotFound(res, "Bank Account Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: "Edit Bank Account",
      contentPartial: "../pages/tenant/accounting/bank-accounts/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Accounts", href: "/accounting/bank-accounts" }, { label: "Edit" }),
      bankAccount,
      accounts,
      statusOptions,
      formAction: `/accounting/bank-accounts/${bankAccount.id}/edit`
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBankAccount(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/accounting/bank-accounts/${req.params.id}/edit`);
    }
    await bankService.updateBankAccount(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Bank account updated.");
    return res.redirect("/accounting/bank-accounts");
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/bank-accounts/${req.params.id}/edit`, next);
  }
}

async function bankTransactions(req, res, next) {
  try {
    const filters = {
      bank_account_id: req.query.bank_account_id || "",
      transaction_type: req.query.transaction_type || "",
      status: req.query.status || "",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || ""
    };
    const [rows, bankAccountsList] = await Promise.all([
      bankService.listBankTransactions(req.currentUser.tenant_id, filters),
      bankService.listBankAccounts(req.currentUser.tenant_id)
    ]);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Bank Transactions",
      contentPartial: "../pages/tenant/accounting/bank-transactions/index",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Transactions" }),
      transactions: rows,
      bankAccounts: bankAccountsList,
      transactionTypes,
      journalStatusOptions,
      filters,
      statusBadge,
      money,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateBankTransaction(req, res, next) {
  try {
    const [bankAccountsList, accounts] = await Promise.all([
      bankService.listBankAccounts(req.currentUser.tenant_id),
      accountingService.listAccounts(req.currentUser.tenant_id, { status: "active" })
    ]);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Bank Transaction",
      contentPartial: "../pages/tenant/accounting/bank-transactions/form",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Transactions", href: "/accounting/bank-transactions" }, { label: "Create" }),
      transaction: { transaction_date: new Date() },
      bankAccounts: bankAccountsList,
      accounts,
      transactionTypes,
      formAction: "/accounting/bank-transactions",
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function createBankTransaction(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/accounting/bank-transactions/create");
    }
    const transaction = await bankService.createBankTransaction(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Bank transaction created.");
    return res.redirect(`/accounting/bank-transactions/${transaction.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, "/accounting/bank-transactions/create", next);
  }
}

async function bankTransactionDetail(req, res, next) {
  try {
    const transaction = await bankService.findBankTransaction(req.currentUser.tenant_id, req.params.id);
    if (!transaction) return renderNotFound(res, "Bank Transaction Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: "Bank Transaction",
      contentPartial: "../pages/tenant/accounting/bank-transactions/show",
      breadcrumbs: accountingBreadcrumbs({ label: "Bank Transactions", href: "/accounting/bank-transactions" }, { label: transaction.reference_number || `#${transaction.id}` }),
      transaction,
      statusBadge,
      money,
      formatDate
    });
  } catch (error) {
    return next(error);
  }
}

async function postBankTransaction(req, res, next) {
  try {
    await bankService.postBankTransaction(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", "Bank transaction posted and journal entry created.");
    return res.redirect(`/accounting/bank-transactions/${req.params.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/bank-transactions/${req.params.id}`, next);
  }
}

async function cancelBankTransaction(req, res, next) {
  try {
    await bankService.cancelBankTransaction(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", "Bank transaction cancelled.");
    return res.redirect(`/accounting/bank-transactions/${req.params.id}`);
  } catch (error) {
    return handleKnownError(req, res, error, `/accounting/bank-transactions/${req.params.id}`, next);
  }
}

async function trialBalance(req, res, next) {
  try {
    const rows = await accountingService.getTrialBalance(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Trial Balance",
      contentPartial: "../pages/tenant/accounting/statements/trial-balance",
      breadcrumbs: accountingBreadcrumbs({ label: "Trial Balance" }),
      rows,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function incomeStatement(req, res, next) {
  try {
    const statement = await accountingService.getIncomeStatement(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Income Statement",
      contentPartial: "../pages/tenant/accounting/statements/income-statement",
      breadcrumbs: accountingBreadcrumbs({ label: "Income Statement" }),
      ...statement,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function balanceSheet(req, res, next) {
  try {
    const statement = await accountingService.getBalanceSheet(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Balance Sheet",
      contentPartial: "../pages/tenant/accounting/statements/balance-sheet",
      breadcrumbs: accountingBreadcrumbs({ label: "Balance Sheet" }),
      ...statement,
      money
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  accounts,
  showCreateAccount,
  createAccount,
  showEditAccount,
  updateAccount,
  journals,
  showCreateJournal,
  createJournal,
  journalDetail,
  showEditJournal,
  updateJournal,
  postJournal,
  cancelJournal,
  bankAccounts,
  showCreateBankAccount,
  createBankAccount,
  showEditBankAccount,
  updateBankAccount,
  bankTransactions,
  showCreateBankTransaction,
  createBankTransaction,
  bankTransactionDetail,
  postBankTransaction,
  cancelBankTransaction,
  trialBalance,
  incomeStatement,
  balanceSheet
};
