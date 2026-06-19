module.exports = {
  id: "036_create_expenses",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        expense_code VARCHAR(50) NOT NULL,
        project_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        expense_date DATE NOT NULL,
        vendor_name VARCHAR(191) NULL,
        description TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        payment_method ENUM('cash', 'mobile_money', 'bank_transfer', 'cheque', 'other') NOT NULL,
        receipt_number VARCHAR(100) NULL,
        receipt_file_path VARCHAR(255) NULL,
        status ENUM('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled') NOT NULL DEFAULT 'submitted',
        submitted_by BIGINT UNSIGNED NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        paid_by BIGINT UNSIGNED NULL,
        paid_at DATETIME NULL,
        rejection_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_expenses_tenant_code (tenant_id, expense_code),
        INDEX idx_expenses_tenant_status (tenant_id, status),
        INDEX idx_expenses_project_category (tenant_id, project_id, category_id)
      )
    `);
  }
};
