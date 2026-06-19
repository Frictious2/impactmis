module.exports = {
  id: "037_create_expense_attachments",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS expense_attachments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        expense_id BIGINT UNSIGNED NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size BIGINT UNSIGNED NOT NULL,
        uploaded_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expense_attachments_expense (tenant_id, expense_id)
      )
    `);
  }
};
