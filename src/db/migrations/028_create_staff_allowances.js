module.exports = {
  id: "028_create_staff_allowances",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_allowances (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        staff_member_id BIGINT UNSIGNED NOT NULL,
        allowance_type_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff_allowances_staff (tenant_id, staff_member_id),
        INDEX idx_staff_allowances_type (tenant_id, allowance_type_id),
        INDEX idx_staff_allowances_status (tenant_id, status)
      )
    `);
  }
};
