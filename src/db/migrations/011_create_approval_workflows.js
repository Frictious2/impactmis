module.exports = {
  id: "011_create_approval_workflows",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
        attendance_approvals TINYINT UNSIGNED NOT NULL DEFAULT 1,
        payroll_approvals TINYINT UNSIGNED NOT NULL DEFAULT 1,
        expense_approvals TINYINT UNSIGNED NOT NULL DEFAULT 1,
        project_report_approvals TINYINT UNSIGNED NOT NULL DEFAULT 1,
        staff_approvals TINYINT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_approval_workflows_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);
  }
};
