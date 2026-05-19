module.exports = {
  id: "007_create_audit_logs",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NULL,
        user_id BIGINT UNSIGNED NULL,
        action VARCHAR(150) NOT NULL,
        entity_type VARCHAR(150) NOT NULL,
        entity_id VARCHAR(100) NULL,
        metadata_json JSON NULL,
        ip_address VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_audit_logs_tenant_user (tenant_id, user_id),
        INDEX idx_audit_logs_entity (entity_type, entity_id)
      )
    `);
  }
};
