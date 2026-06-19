const pool = require("../db/pool");
const financeRepo = require("../repos/finance.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const { normalizeNullable } = require("../utils/tenant-form");

function normalizeCategory(payload) {
  return {
    name: String(payload.name || "").trim(),
    code: String(payload.code || "").trim().toUpperCase().replace(/\s+/g, "_"),
    category_type: payload.category_type || "expense",
    description: normalizeNullable(payload.description),
    status: payload.status || "active"
  };
}

async function listCategories(tenantId, filters) {
  return financeRepo.listCategories(tenantId, filters);
}

async function createCategory(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeCategory(payload);
    if (await financeRepo.existsCategoryCode(tenantId, normalized.code, null, connection)) {
      const error = new Error("Category code already exists for this tenant.");
      error.statusCode = 422;
      throw error;
    }
    const category = await financeRepo.createCategory(tenantId, normalized, userId, connection);
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "finance.category_created",
        entity_type: "finance_category",
        entity_id: String(category.id),
        metadata_json: { category_id: category.id, code: category.code },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return category;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateCategory(tenantId, id, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeCategory(payload);
    if (await financeRepo.existsCategoryCode(tenantId, normalized.code, id, connection)) {
      const error = new Error("Category code already exists for this tenant.");
      error.statusCode = 422;
      throw error;
    }
    const category = await financeRepo.updateCategory(tenantId, id, normalized, userId, connection);
    if (!category) {
      const error = new Error("Category not found.");
      error.statusCode = 404;
      throw error;
    }
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "finance.category_updated",
        entity_type: "finance_category",
        entity_id: String(category.id),
        metadata_json: { category_id: category.id, code: category.code },
        ip_address: ipAddress
      },
      connection
    );
    await connection.commit();
    return category;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { listCategories, createCategory, updateCategory };
