module.exports = {
  id: "025_create_staff_compensation",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_compensation (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        staff_member_id BIGINT UNSIGNED NOT NULL,
        base_salary DECIMAL(15,2) NOT NULL,
        pay_type ENUM('monthly', 'daily', 'hourly', 'stipend') NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'NLe',
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff_compensation_tenant_staff (tenant_id, staff_member_id),
        INDEX idx_staff_compensation_status (tenant_id, status)
      )
    `);
  }
};
