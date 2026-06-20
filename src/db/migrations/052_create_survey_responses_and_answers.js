module.exports = {
  id: "052_create_survey_responses_and_answers",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        survey_form_id BIGINT UNSIGNED NOT NULL,
        submitted_by BIGINT UNSIGNED NULL,
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        project_id BIGINT UNSIGNED NULL,
        branch_id BIGINT UNSIGNED NULL,
        INDEX idx_survey_responses_tenant_form (tenant_id, survey_form_id, submitted_at)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS survey_answers (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        survey_response_id BIGINT UNSIGNED NOT NULL,
        question_id BIGINT UNSIGNED NOT NULL,
        answer_text TEXT NULL,
        answer_numeric DECIMAL(15,2) NULL,
        INDEX idx_survey_answers_tenant_response (tenant_id, survey_response_id),
        INDEX idx_survey_answers_question (tenant_id, question_id)
      )
    `);
  }
};
