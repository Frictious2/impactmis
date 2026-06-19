module.exports = {
  id: "039_create_messages",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        sender_user_id BIGINT UNSIGNED NOT NULL,
        recipient_user_id BIGINT UNSIGNED NOT NULL,
        subject VARCHAR(191) NOT NULL,
        body TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_messages_inbox (tenant_id, recipient_user_id, is_read, created_at),
        INDEX idx_messages_sent (tenant_id, sender_user_id, created_at)
      )
    `);
  }
};
