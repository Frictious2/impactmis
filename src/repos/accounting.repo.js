const pool = require("../db/pool");

async function listAccounts(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["a.tenant_id = ?"];
  if (filters.account_type) {
    where.push("a.account_type = ?");
    params.push(filters.account_type);
  }
  if (filters.status) {
    where.push("a.status = ?");
    params.push(filters.status);
  }
  if (filters.search) {
    where.push("(a.account_code LIKE ? OR a.account_name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const [rows] = await db.query(
    `
      SELECT a.*, p.account_name AS parent_account_name, p.account_code AS parent_account_code
      FROM chart_of_accounts a
      LEFT JOIN chart_of_accounts p ON p.tenant_id = a.tenant_id AND p.id = a.parent_account_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.account_code ASC, a.account_name ASC
    `,
    params
  );
  return rows;
}

async function findAccount(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT a.*, p.account_name AS parent_account_name, p.account_code AS parent_account_code
      FROM chart_of_accounts a
      LEFT JOIN chart_of_accounts p ON p.tenant_id = a.tenant_id AND p.id = a.parent_account_id
      WHERE a.tenant_id = ? AND a.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function accountCodeExists(tenantId, accountCode, excludeId = null, db = pool) {
  const params = [tenantId, accountCode];
  let sql = "SELECT id FROM chart_of_accounts WHERE tenant_id = ? AND account_code = ?";
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function createAccount(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO chart_of_accounts (
        tenant_id, account_code, account_name, account_type, parent_account_id,
        description, status, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.account_code,
      payload.account_name,
      payload.account_type,
      payload.parent_account_id || null,
      payload.description || null,
      payload.status || "active",
      userId || null,
      userId || null
    ]
  );
  return findAccount(tenantId, result.insertId, db);
}

async function updateAccount(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE chart_of_accounts
      SET account_code = ?, account_name = ?, account_type = ?, parent_account_id = ?,
          description = ?, status = ?, updated_by = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [
      payload.account_code,
      payload.account_name,
      payload.account_type,
      payload.parent_account_id || null,
      payload.description || null,
      payload.status || "active",
      userId || null,
      tenantId,
      id
    ]
  );
  return findAccount(tenantId, id, db);
}

async function getNextJournalNumber(tenantId, db = pool) {
  const year = new Date().getFullYear();
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM journal_entries WHERE tenant_id = ? AND journal_number LIKE ?",
    [tenantId, `JRN-${year}-%`]
  );
  return `JRN-${year}-${String(Number(row.total || 0) + 1).padStart(5, "0")}`;
}

async function listJournals(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["j.tenant_id = ?"];
  if (filters.status) {
    where.push("j.status = ?");
    params.push(filters.status);
  }
  if (filters.date_from) {
    where.push("j.journal_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("j.journal_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.search) {
    where.push("(j.journal_number LIKE ? OR j.description LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const [rows] = await db.query(
    `
      SELECT
        j.*,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM journal_entries j
      LEFT JOIN journal_entry_lines l ON l.tenant_id = j.tenant_id AND l.journal_entry_id = j.id
      WHERE ${where.join(" AND ")}
      GROUP BY j.id
      ORDER BY j.journal_date DESC, j.id DESC
    `,
    params
  );
  return rows;
}

async function findJournal(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM journal_entries WHERE tenant_id = ? AND id = ? LIMIT 1", [
    tenantId,
    id
  ]);
  return rows[0] || null;
}

async function findJournalWithTotals(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        j.*,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM journal_entries j
      LEFT JOIN journal_entry_lines l ON l.tenant_id = j.tenant_id AND l.journal_entry_id = j.id
      WHERE j.tenant_id = ? AND j.id = ?
      GROUP BY j.id
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function listJournalLines(tenantId, journalId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        l.*,
        a.account_code,
        a.account_name,
        a.account_type,
        p.project_name,
        b.name AS branch_name
      FROM journal_entry_lines l
      INNER JOIN chart_of_accounts a ON a.tenant_id = l.tenant_id AND a.id = l.account_id
      LEFT JOIN projects p ON p.tenant_id = l.tenant_id AND p.id = l.project_id
      LEFT JOIN branches b ON b.tenant_id = l.tenant_id AND b.id = l.branch_id
      WHERE l.tenant_id = ? AND l.journal_entry_id = ?
      ORDER BY l.id ASC
    `,
    [tenantId, journalId]
  );
  return rows;
}

async function createJournal(tenantId, payload, userId, db = pool) {
  const journalNumber = payload.journal_number || (await getNextJournalNumber(tenantId, db));
  const [result] = await db.query(
    `
      INSERT INTO journal_entries (
        tenant_id, journal_number, journal_date, description, source_module, source_id, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      journalNumber,
      payload.journal_date,
      payload.description,
      payload.source_module || null,
      payload.source_id || null,
      payload.status || "draft",
      userId || null
    ]
  );
  return findJournal(tenantId, result.insertId, db);
}

async function replaceJournalLines(tenantId, journalId, lines, db = pool) {
  await db.query("DELETE FROM journal_entry_lines WHERE tenant_id = ? AND journal_entry_id = ?", [tenantId, journalId]);
  for (const line of lines) {
    await db.query(
      `
        INSERT INTO journal_entry_lines (
          tenant_id, journal_entry_id, account_id, description, debit, credit, project_id, branch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        journalId,
        line.account_id,
        line.description || null,
        line.debit || 0,
        line.credit || 0,
        line.project_id || null,
        line.branch_id || null
      ]
    );
  }
}

async function updateJournal(tenantId, id, payload, db = pool) {
  await db.query(
    `
      UPDATE journal_entries
      SET journal_date = ?, description = ?, source_module = ?, source_id = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [payload.journal_date, payload.description, payload.source_module || null, payload.source_id || null, tenantId, id]
  );
  return findJournal(tenantId, id, db);
}

async function markJournalPosted(tenantId, id, userId, db = pool) {
  await db.query(
    "UPDATE journal_entries SET status = 'posted', posted_by = ?, posted_at = NOW() WHERE tenant_id = ? AND id = ?",
    [userId || null, tenantId, id]
  );
  return findJournal(tenantId, id, db);
}

async function markJournalCancelled(tenantId, id, userId, db = pool) {
  await db.query(
    "UPDATE journal_entries SET status = 'cancelled', cancelled_by = ?, cancelled_at = NOW() WHERE tenant_id = ? AND id = ?",
    [userId || null, tenantId, id]
  );
  return findJournal(tenantId, id, db);
}

async function getTrialBalance(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        a.id,
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(SUM(l.debit), 0) AS debit_total,
        COALESCE(SUM(l.credit), 0) AS credit_total
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l
        ON l.tenant_id = a.tenant_id
        AND l.account_id = a.id
        AND EXISTS (
          SELECT 1
          FROM journal_entries j
          WHERE j.tenant_id = l.tenant_id
            AND j.id = l.journal_entry_id
            AND j.status = 'posted'
        )
      WHERE a.tenant_id = ?
      GROUP BY a.id
      ORDER BY a.account_code ASC
    `,
    [tenantId]
  );
  return rows;
}

async function getStatementRows(tenantId, accountTypes, db = pool) {
  const placeholders = accountTypes.map(() => "?").join(", ");
  const [rows] = await db.query(
    `
      SELECT
        a.id,
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(SUM(l.debit), 0) AS debit_total,
        COALESCE(SUM(l.credit), 0) AS credit_total
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l
        ON l.tenant_id = a.tenant_id
        AND l.account_id = a.id
        AND EXISTS (
          SELECT 1
          FROM journal_entries j
          WHERE j.tenant_id = l.tenant_id
            AND j.id = l.journal_entry_id
            AND j.status = 'posted'
        )
      WHERE a.tenant_id = ? AND a.account_type IN (${placeholders})
      GROUP BY a.id
      ORDER BY FIELD(a.account_type, 'asset', 'liability', 'equity', 'income', 'expense'), a.account_code ASC
    `,
    [tenantId, ...accountTypes]
  );
  return rows;
}

async function countBankAccounts(tenantId, db = pool) {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM bank_accounts WHERE tenant_id = ? AND status = 'active'", [
    tenantId
  ]);
  return Number(row.total || 0);
}

async function countUnpostedJournals(tenantId, db = pool) {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM journal_entries WHERE tenant_id = ? AND status = 'draft'", [
    tenantId
  ]);
  return Number(row.total || 0);
}

async function sumCurrentMonthByType(tenantId, accountType, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COALESCE(SUM(CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE l.debit - l.credit END), 0) AS total
      FROM journal_entry_lines l
      INNER JOIN journal_entries j ON j.tenant_id = l.tenant_id AND j.id = l.journal_entry_id
      INNER JOIN chart_of_accounts a ON a.tenant_id = l.tenant_id AND a.id = l.account_id
      WHERE l.tenant_id = ?
        AND j.status = 'posted'
        AND a.account_type = ?
        AND YEAR(j.journal_date) = YEAR(CURDATE())
        AND MONTH(j.journal_date) = MONTH(CURDATE())
    `,
    [tenantId, accountType]
  );
  return Number(row.total || 0);
}

module.exports = {
  listAccounts,
  findAccount,
  accountCodeExists,
  createAccount,
  updateAccount,
  getNextJournalNumber,
  listJournals,
  findJournal,
  findJournalWithTotals,
  listJournalLines,
  createJournal,
  replaceJournalLines,
  updateJournal,
  markJournalPosted,
  markJournalCancelled,
  getTrialBalance,
  getStatementRows,
  countBankAccounts,
  countUnpostedJournals,
  sumCurrentMonthByType
};
