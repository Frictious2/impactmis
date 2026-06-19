module.exports = {
  id: "023_create_indicator_updates",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS indicator_updates (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        indicator_id BIGINT UNSIGNED NOT NULL,
        activity_report_id BIGINT UNSIGNED NULL,
        update_value DECIMAL(15,2) NOT NULL,
        notes TEXT NULL,
        updated_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_indicator_updates_indicator (tenant_id, indicator_id)
      )
    `);
  }
};
