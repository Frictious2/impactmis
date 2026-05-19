module.exports = {
  id: "008_create_organization_profiles",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS organization_profiles (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
        organization_name VARCHAR(255) NOT NULL,
        logo VARCHAR(255) NULL,
        address VARCHAR(255) NULL,
        city VARCHAR(150) NULL,
        district VARCHAR(150) NULL,
        country VARCHAR(150) NOT NULL DEFAULT 'Sierra Leone',
        registration_number VARCHAR(150) NULL,
        website VARCHAR(255) NULL,
        email VARCHAR(191) NULL,
        phone VARCHAR(100) NULL,
        mission_statement TEXT NULL,
        organization_type VARCHAR(150) NULL,
        fiscal_year_start_month TINYINT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_organization_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);
  }
};
