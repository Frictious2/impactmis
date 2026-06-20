const pool = require("../db/pool");
const bankRepo = require("../repos/bank.repo");
const accountingRepo = require("../repos/accounting.repo");
const accountingService = require("./accounting.service");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeBankAccount(payload) {
  return {
    account_name: String(payload.account_name || "").trim(),
    bank_name: String(payload.bank_name || "").trim(),
    account_number: normalizeNullable(payload.account_number),
    currency: String(payload.currency || "NLe").trim(),
    linked_gl_account_id: normalizeNullable(payload.linked_gl_account_id),
    opening_balance: Number(payload.opening_balance || 0),
    status: payload.status || "active"
  };
}

function normalizeBankTransaction(payload) {
  return {
    bank_account_id: Number(payload.bank_account_id || 0),
    offset_account_id: normalizeNullable(payload.offset_account_id),
    transaction_date: payload.transaction_date,
    description: String(payload.description || "").trim(),
    transaction_type: payload.transaction_type,
    amount: Number(payload.amount || 0),
    reference_number: normalizeNullable(payload.reference_number),
    status: payload.status || "draft"
  };
}

async function assertLinkedAssetAccount(tenantId, accountId, db = pool) {
  if (!accountId) throw appError("Select a linked GL bank account.");
  const account = await accountingRepo.findAccount(tenantId, accountId, db);
  if (!account || account.account_type !== "asset") throw appError("Linked GL account must be an asset account.", 404);
  return account;
}

async function assertOffsetAccount(tenantId, transactionType, accountId, db = pool) {
  if (!accountId) throw appError("Select the offset GL account for posting.");
  const account = await accountingRepo.findAccount(tenantId, accountId, db);
  if (!account) throw appError("Offset GL account was not found.", 404);
  const allowed = {
    deposit: new Set(["income", "liability", "equity"]),
    withdrawal: new Set(["expense", "asset"]),
    transfer: new Set(["asset"])
  }[transactionType];
  if (!allowed || !allowed.has(account.account_type)) {
    throw appError("Selected offset account type is not valid for this bank transaction.");
  }
  return account;
}

async function logBank(db, tenantId, userId, ipAddress, action, entityType, entityId, metadata = {}) {
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

async function listBankAccounts(tenantId) {
  return bankRepo.listBankAccounts(tenantId);
}

async function findBankAccount(tenantId, id) {
  return bankRepo.findBankAccount(tenantId, id);
}

async function createBankAccount(tenantId, payload, userId, ipAddress) {
  const normalized = normalizeBankAccount(payload);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    if (!normalized.account_name) throw appError("Account name is required.");
    if (!normalized.bank_name) throw appError("Bank name is required.");
    if (normalized.opening_balance < 0) throw appError("Opening balance cannot be negative.");
    await assertLinkedAssetAccount(tenantId, normalized.linked_gl_account_id, db);
    const account = await bankRepo.createBankAccount(tenantId, normalized, userId, db);
    await logBank(db, tenantId, userId, ipAddress, "accounting.bank_account_created", "bank_account", account.id, {
      bank_account_id: account.id
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

async function updateBankAccount(tenantId, id, payload, userId, ipAddress) {
  const normalized = normalizeBankAccount(payload);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const existing = await bankRepo.findBankAccount(tenantId, id, db);
    if (!existing) throw appError("Bank account was not found.", 404);
    if (!normalized.account_name) throw appError("Account name is required.");
    if (!normalized.bank_name) throw appError("Bank name is required.");
    if (normalized.opening_balance < 0) throw appError("Opening balance cannot be negative.");
    await assertLinkedAssetAccount(tenantId, normalized.linked_gl_account_id, db);
    const account = await bankRepo.updateBankAccount(tenantId, id, normalized, userId, db);
    await logBank(db, tenantId, userId, ipAddress, "accounting.bank_account_updated", "bank_account", account.id, {
      bank_account_id: account.id
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

async function listBankTransactions(tenantId, filters) {
  return bankRepo.listBankTransactions(tenantId, filters);
}

async function findBankTransaction(tenantId, id) {
  return bankRepo.findBankTransaction(tenantId, id);
}

async function createBankTransaction(tenantId, payload, userId, ipAddress) {
  const normalized = normalizeBankTransaction(payload);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const bankAccount = await bankRepo.findBankAccount(tenantId, normalized.bank_account_id, db);
    if (!bankAccount) throw appError("Bank account was not found.", 404);
    if (!normalized.description) throw appError("Description is required.");
    if (!["deposit", "withdrawal", "transfer"].includes(normalized.transaction_type)) {
      throw appError("Select a valid transaction type.");
    }
    if (normalized.amount <= 0) throw appError("Amount must be greater than zero.");
    await assertOffsetAccount(tenantId, normalized.transaction_type, normalized.offset_account_id, db);
    const transaction = await bankRepo.createBankTransaction(tenantId, normalized, userId, db);
    await logBank(
      db,
      tenantId,
      userId,
      ipAddress,
      "accounting.bank_transaction_created",
      "bank_transaction",
      transaction.id,
      { bank_transaction_id: transaction.id, amount: transaction.amount }
    );
    await db.commit();
    return transaction;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function postBankTransaction(tenantId, id, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const transaction = await bankRepo.findBankTransaction(tenantId, id, db);
    if (!transaction) throw appError("Bank transaction was not found.", 404);
    if (transaction.status === "posted") throw appError("Bank transaction is already posted.");
    if (transaction.status === "cancelled") throw appError("Cancelled bank transactions cannot be posted.");
    const bankAccount = await bankRepo.findBankAccount(tenantId, transaction.bank_account_id, db);
    await assertLinkedAssetAccount(tenantId, bankAccount.linked_gl_account_id, db);
    const offset = await assertOffsetAccount(tenantId, transaction.transaction_type, transaction.offset_account_id, db);
    const bankLine = {
      account_id: bankAccount.linked_gl_account_id,
      description: transaction.description,
      debit: transaction.transaction_type === "deposit" ? transaction.amount : 0,
      credit: transaction.transaction_type === "deposit" ? 0 : transaction.amount
    };
    const offsetLine = {
      account_id: offset.id,
      description: transaction.description,
      debit: transaction.transaction_type === "deposit" ? 0 : transaction.amount,
      credit: transaction.transaction_type === "deposit" ? transaction.amount : 0
    };
    const journal = await accountingService.createJournal(
      tenantId,
      {
        journal_date: transaction.transaction_date,
        description: `Bank ${transaction.transaction_type}: ${transaction.description}`,
        source_module: "bank_transaction",
        source_id: transaction.id,
        status: "draft"
      },
      [bankLine, offsetLine],
      userId,
      ipAddress,
      db
    );
    await accountingService.postJournal(tenantId, journal.id, userId, ipAddress, db);
    const posted = await bankRepo.markBankTransactionPosted(tenantId, id, journal.id, userId, db);
    await logBank(db, tenantId, userId, ipAddress, "accounting.bank_transaction_posted", "bank_transaction", id, {
      bank_transaction_id: id,
      journal_entry_id: journal.id,
      amount: transaction.amount
    });
    await db.commit();
    return posted;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function cancelBankTransaction(tenantId, id, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const transaction = await bankRepo.findBankTransaction(tenantId, id, db);
    if (!transaction) throw appError("Bank transaction was not found.", 404);
    if (transaction.status === "cancelled") throw appError("Bank transaction is already cancelled.");
    if (transaction.journal_entry_id) {
      await accountingService.cancelJournal(tenantId, transaction.journal_entry_id, userId, ipAddress, db);
    }
    const cancelled = await bankRepo.markBankTransactionCancelled(tenantId, id, db);
    await logBank(db, tenantId, userId, ipAddress, "accounting.bank_transaction_cancelled", "bank_transaction", id, {
      bank_transaction_id: id,
      journal_entry_id: transaction.journal_entry_id
    });
    await db.commit();
    return cancelled;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

module.exports = {
  listBankAccounts,
  findBankAccount,
  createBankAccount,
  updateBankAccount,
  listBankTransactions,
  findBankTransaction,
  createBankTransaction,
  postBankTransaction,
  cancelBankTransaction
};
