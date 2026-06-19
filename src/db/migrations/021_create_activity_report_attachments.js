module.exports = {
  id: "021_create_activity_report_attachments",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_report_attachments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        activity_report_id BIGINT UNSIGNED NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(150) NOT NULL,
        file_size BIGINT UNSIGNED NOT NULL,
        uploaded_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_report_attachments_report (tenant_id, activity_report_id)
      )
    `);
  }
};
