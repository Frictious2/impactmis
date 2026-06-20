const pool = require("../db/pool");

function parseOptionsJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return [];
  }
}

function mapQuestions(rows) {
  return rows.map((row) => ({ ...row, options_json: parseOptionsJson(row.options_json) }));
}

async function listForms(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["sf.tenant_id = ?"];
  if (filters.status) {
    where.push("sf.status = ?");
    params.push(filters.status);
  }
  if (filters.project_id) {
    where.push("sf.project_id = ?");
    params.push(filters.project_id);
  }
  const [rows] = await db.query(
    `SELECT sf.*, p.project_code, p.project_name, COUNT(sr.id) AS response_count
     FROM survey_forms sf
     LEFT JOIN projects p ON p.tenant_id = sf.tenant_id AND p.id = sf.project_id
     LEFT JOIN survey_responses sr ON sr.tenant_id = sf.tenant_id AND sr.survey_form_id = sf.id
     WHERE ${where.join(" AND ")}
     GROUP BY sf.id
     ORDER BY sf.created_at DESC, sf.id DESC`,
    params
  );
  return rows;
}

async function findForm(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `SELECT sf.*, p.project_code, p.project_name
     FROM survey_forms sf
     LEFT JOIN projects p ON p.tenant_id = sf.tenant_id AND p.id = sf.project_id
     WHERE sf.tenant_id = ? AND sf.id = ? LIMIT 1`,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function createForm(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    "INSERT INTO survey_forms (tenant_id, project_id, title, description, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [tenantId, payload.project_id || null, payload.title, payload.description || null, payload.status || "draft", userId || null]
  );
  return findForm(tenantId, result.insertId, db);
}

async function updateForm(tenantId, id, payload, db = pool) {
  await db.query("UPDATE survey_forms SET project_id = ?, title = ?, description = ?, status = ? WHERE tenant_id = ? AND id = ?", [
    payload.project_id || null,
    payload.title,
    payload.description || null,
    payload.status || "draft",
    tenantId,
    id
  ]);
  return findForm(tenantId, id, db);
}

async function publishForm(tenantId, id, db = pool) {
  await db.query("UPDATE survey_forms SET status = 'published' WHERE tenant_id = ? AND id = ?", [tenantId, id]);
  return findForm(tenantId, id, db);
}

async function listQuestions(tenantId, formId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM survey_questions WHERE tenant_id = ? AND survey_form_id = ? ORDER BY sort_order ASC, id ASC",
    [tenantId, formId]
  );
  return mapQuestions(rows);
}

async function createQuestion(tenantId, formId, payload, db = pool) {
  const [result] = await db.query(
    `INSERT INTO survey_questions (tenant_id, survey_form_id, question_text, question_type, options_json, required, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      formId,
      payload.question_text,
      payload.question_type,
      payload.options_json ? JSON.stringify(payload.options_json) : null,
      payload.required ? 1 : 0,
      payload.sort_order || 0
    ]
  );
  const [rows] = await db.query("SELECT * FROM survey_questions WHERE tenant_id = ? AND id = ? LIMIT 1", [tenantId, result.insertId]);
  return mapQuestions(rows)[0] || null;
}

async function createResponse(tenantId, form, payload, userId, db = pool) {
  const [result] = await db.query(
    "INSERT INTO survey_responses (tenant_id, survey_form_id, submitted_by, project_id, branch_id) VALUES (?, ?, ?, ?, ?)",
    [tenantId, form.id, userId || null, form.project_id || null, payload.branch_id || null]
  );
  return result.insertId;
}

async function createAnswer(tenantId, responseId, question, answer, db = pool) {
  await db.query(
    "INSERT INTO survey_answers (tenant_id, survey_response_id, question_id, answer_text, answer_numeric) VALUES (?, ?, ?, ?, ?)",
    [
      tenantId,
      responseId,
      question.id,
      answer === undefined || answer === null ? null : Array.isArray(answer) ? JSON.stringify(answer) : String(answer),
      question.question_type === "number" && answer !== "" ? Number(answer) : null
    ]
  );
}

async function listResponses(tenantId, formId, db = pool) {
  const [rows] = await db.query(
    `SELECT sr.*, u.full_name AS submitted_by_name, b.name AS branch_name
     FROM survey_responses sr
     LEFT JOIN users u ON u.id = sr.submitted_by
     LEFT JOIN branches b ON b.tenant_id = sr.tenant_id AND b.id = sr.branch_id
     WHERE sr.tenant_id = ? AND sr.survey_form_id = ?
     ORDER BY sr.submitted_at DESC, sr.id DESC`,
    [tenantId, formId]
  );
  return rows;
}

async function summarizeResponses(tenantId, formId, db = pool) {
  const questions = await listQuestions(tenantId, formId, db);
  const [answers] = await db.query(
    `SELECT sa.*, sq.question_text, sq.question_type, sq.options_json
     FROM survey_answers sa
     INNER JOIN survey_questions sq ON sq.tenant_id = sa.tenant_id AND sq.id = sa.question_id
     INNER JOIN survey_responses sr ON sr.tenant_id = sa.tenant_id AND sr.id = sa.survey_response_id
     WHERE sa.tenant_id = ? AND sr.survey_form_id = ?`,
    [tenantId, formId]
  );
  return questions.map((question) => {
    const questionAnswers = answers.filter((answer) => Number(answer.question_id) === Number(question.id));
    if (question.question_type === "number") {
      const values = questionAnswers.map((answer) => Number(answer.answer_numeric || 0));
      return { question, count: values.length, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
    }
    const frequencies = {};
    questionAnswers.forEach((answer) => {
      const key = answer.answer_text || "No answer";
      frequencies[key] = (frequencies[key] || 0) + 1;
    });
    return { question, count: questionAnswers.length, frequencies };
  });
}

async function countResponsesByTenantId(tenantId, db = pool) {
  const [[forms]] = await db.query("SELECT COUNT(*) AS total FROM survey_forms WHERE tenant_id = ? AND status = 'published'", [tenantId]);
  const [[responses]] = await db.query("SELECT COUNT(*) AS total FROM survey_responses WHERE tenant_id = ?", [tenantId]);
  return { surveys: Number(forms.total || 0), responses: Number(responses.total || 0) };
}

module.exports = {
  listForms,
  findForm,
  createForm,
  updateForm,
  publishForm,
  listQuestions,
  createQuestion,
  createResponse,
  createAnswer,
  listResponses,
  summarizeResponses,
  countResponsesByTenantId
};
