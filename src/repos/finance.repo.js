const pool = require("../db/pool");

async function listCategories(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["tenant_id = ?"];
  if (filters.category_type) {
    where.push("category_type = ?");
    params.push(filters.category_type);
  }
  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters.search) {
    where.push("(name LIKE ? OR code LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  const [rows] = await db.query(
    `SELECT * FROM finance_categories WHERE ${where.join(" AND ")} ORDER BY status ASC, name ASC`,
    params
  );
  return rows;
}

async function findCategoryById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM finance_categories WHERE tenant_id = ? AND id = ? LIMIT 1", [
    tenantId,
    id
  ]);
  return rows[0] || null;
}

async function existsCategoryCode(tenantId, code, excludeId = null, db = pool) {
  const params = [tenantId, code];
  let sql = "SELECT id FROM finance_categories WHERE tenant_id = ? AND code = ?";
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function createCategory(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO finance_categories (
        tenant_id, name, code, category_type, description, status, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [tenantId, payload.name, payload.code, payload.category_type, payload.description, payload.status, userId || null, userId || null]
  );
  return findCategoryById(tenantId, result.insertId, db);
}

async function updateCategory(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE finance_categories
      SET name = ?, code = ?, category_type = ?, description = ?, status = ?, updated_by = ?
      WHERE tenant_id = ? AND id = ?
    `,
    [payload.name, payload.code, payload.category_type, payload.description, payload.status, userId || null, tenantId, id]
  );
  return findCategoryById(tenantId, id, db);
}

async function countApprovedExpensesThisMonth(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE tenant_id = ?
        AND status IN ('approved', 'paid')
        AND YEAR(expense_date) = YEAR(CURDATE())
        AND MONTH(expense_date) = MONTH(CURDATE())
    `,
    [tenantId]
  );
  return Number(row.total || 0);
}

async function countExpensesThisMonth(tenantId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM expenses
      WHERE tenant_id = ?
        AND YEAR(expense_date) = YEAR(CURDATE())
        AND MONTH(expense_date) = MONTH(CURDATE())
    `,
    [tenantId]
  );
  return Number(row.total || 0);
}

async function countPendingExpenseApprovals(tenantId, db = pool) {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM expenses WHERE tenant_id = ? AND status = 'submitted'", [
    tenantId
  ]);
  return Number(row.total || 0);
}

module.exports = {
  listCategories,
  findCategoryById,
  existsCategoryCode,
  createCategory,
  updateCategory,
  countApprovedExpensesThisMonth,
  countExpensesThisMonth,
  countPendingExpenseApprovals
};
