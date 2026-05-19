module.exports = {
  id: "002_create_licenses",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        plan_name VARCHAR(150) NOT NULL,
        duration_months INT UNSIGNED NOT NULL,
        starts_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        status ENUM('active', 'expired', 'revoked') NOT NULL DEFAULT 'active',
        modules_json JSON NOT NULL,
        seat_limit INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_licenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        INDEX idx_licenses_tenant_status_dates (tenant_id, status, starts_at, expires_at)
      )
    `);
  }
};
