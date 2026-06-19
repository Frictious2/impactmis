module.exports = {
  id: "020_create_activity_reports",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_reports (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        report_code VARCHAR(50) NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        task_id BIGINT UNSIGNED NULL,
        staff_member_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        report_date DATE NOT NULL,
        report_type ENUM('daily', 'weekly', 'monthly', 'incident', 'field_visit', 'training', 'community_engagement') NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        activities_completed TEXT NULL,
        challenges TEXT NULL,
        recommendations TEXT NULL,
        beneficiaries_reached INT UNSIGNED NOT NULL DEFAULT 0,
        male_beneficiaries INT UNSIGNED NOT NULL DEFAULT 0,
        female_beneficiaries INT UNSIGNED NOT NULL DEFAULT 0,
        youth_beneficiaries INT UNSIGNED NOT NULL DEFAULT 0,
        status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
        submitted_by BIGINT UNSIGNED NOT NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        rejection_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_activity_reports_code_tenant (tenant_id, report_code),
        INDEX idx_activity_reports_project (tenant_id, project_id),
        INDEX idx_activity_reports_status (tenant_id, status),
        INDEX idx_activity_reports_date (tenant_id, report_date)
      )
    `);
  }
};
