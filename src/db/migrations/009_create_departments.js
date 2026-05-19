module.exports = {
  id: "009_create_departments",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        department_name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE KEY uq_departments_name_tenant (tenant_id, department_name)
      )
    `);
  }
};
