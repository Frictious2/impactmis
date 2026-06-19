module.exports = {
  id: "015_add_branch_to_staff_members",
  up: async (db) => {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staff_members'
        AND COLUMN_NAME = 'branch_id'
    `);

    if (!rows[0].total) {
      await db.query(`
        ALTER TABLE staff_members
        ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER department_id,
        ADD CONSTRAINT fk_staff_members_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
        ADD INDEX idx_staff_members_tenant_branch (tenant_id, branch_id)
      `);
    }
  }
};
