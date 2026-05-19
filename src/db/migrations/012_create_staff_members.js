module.exports = {
  id: "012_create_staff_members",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_members (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        staff_code VARCHAR(50) NOT NULL,
        first_name VARCHAR(150) NOT NULL,
        middle_name VARCHAR(150) NULL,
        last_name VARCHAR(150) NOT NULL,
        gender VARCHAR(50) NULL,
        date_of_birth DATE NULL,
        phone VARCHAR(100) NULL,
        email VARCHAR(191) NULL,
        address TEXT NULL,
        department_id BIGINT UNSIGNED NULL,
        position_title VARCHAR(150) NOT NULL,
        employment_type ENUM('staff', 'volunteer', 'consultant', 'intern') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('active', 'inactive', 'exited', 'suspended') NOT NULL DEFAULT 'active',
        emergency_contact_name VARCHAR(255) NULL,
        emergency_contact_phone VARCHAR(100) NULL,
        notes TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_staff_members_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_staff_members_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        CONSTRAINT fk_staff_members_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_staff_members_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_staff_members_code_tenant (tenant_id, staff_code),
        UNIQUE KEY uq_staff_members_email_tenant (tenant_id, email),
        INDEX idx_staff_members_tenant_status (tenant_id, status),
        INDEX idx_staff_members_tenant_department (tenant_id, department_id),
        INDEX idx_staff_members_tenant_employment_type (tenant_id, employment_type)
      )
    `);
  }
};
