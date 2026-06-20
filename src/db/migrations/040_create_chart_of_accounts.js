module.exports = {
  id: "040_create_chart_of_accounts",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        account_code VARCHAR(50) NOT NULL,
        account_name VARCHAR(191) NOT NULL,
        account_type ENUM('asset', 'liability', 'equity', 'income', 'expense') NOT NULL,
        parent_account_id BIGINT UNSIGNED NULL,
        description TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chart_accounts_tenant_code (tenant_id, account_code),
        INDEX idx_chart_accounts_tenant_type (tenant_id, account_type, status),
        INDEX idx_chart_accounts_parent (tenant_id, parent_account_id)
      )
    `);
  }
};
