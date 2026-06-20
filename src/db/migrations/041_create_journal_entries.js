module.exports = {
  id: "041_create_journal_entries",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        journal_number VARCHAR(60) NOT NULL,
        journal_date DATE NOT NULL,
        description TEXT NOT NULL,
        source_module VARCHAR(80) NULL,
        source_id BIGINT UNSIGNED NULL,
        status ENUM('draft', 'posted', 'cancelled') NOT NULL DEFAULT 'draft',
        created_by BIGINT UNSIGNED NULL,
        posted_by BIGINT UNSIGNED NULL,
        posted_at DATETIME NULL,
        cancelled_by BIGINT UNSIGNED NULL,
        cancelled_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_journal_entries_tenant_number (tenant_id, journal_number),
        INDEX idx_journal_entries_tenant_status (tenant_id, status, journal_date)
      )
    `);
  }
};
