module.exports = {
  id: "004_create_roles",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scope_key VARCHAR(32) NOT NULL,
        CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE KEY uq_roles_name_scope (name, scope_key)
      )
    `);
  }
};
