module.exports = {
  id: "042_create_journal_entry_lines",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        journal_entry_id BIGINT UNSIGNED NOT NULL,
        account_id BIGINT UNSIGNED NOT NULL,
        description TEXT NULL,
        debit DECIMAL(15,2) NOT NULL DEFAULT 0,
        credit DECIMAL(15,2) NOT NULL DEFAULT 0,
        project_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_journal_lines_tenant_journal (tenant_id, journal_entry_id),
        INDEX idx_journal_lines_tenant_account (tenant_id, account_id),
        CONSTRAINT chk_journal_line_one_side CHECK (NOT (debit > 0 AND credit > 0))
      )
    `);
  }
};
