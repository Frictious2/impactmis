module.exports = {
  id: "038_create_notifications",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NULL,
        user_id BIGINT UNSIGNED NULL,
        title VARCHAR(191) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'success', 'warning', 'danger') NOT NULL DEFAULT 'info',
        category ENUM('system', 'approval', 'attendance', 'project', 'activity_report', 'payroll', 'finance', 'license', 'donor', 'security') NOT NULL DEFAULT 'system',
        link_url VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (tenant_id, user_id, is_read, created_at),
        INDEX idx_notifications_tenant (tenant_id, is_read, created_at),
        INDEX idx_notifications_system (tenant_id, user_id, created_at)
      )
    `);
  }
};
