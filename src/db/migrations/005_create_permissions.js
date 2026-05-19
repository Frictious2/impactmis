module.exports = {
  id: "005_create_permissions",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(150) NOT NULL UNIQUE,
        description VARCHAR(255) NOT NULL
      )
    `);
  }
};
