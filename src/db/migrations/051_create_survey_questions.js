module.exports = {
  id: "051_create_survey_questions",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS survey_questions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        survey_form_id BIGINT UNSIGNED NOT NULL,
        question_text TEXT NOT NULL,
        question_type ENUM('short_text', 'long_text', 'number', 'single_choice', 'multiple_choice', 'yes_no', 'date') NOT NULL,
        options_json JSON NULL,
        required BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        INDEX idx_survey_questions_tenant_form (tenant_id, survey_form_id, sort_order)
      )
    `);
  }
};
