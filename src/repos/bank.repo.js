const pool = require("../db/pool");

async function listBankAccounts(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT ba.*, a.account_code AS gl_account_code, a.account_name AS gl_account_name
      FROM bank_accounts ba
      LEFT JOIN chart_of_accounts a ON a.tenant_id = ba.tenant_id AND a.id = ba.linked_gl_account_id
      WHERE ba.tenant_id = ?
      ORDER BY ba.status ASC, ba.account_name ASC
    `,
    [tenantId]
  );
  return rows;
}

async function findBankAccount(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT ba.*, a.account_code AS gl_account_code, a.account_name AS gl_account_name, a.account_type AS gl_account_type
      FROM bank_accounts ba
      LEFT JOIN chart_of_accounts a ON a.tenant_id = ba.tenant_id AND a.id = ba.linked_gl_account_id
      WHERE ba.tenant_id = ? AND ba.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function createBankAccount(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO bank_accounts (
        tenant_id, account_name, bank_name, account_number, currency, linked_gl_account_id,
        opening_balance, status, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.account_name,
      payload.bank_name,
      payload.account_number || null,
      payload.currency || "NLe",
      payload.linked_gl_account_id || null,
      payload.opening_balance || 0,
      payload.status || "active",
      userId || null,
      userId || null
    ]
  );
  return findBankAccount(tenantId, result.insertId, db);
}

async function updateBankAccount(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE bank_accounts
      SET account_name = ?, bank_name = ?, account_number = ?, currency = ?,
          linked_gl_account_id = ?, opening_balance = ?, status = ?, updated_by = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [
      payload.account_name,
      payload.bank_name,
      payload.account_number || null,
      payload.currency || "NLe",
      payload.linked_gl_account_id || null,
      payload.opening_balance || 0,
      payload.status || "active",
      userId || null,
      tenantId,
      id
    ]
  );
  return findBankAccount(tenantId, id, db);
}

async function listBankTransactions(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["bt.tenant_id = ?"];
  if (filters.bank_account_id) {
    where.push("bt.bank_account_id = ?");
    params.push(filters.bank_account_id);
  }
  if (filters.status) {
    where.push("bt.status = ?");
    params.push(filters.status);
  }
  if (filters.transaction_type) {
    where.push("bt.transaction_type = ?");
    params.push(filters.transaction_type);
  }
  if (filters.date_from) {
    where.push("bt.transaction_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("bt.transaction_date <= ?");
    params.push(filters.date_to);
  }

  const [rows] = await db.query(
    `
      SELECT
        bt.*,
        ba.account_name AS bank_account_name,
        offset.account_code AS offset_account_code,
        offset.account_name AS offset_account_name,
        je.journal_number
      FROM bank_transactions bt
      INNER JOIN bank_accounts ba ON ba.tenant_id = bt.tenant_id AND ba.id = bt.bank_account_id
      LEFT JOIN chart_of_accounts offset ON offset.tenant_id = bt.tenant_id AND offset.id = bt.offset_account_id
      LEFT JOIN journal_entries je ON je.tenant_id = bt.tenant_id AND je.id = bt.journal_entry_id
      WHERE ${where.join(" AND ")}
      ORDER BY bt.transaction_date DESC, bt.id DESC
    `,
    params
  );
  return rows;
}

async function findBankTransaction(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        bt.*,
        ba.account_name AS bank_account_name,
        ba.linked_gl_account_id,
        bank_gl.account_code AS bank_gl_account_code,
        bank_gl.account_name AS bank_gl_account_name,
        offset.account_code AS offset_account_code,
        offset.account_name AS offset_account_name,
        offset.account_type AS offset_account_type,
        je.journal_number
      FROM bank_transactions bt
      INNER JOIN bank_accounts ba ON ba.tenant_id = bt.tenant_id AND ba.id = bt.bank_account_id
      LEFT JOIN chart_of_accounts bank_gl ON bank_gl.tenant_id = bt.tenant_id AND bank_gl.id = ba.linked_gl_account_id
      LEFT JOIN chart_of_accounts offset ON offset.tenant_id = bt.tenant_id AND offset.id = bt.offset_account_id
      LEFT JOIN journal_entries je ON je.tenant_id = bt.tenant_id AND je.id = bt.journal_entry_id
      WHERE bt.tenant_id = ? AND bt.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function createBankTransaction(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO bank_transactions (
        tenant_id, bank_account_id, offset_account_id, transaction_date, description,
        transaction_type, amount, reference_number, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.bank_account_id,
      payload.offset_account_id || null,
      payload.transaction_date,
      payload.description,
      payload.transaction_type,
      payload.amount,
      payload.reference_number || null,
      payload.status || "draft",
      userId || null
    ]
  );
  return findBankTransaction(tenantId, result.insertId, db);
}

async function markBankTransactionPosted(tenantId, id, journalEntryId, userId, db = pool) {
  await db.query(
    `
      UPDATE bank_transactions
      SET status = 'posted', journal_entry_id = ?, posted_by = ?, posted_at = NOW()
      WHERE tenant_id = ? AND id = ?
    `,
    [journalEntryId, userId || null, tenantId, id]
  );
  return findBankTransaction(tenantId, id, db);
}

async function markBankTransactionCancelled(tenantId, id, db = pool) {
  await db.query("UPDATE bank_transactions SET status = 'cancelled' WHERE tenant_id = ? AND id = ?", [tenantId, id]);
  return findBankTransaction(tenantId, id, db);
}

module.exports = {
  listBankAccounts,
  findBankAccount,
  createBankAccount,
  updateBankAccount,
  listBankTransactions,
  findBankTransaction,
  createBankTransaction,
  markBankTransactionPosted,
  markBankTransactionCancelled
};
