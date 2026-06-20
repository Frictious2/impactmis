module.exports = {
  id: "043_create_bank_accounts",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        account_name VARCHAR(191) NOT NULL,
        bank_name VARCHAR(191) NOT NULL,
        account_number VARCHAR(100) NULL,
        currency VARCHAR(12) NOT NULL DEFAULT 'NLe',
        linked_gl_account_id BIGINT UNSIGNED NULL,
        opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bank_accounts_tenant_status (tenant_id, status),
        INDEX idx_bank_accounts_gl (tenant_id, linked_gl_account_id)
      )
    `);
  }
};
