module.exports = {
  id: "030_create_payroll_runs",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        payroll_month INT NOT NULL,
        payroll_year INT NOT NULL,
        active_period_key VARCHAR(20) NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status ENUM('draft', 'submitted', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
        total_gross DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_net DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        generated_by BIGINT UNSIGNED NULL,
        submitted_by BIGINT UNSIGNED NULL,
        approved_by BIGINT UNSIGNED NULL,
        paid_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_runs_active_period (tenant_id, active_period_key),
        INDEX idx_payroll_runs_tenant_status (tenant_id, status),
        CONSTRAINT chk_payroll_runs_month CHECK (payroll_month BETWEEN 1 AND 12)
      )
    `);
  }
};
