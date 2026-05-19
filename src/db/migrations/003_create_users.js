module.exports = {
  id: "003_create_users",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(191) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        user_type ENUM('developer', 'tenant') NOT NULL,
        status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        tenant_scope_key VARCHAR(32) NOT NULL,
        CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
        UNIQUE KEY uq_users_email_scope (email, tenant_scope_key),
        INDEX idx_users_email (email),
        INDEX idx_users_tenant_role (tenant_id, role)
      )
    `);
  }
};
