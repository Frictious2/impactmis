const pool = require("../db/pool");
const surveyRepo = require("../repos/survey.repo");
const projectRepo = require("../repos/project.repo");
const branchRepo = require("../repos/branch.repo");
const auditLogRepo = require("../repos/audit-log.repo");

const MANAGE_ROLES = new Set(["Tenant Admin", "Project Manager", "M&E Officer"]);
const VIEW_ROLES = new Set(["Tenant Admin", "Project Manager", "M&E Officer", "Auditor", "Data Entry Officer"]);

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseOptions(text) {
  return String(text || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function assertProject(tenantId, projectId, db = pool) {
  if (!projectId) return null;
  const project = await projectRepo.findProject(tenantId, projectId, db);
  if (!project) throw appError("Selected project was not found.", 404);
  return project;
}

async function listForms(tenantId, filters) {
  return surveyRepo.listForms(tenantId, filters);
}

async function findFormWithQuestions(tenantId, id) {
  const form = await surveyRepo.findForm(tenantId, id);
  if (!form) return null;
  const questions = await surveyRepo.listQuestions(tenantId, id);
  return { form, questions };
}

async function createForm(tenantId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await assertProject(tenantId, payload.project_id, db);
    const form = await surveyRepo.createForm(
      tenantId,
      {
        project_id: payload.project_id || null,
        title: String(payload.title || "").trim(),
        description: payload.description || null,
        status: payload.status || "draft"
      },
      userId,
      db
    );
    await auditLogRepo.create(
      { tenant_id: tenantId, user_id: userId, action: "survey.created", entity_type: "survey_form", entity_id: String(form.id), metadata_json: { survey_form_id: form.id, project_id: form.project_id }, ip_address: ipAddress },
      db
    );
    await db.commit();
    return form;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function updateForm(tenantId, id, payload) {
  await assertProject(tenantId, payload.project_id);
  const form = await surveyRepo.findForm(tenantId, id);
  if (!form) throw appError("Survey form was not found.", 404);
  return surveyRepo.updateForm(tenantId, id, payload);
}

async function publishForm(tenantId, id, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const form = await surveyRepo.findForm(tenantId, id, db);
    if (!form) throw appError("Survey form was not found.", 404);
    const questions = await surveyRepo.listQuestions(tenantId, id, db);
    if (!questions.length) throw appError("Add at least one question before publishing.");
    const published = await surveyRepo.publishForm(tenantId, id, db);
    await auditLogRepo.create(
      { tenant_id: tenantId, user_id: userId, action: "survey.published", entity_type: "survey_form", entity_id: String(id), metadata_json: { survey_form_id: id }, ip_address: ipAddress },
      db
    );
    await db.commit();
    return published;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function createQuestion(tenantId, formId, payload) {
  const form = await surveyRepo.findForm(tenantId, formId);
  if (!form) throw appError("Survey form was not found.", 404);
  if (form.status !== "draft") throw appError("Only draft surveys can be edited.");
  return surveyRepo.createQuestion(tenantId, formId, {
    question_text: String(payload.question_text || "").trim(),
    question_type: payload.question_type,
    options_json: ["single_choice", "multiple_choice"].includes(payload.question_type) ? parseOptions(payload.options_text) : null,
    required: payload.required !== "0" && payload.required !== "false",
    sort_order: Number(payload.sort_order || 0)
  });
}

async function submitSurvey(tenantId, formId, payload, userId, ipAddress) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const form = await surveyRepo.findForm(tenantId, formId, db);
    if (!form || form.status !== "published") throw appError("Published survey was not found.", 404);
    if (payload.branch_id) {
      const branch = await branchRepo.findByIdForTenant(payload.branch_id, tenantId, db);
      if (!branch) throw appError("Selected branch was not found.", 404);
    }
    const questions = await surveyRepo.listQuestions(tenantId, formId, db);
    const answers = payload.answers || {};
    for (const question of questions) {
      const answer = answers[question.id];
      if (question.required && (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && !answer.length))) {
        throw appError(`Answer required: ${question.question_text}`);
      }
    }
    const responseId = await surveyRepo.createResponse(tenantId, form, payload, userId, db);
    for (const question of questions) {
      await surveyRepo.createAnswer(tenantId, responseId, question, answers[question.id], db);
    }
    await auditLogRepo.create(
      { tenant_id: tenantId, user_id: userId, action: "survey.response_submitted", entity_type: "survey_response", entity_id: String(responseId), metadata_json: { survey_form_id: form.id, survey_response_id: responseId }, ip_address: ipAddress },
      db
    );
    await db.commit();
    return responseId;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

async function listResponses(tenantId, formId) {
  const form = await surveyRepo.findForm(tenantId, formId);
  if (!form) throw appError("Survey form was not found.", 404);
  const [responses, summary] = await Promise.all([
    surveyRepo.listResponses(tenantId, formId),
    surveyRepo.summarizeResponses(tenantId, formId)
  ]);
  return { form, responses, summary };
}

module.exports = {
  MANAGE_ROLES,
  VIEW_ROLES,
  listForms,
  findFormWithQuestions,
  createForm,
  updateForm,
  publishForm,
  createQuestion,
  submitSurvey,
  listResponses,
  summarizeResponses: surveyRepo.summarizeResponses
};
