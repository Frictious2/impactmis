module.exports = {
  id: "010_add_department_to_users",
  up: async (db) => {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'department_id'
    `);

    if (!rows[0].total) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN department_id BIGINT UNSIGNED NULL AFTER role,
        ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        ADD INDEX idx_users_tenant_department (tenant_id, department_id)
      `);
    }
  }
};
