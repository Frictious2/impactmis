module.exports = {
  id: "047_create_logframe_outputs",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS logframe_outputs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        outcome_id BIGINT UNSIGNED NOT NULL,
        output_code VARCHAR(50) NOT NULL,
        output_statement TEXT NOT NULL,
        assumptions_risks TEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logframe_outputs_tenant_outcome (tenant_id, outcome_id, sort_order)
      )
    `);
  }
};
