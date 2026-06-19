module.exports = {
  id: "014_create_branches",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        branch_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        city VARCHAR(150) NULL,
        district VARCHAR(150) NULL,
        country VARCHAR(150) NOT NULL DEFAULT 'Sierra Leone',
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        geofence_radius_meters INT UNSIGNED NOT NULL DEFAULT 100,
        contact_name VARCHAR(255) NULL,
        contact_phone VARCHAR(100) NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_branches_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_branches_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_branches_code_tenant (tenant_id, branch_code),
        INDEX idx_branches_tenant_status (tenant_id, status)
      )
    `);
  }
};
