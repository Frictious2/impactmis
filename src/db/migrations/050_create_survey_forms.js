module.exports = {
  id: "050_create_survey_forms",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS survey_forms (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT NULL,
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_survey_forms_tenant_project (tenant_id, project_id, status)
      )
    `);
  }
};
