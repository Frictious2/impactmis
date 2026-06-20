const pool = require("../db/pool");
const accountingRepo = require("../repos/accounting.repo");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

const VIEW_ROLES = new Set(["Tenant Admin", "Finance Manager", "Auditor"]);
const MANAGE_ROLES = new Set(["Tenant Admin", "Finance Manager"]);
const ACCOUNT_TYPES = new Set(["asset", "liability", "equity", "income", "expense"]);
const ACCOUNT_STATUSES = new Set(["active", "inactive"]);

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeAccount(payload) {
  return {
    account_code: String(payload.account_code || "").trim().toUpperCase(),
    account_name: String(payload.account_name || "").trim(),
    account_type: payload.account_type,
    parent_account_id: normalizeNullable(payload.parent_account_id),
    description: normalizeNullable(payload.description),
    status: payload.status || "active"
  };
}

async function assertAccountPayload(tenantId, payload, excludeId = null, db = pool) {
  if (!payload.account_code) throw appError("Account code is required.");
  if (!payload.account_name) throw appError("Account name is required.");
  if (!ACCOUNT_TYPES.has(payload.account_type)) throw appError("Select a valid account type.");
  if (!ACCOUNT_STATUSES.has(payload.status)) throw appError("Select a valid account status.");
  if (await accountingRepo.accountCodeExists(tenantId, payload.account_code, excludeId, db)) {
    throw appError("Account code already exists for this tenant.");
  }
  if (payload.parent_account_id) {
    const parent = await accountingRepo.findAccount(tenantId, payload.parent_account_id, db);
    if (!parent) throw appError("Parent account was not found.", 404);
    if (excludeId && Number(payload.parent_account_id) === Number(excludeId)) {
      throw appError("An account cannot be its own parent.");
    }
  }
}

function normalizeLines(rawLines) {
  const source = Array.isArray(rawLines) ? rawLines : Object.values(rawLines || {});
  return source
    .map((line) => ({
      account_id: Number(line.account_id || 0),
      description: normalizeNullable(line.description),
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      project_id: normalizeNullable(line.project_id),
      branch_id: normalizeNullable(line.branch_id)
    }))
    .filter((line) => line.account_id || line.debit || line.credit || line.description);
}

async function assertJournalLines(tenantId, lines, db = pool) {
  if (lines.length < 2) throw appError("Journal entries require at least two lines.");
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    if (!line.account_id) throw appError("Each journal line must include an account.");
    if (line.debit < 0 || line.credit < 0) throw appError("Debit and credit values cannot be negative.");
    if (line.debit > 0 && line.credit > 0) throw appError("A journal line cannot have both debit and credit.");
    if (line.debit === 0 && line.credit === 0) throw appError("Each journal line needs either a debit or credit amount.");
    const account = await accountingRepo.findAccount(tenantId, line.account_id, db);
    if (!account) throw appError("One or more selected accounts were not found.", 404);
    if (line.project_id) {
      const project = await projectRepo.findProject(tenantId, line.project_id, db);
      if (!project) throw appError("One or more selected projects were not found.", 404);
    }
    if (line.branch_id) {
      const branch = await branchRepo.findByIdForTenant(line.branch_id, tenantId, db);
      if (!branch) throw appError("One or more selected branches were not found.", 404);
    }
    totalDebit += Number(line.debit || 0);
    totalCredit += Number(line.credit || 0);
  }
  if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
    throw appError("Journal entries must balance before they can be saved or posted.");
  }
  if (totalDebit <= 0) throw appError("Journal totals must be greater than zero.");
  return { totalDebit, totalCredit };
}

async function logAccounting(db, tenantId, userId, ipAddress, action, entityType, entityId, metadata = {}) {
  await auditLogRepo.create(
    {
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      metadata_json: metadata,
      ip_address: ipAddress
    },
    db
  );
}

async function listAccounts(tenantId, filters) {
  return accountingRepo.listAccounts(tenantId, filters);
}

async function findAccount(tenantId, id) {
  return accountingRepo.findAccount(tenantId, id);
}

async function createAccount(tenantId, payload, userId, ipAddress) {
  const normalized = normalizeAccount(payload);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await assertAccountPayload(tenantId, normalized, null, db);
    const account = await accountingRepo.createAccount(tenantId, normalized, userId, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.account_created", "chart_of_account", account.id, {
      account_id: account.id,
      account_code: account.account_code
    });
    await db.commit();
    return account;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function updateAccount(tenantId, id, payload, userId, ipAddress) {
  const normalized = normalizeAccount(payload);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const existing = await accountingRepo.findAccount(tenantId, id, db);
    if (!existing) throw appError("Account was not found.", 404);
    await assertAccountPayload(tenantId, normalized, id, db);
    const account = await accountingRepo.updateAccount(tenantId, id, normalized, userId, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.account_updated", "chart_of_account", account.id, {
      account_id: account.id,
      account_code: account.account_code
    });
    await db.commit();
    return account;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function listJournals(tenantId, filters) {
  return accountingRepo.listJournals(tenantId, filters);
}

async function findJournal(tenantId, id) {
  const journal = await accountingRepo.findJournalWithTotals(tenantId, id);
  if (!journal) return null;
  const lines = await accountingRepo.listJournalLines(tenantId, id);
  return { journal, lines };
}

async function createJournal(tenantId, payload, rawLines, userId, ipAddress, dbOverride = null) {
  const lines = normalizeLines(rawLines);
  const db = dbOverride || (await pool.getConnection());
  const ownsConnection = !dbOverride;
  try {
    if (ownsConnection) await db.beginTransaction();
    await assertJournalLines(tenantId, lines, db);
    const journal = await accountingRepo.createJournal(
      tenantId,
      {
        journal_date: payload.journal_date,
        description: String(payload.description || "").trim(),
        source_module: normalizeNullable(payload.source_module),
        source_id: normalizeNullable(payload.source_id),
        status: payload.status || "draft"
      },
      userId,
      db
    );
    await accountingRepo.replaceJournalLines(tenantId, journal.id, lines, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.journal_created", "journal_entry", journal.id, {
      journal_entry_id: journal.id,
      journal_number: journal.journal_number
    });
    if (ownsConnection) await db.commit();
    return accountingRepo.findJournalWithTotals(tenantId, journal.id, db);
  } catch (error) {
    if (ownsConnection) await db.rollback();
    throw error;
  } finally {
    if (ownsConnection) db.release();
  }
}

async function updateJournal(tenantId, id, payload, rawLines, userId, ipAddress) {
  const lines = normalizeLines(rawLines);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const existing = await accountingRepo.findJournal(tenantId, id, db);
    if (!existing) throw appError("Journal entry was not found.", 404);
    if (existing.status !== "draft") throw appError("Only draft journals can be edited.");
    await assertJournalLines(tenantId, lines, db);
    const journal = await accountingRepo.updateJournal(
      tenantId,
      id,
      {
        journal_date: payload.journal_date,
        description: String(payload.description || "").trim(),
        source_module: normalizeNullable(payload.source_module),
        source_id: normalizeNullable(payload.source_id)
      },
      db
    );
    await accountingRepo.replaceJournalLines(tenantId, id, lines, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.journal_updated", "journal_entry", id, {
      journal_entry_id: id,
      journal_number: journal.journal_number
    });
    await db.commit();
    return journal;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function postJournal(tenantId, id, userId, ipAddress, dbOverride = null) {
  const db = dbOverride || (await pool.getConnection());
  const ownsConnection = !dbOverride;
  try {
    if (ownsConnection) await db.beginTransaction();
    const journal = await accountingRepo.findJournal(tenantId, id, db);
    if (!journal) throw appError("Journal entry was not found.", 404);
    if (journal.status === "posted") throw appError("Journal is already posted.");
    if (journal.status === "cancelled") throw appError("Cancelled journals cannot be posted.");
    const lines = await accountingRepo.listJournalLines(tenantId, id, db);
    await assertJournalLines(tenantId, lines, db);
    const posted = await accountingRepo.markJournalPosted(tenantId, id, userId, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.journal_posted", "journal_entry", id, {
      journal_entry_id: id,
      journal_number: posted.journal_number
    });
    if (ownsConnection) await db.commit();
    return posted;
  } catch (error) {
    if (ownsConnection) await db.rollback();
    throw error;
  } finally {
    if (ownsConnection) db.release();
  }
}

async function cancelJournal(tenantId, id, userId, ipAddress, dbOverride = null) {
  const db = dbOverride || (await pool.getConnection());
  const ownsConnection = !dbOverride;
  try {
    if (ownsConnection) await db.beginTransaction();
    const journal = await accountingRepo.findJournal(tenantId, id, db);
    if (!journal) throw appError("Journal entry was not found.", 404);
    if (journal.status === "cancelled") throw appError("Journal is already cancelled.");
    const cancelled = await accountingRepo.markJournalCancelled(tenantId, id, userId, db);
    await logAccounting(db, tenantId, userId, ipAddress, "accounting.journal_cancelled", "journal_entry", id, {
      journal_entry_id: id,
      journal_number: cancelled.journal_number
    });
    if (ownsConnection) await db.commit();
    return cancelled;
  } catch (error) {
    if (ownsConnection) await db.rollback();
    throw error;
  } finally {
    if (ownsConnection) db.release();
  }
}

function mapTrialBalance(rows) {
  return rows.map((row) => {
    const debitTotal = Number(row.debit_total || 0);
    const creditTotal = Number(row.credit_total || 0);
    const balance = ["asset", "expense"].includes(row.account_type) ? debitTotal - creditTotal : creditTotal - debitTotal;
    return {
      ...row,
      debit_balance: balance >= 0 ? balance : 0,
      credit_balance: balance < 0 ? Math.abs(balance) : 0
    };
  });
}

async function getTrialBalance(tenantId) {
  return mapTrialBalance(await accountingRepo.getTrialBalance(tenantId));
}

async function getIncomeStatement(tenantId) {
  const rows = await accountingRepo.getStatementRows(tenantId, ["income", "expense"]);
  const income = rows
    .filter((row) => row.account_type === "income")
    .map((row) => ({ ...row, amount: Number(row.credit_total || 0) - Number(row.debit_total || 0) }));
  const expenses = rows
    .filter((row) => row.account_type === "expense")
    .map((row) => ({ ...row, amount: Number(row.debit_total || 0) - Number(row.credit_total || 0) }));
  const totalIncome = income.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);
  return { income, expenses, totalIncome, totalExpenses, netSurplus: totalIncome - totalExpenses };
}

async function getBalanceSheet(tenantId) {
  const rows = await accountingRepo.getStatementRows(tenantId, ["asset", "liability", "equity"]);
  const assets = rows
    .filter((row) => row.account_type === "asset")
    .map((row) => ({ ...row, amount: Number(row.debit_total || 0) - Number(row.credit_total || 0) }));
  const liabilities = rows
    .filter((row) => row.account_type === "liability")
    .map((row) => ({ ...row, amount: Number(row.credit_total || 0) - Number(row.debit_total || 0) }));
  const equity = rows
    .filter((row) => row.account_type === "equity")
    .map((row) => ({ ...row, amount: Number(row.credit_total || 0) - Number(row.debit_total || 0) }));
  return {
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((sum, row) => sum + row.amount, 0),
    totalLiabilities: liabilities.reduce((sum, row) => sum + row.amount, 0),
    totalEquity: equity.reduce((sum, row) => sum + row.amount, 0)
  };
}

module.exports = {
  VIEW_ROLES,
  MANAGE_ROLES,
  ACCOUNT_TYPES,
  listAccounts,
  findAccount,
  createAccount,
  updateAccount,
  listJournals,
  findJournal,
  createJournal,
  updateJournal,
  postJournal,
  cancelJournal,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  logAccounting
};
