const logframeService = require("../services/logframe.service");
const measurementService = require("../services/measurement.service");
const surveyService = require("../services/survey.service");
const projectRepo = require("../repos/project.repo");
const indicatorRepo = require("../repos/indicator.repo");
const branchRepo = require("../repos/branch.repo");

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

function breadcrumbs(...items) {
  return [{ label: "Dashboard", href: "/dashboard" }, ...items];
}

function knownError(req, res, error, fallback, next) {
  if (error.statusCode) {
    req.flash("error", error.message);
    return res.redirect(fallback);
  }
  return next(error);
}

async function projectLogFrame(req, res, next) {
  try {
    const [project, hierarchy] = await Promise.all([
      projectRepo.findProject(req.currentUser.tenant_id, req.params.id),
      logframeService.listProjectLogFrame(req.currentUser.tenant_id, req.params.id)
    ]);
    if (!project) return renderNotFound(res, "Project Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: `LogFrame - ${project.project_name}`,
      contentPartial: "../pages/tenant/mne/logframe",
      breadcrumbs: breadcrumbs({ label: "Projects", href: "/projects" }, { label: project.project_name, href: `/projects/${project.id}` }, { label: "LogFrame" }),
      project,
      ...hierarchy
    });
  } catch (error) {
    return next(error);
  }
}

async function createLogFrame(req, res, next) {
  try {
    await logframeService.createLogFrame(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "LogFrame created.");
    return res.redirect(`/projects/${req.params.id}/logframe`);
  } catch (error) {
    return knownError(req, res, error, `/projects/${req.params.id}/logframe`, next);
  }
}

async function createOutcome(req, res, next) {
  try {
    const outcome = await logframeService.createOutcome(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Outcome added.");
    return res.redirect(`/projects/${req.body.project_id || ""}/logframe`.replace("//", "/"));
  } catch (error) {
    return knownError(req, res, error, req.get("Referrer") || "/projects", next);
  }
}

async function createOutput(req, res, next) {
  try {
    await logframeService.createOutput(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Output added.");
    return res.redirect(req.get("Referrer") || "/projects");
  } catch (error) {
    return knownError(req, res, error, req.get("Referrer") || "/projects", next);
  }
}

async function createActivity(req, res, next) {
  try {
    await logframeService.createActivity(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Activity added.");
    return res.redirect(req.get("Referrer") || "/projects");
  } catch (error) {
    return knownError(req, res, error, req.get("Referrer") || "/projects", next);
  }
}

async function updateActivityStatus(req, res, next) {
  try {
    await logframeService.updateActivityStatus(req.currentUser.tenant_id, req.params.id, req.body.status, req.currentUser.id, req.ip);
    req.flash("success", "Activity status updated.");
    return res.redirect(req.get("Referrer") || "/projects");
  } catch (error) {
    return knownError(req, res, error, req.get("Referrer") || "/projects", next);
  }
}

async function indicatorMeasurements(req, res, next) {
  try {
    const data = await measurementService.listMeasurements(req.currentUser.tenant_id, req.params.id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Indicator Measurements",
      contentPartial: "../pages/tenant/mne/measurements",
      breadcrumbs: breadcrumbs({ label: "Projects", href: "/projects" }, { label: "Indicator Measurements" }),
      ...data
    });
  } catch (error) {
    if (error.statusCode === 404) return renderNotFound(res, "Indicator Not Found");
    return next(error);
  }
}

async function addMeasurement(req, res, next) {
  try {
    await measurementService.addMeasurement(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Measurement added.");
    return res.redirect(`/indicators/${req.params.id}/measurements`);
  } catch (error) {
    return knownError(req, res, error, `/indicators/${req.params.id}/measurements`, next);
  }
}

async function surveys(req, res, next) {
  try {
    const filters = { status: req.query.status || "", project_id: req.query.project_id || "" };
    const [forms, projects] = await Promise.all([
      surveyService.listForms(req.currentUser.tenant_id, filters),
      projectRepo.listProjects(req.currentUser.tenant_id, {})
    ]);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Surveys",
      contentPartial: "../pages/tenant/mne/surveys/index",
      breadcrumbs: breadcrumbs({ label: "Surveys" }),
      forms,
      projects,
      filters
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreateSurvey(req, res, next) {
  try {
    const projects = await projectRepo.listProjects(req.currentUser.tenant_id, {});
    return res.render("layouts/tenant-layout", {
      pageTitle: "Create Survey",
      contentPartial: "../pages/tenant/mne/surveys/form",
      breadcrumbs: breadcrumbs({ label: "Surveys", href: "/surveys" }, { label: "Create" }),
      form: {},
      projects,
      formAction: "/surveys"
    });
  } catch (error) {
    return next(error);
  }
}

async function createSurvey(req, res, next) {
  try {
    const form = await surveyService.createForm(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Survey created. Add questions before publishing.");
    return res.redirect(`/surveys/${form.id}`);
  } catch (error) {
    return knownError(req, res, error, "/surveys/create", next);
  }
}

async function showSurvey(req, res, next) {
  try {
    const data = await surveyService.findFormWithQuestions(req.currentUser.tenant_id, req.params.id);
    if (!data) return renderNotFound(res, "Survey Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: data.form.title,
      contentPartial: "../pages/tenant/mne/surveys/show",
      breadcrumbs: breadcrumbs({ label: "Surveys", href: "/surveys" }, { label: data.form.title }),
      ...data
    });
  } catch (error) {
    return next(error);
  }
}

async function showEditSurvey(req, res, next) {
  try {
    const [data, projects] = await Promise.all([
      surveyService.findFormWithQuestions(req.currentUser.tenant_id, req.params.id),
      projectRepo.listProjects(req.currentUser.tenant_id, {})
    ]);
    if (!data) return renderNotFound(res, "Survey Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: `Edit ${data.form.title}`,
      contentPartial: "../pages/tenant/mne/surveys/form",
      breadcrumbs: breadcrumbs({ label: "Surveys", href: "/surveys" }, { label: "Edit" }),
      form: data.form,
      projects,
      formAction: `/surveys/${data.form.id}/edit`
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSurvey(req, res, next) {
  try {
    await surveyService.updateForm(req.currentUser.tenant_id, req.params.id, req.body);
    req.flash("success", "Survey updated.");
    return res.redirect(`/surveys/${req.params.id}`);
  } catch (error) {
    return knownError(req, res, error, `/surveys/${req.params.id}/edit`, next);
  }
}

async function addQuestion(req, res, next) {
  try {
    await surveyService.createQuestion(req.currentUser.tenant_id, req.params.id, req.body);
    req.flash("success", "Question added.");
    return res.redirect(`/surveys/${req.params.id}`);
  } catch (error) {
    return knownError(req, res, error, `/surveys/${req.params.id}`, next);
  }
}

async function publishSurvey(req, res, next) {
  try {
    await surveyService.publishForm(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", "Survey published.");
    return res.redirect(`/surveys/${req.params.id}`);
  } catch (error) {
    return knownError(req, res, error, `/surveys/${req.params.id}`, next);
  }
}

async function respondSurvey(req, res, next) {
  try {
    const [data, branches] = await Promise.all([
      surveyService.findFormWithQuestions(req.currentUser.tenant_id, req.params.id),
      branchRepo.listByTenantId(req.currentUser.tenant_id)
    ]);
    if (!data || data.form.status !== "published") return renderNotFound(res, "Survey Not Found");
    return res.render("layouts/tenant-layout", {
      pageTitle: `Respond - ${data.form.title}`,
      contentPartial: "../pages/tenant/mne/surveys/respond",
      breadcrumbs: breadcrumbs({ label: "Surveys", href: "/surveys" }, { label: "Respond" }),
      ...data,
      branches
    });
  } catch (error) {
    return next(error);
  }
}

async function submitSurvey(req, res, next) {
  try {
    await surveyService.submitSurvey(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Survey response submitted.");
    return res.redirect(`/surveys/${req.params.id}`);
  } catch (error) {
    return knownError(req, res, error, `/surveys/${req.params.id}/respond`, next);
  }
}

async function surveyResponses(req, res, next) {
  try {
    const data = await surveyService.listResponses(req.currentUser.tenant_id, req.params.id);
    return res.render("layouts/tenant-layout", {
      pageTitle: `Responses - ${data.form.title}`,
      contentPartial: "../pages/tenant/mne/surveys/responses",
      breadcrumbs: breadcrumbs({ label: "Surveys", href: "/surveys" }, { label: data.form.title, href: `/surveys/${data.form.id}` }, { label: "Responses" }),
      ...data
    });
  } catch (error) {
    if (error.statusCode === 404) return renderNotFound(res, "Survey Not Found");
    return next(error);
  }
}

module.exports = {
  projectLogFrame,
  createLogFrame,
  createOutcome,
  createOutput,
  createActivity,
  updateActivityStatus,
  indicatorMeasurements,
  addMeasurement,
  surveys,
  showCreateSurvey,
  createSurvey,
  showSurvey,
  showEditSurvey,
  updateSurvey,
  addQuestion,
  publishSurvey,
  respondSurvey,
  submitSurvey,
  surveyResponses
};
