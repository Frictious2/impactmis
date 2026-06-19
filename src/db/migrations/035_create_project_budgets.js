module.exports = {
  id: "035_create_project_budgets",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_budgets (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        active_budget_key VARCHAR(80) NULL,
        budget_amount DECIMAL(15,2) NOT NULL,
        spent_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        notes TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_project_budgets_active (tenant_id, active_budget_key),
        INDEX idx_project_budgets_project (tenant_id, project_id),
        INDEX idx_project_budgets_category (tenant_id, category_id)
      )
    `);
  }
};
