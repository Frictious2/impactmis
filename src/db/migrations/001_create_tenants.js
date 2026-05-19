module.exports = {
  id: "001_create_tenants",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        tenant_code VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(150) NOT NULL UNIQUE,
        primary_domain VARCHAR(255) NULL,
        contact_name VARCHAR(255) NULL,
        contact_email VARCHAR(255) NULL,
        contact_phone VARCHAR(100) NULL,
        country VARCHAR(150) NOT NULL DEFAULT 'Sierra Leone',
        status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }
};
