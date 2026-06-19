module.exports = {
  id: "024_create_payroll_settings",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_settings (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'NLe',
        pay_frequency ENUM('monthly', 'biweekly', 'weekly') NOT NULL DEFAULT 'monthly',
        default_work_days_per_month INT NOT NULL DEFAULT 22,
        default_work_hours_per_day DECIMAL(5,2) NOT NULL DEFAULT 8.00,
        overtime_enabled TINYINT(1) NOT NULL DEFAULT 0,
        approval_required TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_settings_tenant (tenant_id)
      )
    `);
  }
};
