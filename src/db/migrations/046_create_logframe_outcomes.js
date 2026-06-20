module.exports = {
  id: "046_create_logframe_outcomes",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS logframe_outcomes (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        logframe_id BIGINT UNSIGNED NOT NULL,
        outcome_code VARCHAR(50) NOT NULL,
        outcome_statement TEXT NOT NULL,
        assumptions_risks TEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logframe_outcomes_tenant_logframe (tenant_id, logframe_id, sort_order)
      )
    `);
  }
};
