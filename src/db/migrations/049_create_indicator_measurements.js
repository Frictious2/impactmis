module.exports = {
  id: "049_create_indicator_measurements",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS indicator_measurements (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        indicator_id BIGINT UNSIGNED NOT NULL,
        measurement_type ENUM('baseline', 'target', 'periodic', 'endline') NOT NULL,
        measurement_date DATE NOT NULL,
        value DECIMAL(15,2) NOT NULL,
        comments TEXT NULL,
        entered_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_indicator_measurements_tenant_indicator (tenant_id, indicator_id, measurement_type, measurement_date)
      )
    `);
  }
};
