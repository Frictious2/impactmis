module.exports = {
  id: "044_create_bank_transactions",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        bank_account_id BIGINT UNSIGNED NOT NULL,
        offset_account_id BIGINT UNSIGNED NULL,
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        transaction_type ENUM('deposit', 'withdrawal', 'transfer') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        reference_number VARCHAR(100) NULL,
        journal_entry_id BIGINT UNSIGNED NULL,
        status ENUM('draft', 'posted', 'cancelled') NOT NULL DEFAULT 'draft',
        created_by BIGINT UNSIGNED NULL,
        posted_by BIGINT UNSIGNED NULL,
        posted_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bank_transactions_tenant_status (tenant_id, status, transaction_date),
        INDEX idx_bank_transactions_account (tenant_id, bank_account_id)
      )
    `);
  }
};
