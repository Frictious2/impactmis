module.exports = {
  id: "031_create_payroll_items",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        payroll_run_id BIGINT UNSIGNED NOT NULL,
        staff_member_id BIGINT UNSIGNED NOT NULL,
        staff_code VARCHAR(50) NOT NULL,
        staff_name VARCHAR(191) NOT NULL,
        department_name VARCHAR(191) NULL,
        branch_name VARCHAR(191) NULL,
        base_salary DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        allowance_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        deduction_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        gross_pay DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        net_pay DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        attendance_days_present DECIMAL(6,2) NULL,
        attendance_days_absent DECIMAL(6,2) NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payroll_items_run (tenant_id, payroll_run_id),
        INDEX idx_payroll_items_staff (tenant_id, staff_member_id)
      )
    `);
  }
};
