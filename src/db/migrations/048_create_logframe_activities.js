module.exports = {
  id: "048_create_logframe_activities",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS logframe_activities (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        output_id BIGINT UNSIGNED NOT NULL,
        activity_code VARCHAR(50) NOT NULL,
        activity_statement TEXT NOT NULL,
        planned_start_date DATE NULL,
        planned_end_date DATE NULL,
        status ENUM('not_started', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'not_started',
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logframe_activities_tenant_output (tenant_id, output_id, sort_order),
        INDEX idx_logframe_activities_status (tenant_id, status)
      )
    `);
  }
};
