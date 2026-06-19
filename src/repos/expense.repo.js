const pool = require("../db/pool");

async function listExpenses(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["e.tenant_id = ?"];
  if (filters.project_id) {
    where.push("e.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.category_id) {
    where.push("e.category_id = ?");
    params.push(filters.category_id);
  }
  if (filters.branch_id) {
    where.push("e.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.status) {
    where.push("e.status = ?");
    params.push(filters.status);
  }
  if (filters.payment_method) {
    where.push("e.payment_method = ?");
    params.push(filters.payment_method);
  }
  if (filters.date_from) {
    where.push("e.expense_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("e.expense_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.search) {
    where.push("(e.expense_code LIKE ? OR e.description LIKE ? OR COALESCE(e.vendor_name, '') LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  const [rows] = await db.query(
    `
      SELECT
        e.*,
        p.project_name,
        p.project_code,
        b.name AS branch_name,
        fc.name AS category_name,
        fc.code AS category_code,
        submitter.full_name AS submitted_by_name,
        approver.full_name AS approved_by_name,
        payer.full_name AS paid_by_name
      FROM expenses e
      LEFT JOIN projects p ON p.id = e.project_id AND p.tenant_id = e.tenant_id
      LEFT JOIN branches b ON b.id = e.branch_id AND b.tenant_id = e.tenant_id
      INNER JOIN finance_categories fc ON fc.id = e.category_id AND fc.tenant_id = e.tenant_id
      LEFT JOIN users submitter ON submitter.id = e.submitted_by
      LEFT JOIN users approver ON approver.id = e.approved_by
      LEFT JOIN users payer ON payer.id = e.paid_by
      WHERE ${where.join(" AND ")}
      ORDER BY e.expense_date DESC, e.id DESC
    `,
    params
  );
  return rows;
}

async function findExpenseById(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        e.*,
        p.project_name,
        p.project_code,
        b.name AS branch_name,
        fc.name AS category_name,
        fc.code AS category_code,
        submitter.full_name AS submitted_by_name,
        approver.full_name AS approved_by_name,
        payer.full_name AS paid_by_name
      FROM expenses e
      LEFT JOIN projects p ON p.id = e.project_id AND p.tenant_id = e.tenant_id
      LEFT JOIN branches b ON b.id = e.branch_id AND b.tenant_id = e.tenant_id
      INNER JOIN finance_categories fc ON fc.id = e.category_id AND fc.tenant_id = e.tenant_id
      LEFT JOIN users submitter ON submitter.id = e.submitted_by
      LEFT JOIN users approver ON approver.id = e.approved_by
      LEFT JOIN users payer ON payer.id = e.paid_by
      WHERE e.tenant_id = ?
        AND e.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function generateExpenseCode(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT expense_code
      FROM expenses
      WHERE tenant_id = ?
        AND expense_code LIKE 'EXP-%'
      ORDER BY id DESC
      LIMIT 1
    `,
    [tenantId]
  );
  const lastCode = rows[0]?.expense_code || "EXP-0000";
  const lastNumber = Number(String(lastCode).split("-")[1] || 0);
  return `EXP-${String(lastNumber + 1).padStart(4, "0")}`;
}

async function createExpense(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO expenses (
        tenant_id, expense_code, project_id, branch_id, category_id, expense_date, vendor_name,
        description, amount, payment_method, receipt_number, receipt_file_path, status, submitted_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.expense_code,
      payload.project_id,
      payload.branch_id,
      payload.category_id,
      payload.expense_date,
      payload.vendor_name,
      payload.description,
      payload.amount,
      payload.payment_method,
      payload.receipt_number,
      payload.receipt_file_path,
      payload.status,
      userId || null
    ]
  );
  return findExpenseById(tenantId, result.insertId, db);
}

async function updateExpense(tenantId, id, payload, db = pool) {
  await db.query(
    `
      UPDATE expenses
      SET project_id = ?, branch_id = ?, category_id = ?, expense_date = ?, vendor_name = ?,
          description = ?, amount = ?, payment_method = ?, receipt_number = ?, receipt_file_path = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [
      payload.project_id,
      payload.branch_id,
      payload.category_id,
      payload.expense_date,
      payload.vendor_name,
      payload.description,
      payload.amount,
      payload.payment_method,
      payload.receipt_number,
      payload.receipt_file_path,
      tenantId,
      id
    ]
  );
  return findExpenseById(tenantId, id, db);
}

async function updateStatus(tenantId, id, status, userColumn, dateColumn, userId, extra = {}, db = pool) {
  const sets = ["status = ?"];
  const params = [status];
  if (userColumn) {
    sets.push(`${userColumn} = ?`);
    params.push(userId || null);
  }
  if (dateColumn) {
    sets.push(`${dateColumn} = NOW()`);
  }
  if (Object.prototype.hasOwnProperty.call(extra, "rejection_reason")) {
    sets.push("rejection_reason = ?");
    params.push(extra.rejection_reason);
  }
  if (status !== "rejected") {
    sets.push("rejection_reason = NULL");
  }
  params.push(tenantId, id);
  await db.query(`UPDATE expenses SET ${sets.join(", ")} WHERE tenant_id = ? AND id = ?`, params);
  return findExpenseById(tenantId, id, db);
}

async function createAttachment(tenantId, expenseId, file, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO expense_attachments (
        tenant_id, expense_id, original_name, stored_name, file_path, mime_type, file_size, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [tenantId, expenseId, file.original_name, file.stored_name, file.file_path, file.mime_type, file.file_size, userId || null]
  );
  return result.insertId;
}

async function listAttachments(tenantId, expenseId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT ea.*, u.full_name AS uploaded_by_name
      FROM expense_attachments ea
      LEFT JOIN users u ON u.id = ea.uploaded_by
      WHERE ea.tenant_id = ?
        AND ea.expense_id = ?
      ORDER BY ea.created_at DESC, ea.id DESC
    `,
    [tenantId, expenseId]
  );
  return rows;
}

module.exports = {
  listExpenses,
  findExpenseById,
  generateExpenseCode,
  createExpense,
  updateExpense,
  updateStatus,
  createAttachment,
  listAttachments
};
