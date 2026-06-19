module.exports = {
  id: "027_create_deduction_types",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS deduction_types (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(191) NOT NULL,
        code VARCHAR(50) NOT NULL,
        description TEXT NULL,
        calculation_type ENUM('fixed', 'percentage') NOT NULL,
        default_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_deduction_types_tenant_code (tenant_id, code),
        INDEX idx_deduction_types_tenant_status (tenant_id, status)
      )
    `);
  }
};
