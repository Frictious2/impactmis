async function columnExists(db, tableName, columnName) {
  const [rows] = await db.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return Boolean(rows[0]);
}

async function indexExists(db, tableName, indexName) {
  const [rows] = await db.query(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  return Boolean(rows[0]);
}

module.exports = {
  id: "033_add_user_id_to_staff_members",
  up: async (db) => {
    if (!(await columnExists(db, "staff_members", "user_id"))) {
      await db.query("ALTER TABLE staff_members ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER tenant_id");
    }

    if (!(await indexExists(db, "staff_members", "idx_staff_members_user"))) {
      await db.query("ALTER TABLE staff_members ADD INDEX idx_staff_members_user (tenant_id, user_id)");
    }
  }
};
