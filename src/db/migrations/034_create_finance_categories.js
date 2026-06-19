module.exports = {
  id: "034_create_finance_categories",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_categories (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(191) NOT NULL,
        code VARCHAR(50) NOT NULL,
        category_type ENUM('expense', 'income') NOT NULL,
        description TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_finance_categories_tenant_code (tenant_id, code),
        INDEX idx_finance_categories_tenant_type (tenant_id, category_type, status)
      )
    `);
  }
};
