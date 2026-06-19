module.exports = {
  id: "022_create_project_indicators",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_indicators (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        indicator_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        target_value DECIMAL(15,2) NOT NULL,
        current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
        unit VARCHAR(100) NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project_indicators_project (tenant_id, project_id),
        INDEX idx_project_indicators_status (tenant_id, status)
      )
    `);
  }
};
