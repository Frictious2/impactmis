const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const pool = require("../src/db/pool");
const activityReportService = require("../src/services/activity-report.service");

const REQUIRED_TABLES = [
  "activity_reports",
  "activity_report_attachments",
  "project_indicators",
  "indicator_updates"
];

let failed = false;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message, error) {
  failed = true;
  console.error(`FAIL: ${message}`);
  if (error) {
    console.error(`  ${error.message}`);
  }
}

async function verifyTables() {
  const [rows] = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN (?,?,?,?)
    `,
    REQUIRED_TABLES
  );

  const existing = new Set(rows.map((row) => row.table_name));
  for (const tableName of REQUIRED_TABLES) {
    if (existing.has(tableName)) {
      pass(`Table exists: ${tableName}`);
    } else {
      fail(`Missing table: ${tableName}`);
    }
  }
}

async function verifyReadOnlyQueries() {
  const checks = [
    ["activity_reports", "SELECT COUNT(*) AS total FROM activity_reports LIMIT 1"],
    ["activity_report_attachments", "SELECT COUNT(*) AS total FROM activity_report_attachments LIMIT 1"],
    ["project_indicators", "SELECT COUNT(*) AS total FROM project_indicators LIMIT 1"],
    ["indicator_updates", "SELECT COUNT(*) AS total FROM indicator_updates LIMIT 1"]
  ];

  for (const [name, sql] of checks) {
    await pool.query(sql);
    pass(`Read-only query succeeded for ${name}`);
  }
}

function verifyUploadDirectory() {
  const { absoluteDir } = activityReportService.ensureUploadDirectory("verify-phase6");
  if (fs.existsSync(absoluteDir)) {
    pass(`Upload directory available: ${absoluteDir}`);
  } else {
    fail(`Upload directory was not created: ${absoluteDir}`);
  }
}

async function verifyTemplates() {
  const reportShowTemplate = path.join(process.cwd(), "views/pages/tenant/activity-reports/show.ejs");
  const reportEditTemplate = path.join(process.cwd(), "views/pages/tenant/activity-reports/edit.ejs");
  const projectShowTemplate = path.join(process.cwd(), "views/pages/tenant/projects/show.ejs");

  await ejs.renderFile(reportShowTemplate, {
    report: {
      id: 1,
      title: "Verification Report",
      report_code: "RPT-0001",
      report_type: "daily",
      status: "submitted",
      project_id: 1,
      project_name: "Verification Project",
      task_title: null,
      branch_name: null,
      staff_name: null,
      report_date: "2026-06-16",
      submitted_by_name: null,
      beneficiaries_reached: 0,
      male_beneficiaries: 0,
      female_beneficiaries: 0,
      youth_beneficiaries: 0,
      summary: "Summary",
      activities_completed: null,
      challenges: null,
      recommendations: null,
      approved_by_name: null,
      approved_at: null,
      rejection_reason: null
    },
    activeTab: "overview",
    attachments: [],
    indicatorUpdates: [],
    activity: [],
    canApprove: false
  });
  pass("Activity report detail template renders with null optional relationships");

  await ejs.renderFile(reportEditTemplate, {
    report: {
      id: 1,
      title: "Verification Report"
    },
    formData: {
      report_code: "RPT-0001",
      project_id: "1",
      task_id: "",
      staff_member_id: "",
      branch_id: "",
      report_date: "2026-06-16",
      report_type: "daily",
      title: "Verification Report",
      summary: "Summary",
      activities_completed: "",
      challenges: "",
      recommendations: "",
      beneficiaries_reached: "0",
      male_beneficiaries: "0",
      female_beneficiaries: "0",
      youth_beneficiaries: "0",
      status: "submitted",
      rejection_reason: ""
    },
    projects: [{ id: 1, project_code: "PRJ-0001", project_name: "Verification Project" }],
    branches: [],
    staffMembers: [],
    tasks: [],
    reportTypeOptions: [{ value: "daily", label: "Daily" }],
    statusOptions: [{ value: "submitted", label: "Submitted" }],
    validationErrors: []
  });
  pass("Activity report edit template renders safely with empty optional dropdowns");

  await ejs.renderFile(projectShowTemplate, {
    project: {
      id: 1,
      project_name: "Verification Project",
      project_code: "PRJ-0001",
      status: "active",
      completion_percentage: 20,
      branch_name: null,
      project_manager_name: null,
      donor_name: null,
      budget: null,
      start_date: "2026-06-16",
      end_date: null,
      project_description: "Description"
    },
    activeTab: "indicators",
    indicators: [],
    projectReports: [],
    projectStatusOptions: [],
    indicatorStatusOptions: [{ value: "active", label: "Active" }],
    indicatorFormData: { indicator_name: "", description: "", target_value: "", unit: "", status: "active" },
    indicatorUpdateFormData: { update_value: "", notes: "", activity_report_id: "" },
    indicatorValidationErrors: [],
    indicatorUpdateValidationErrors: [],
    assignments: [],
    tasks: [],
    activity: [],
    branches: [],
    managers: [],
    staffMembers: [],
    taskPriorityOptions: [],
    taskStatusOptions: [],
    assignmentFormData: { staff_member_id: "", assignment_role: "", assigned_date: "" },
    taskFormData: { title: "", description: "", assigned_staff_id: "", priority: "medium", due_date: "", completion_percentage: 0 },
    assignmentValidationErrors: [],
    taskValidationErrors: []
  });
  pass("Project detail indicators tab template renders safely");
}

async function main() {
  try {
    await verifyTables();
    await verifyReadOnlyQueries();
    verifyUploadDirectory();
    await verifyTemplates();
  } catch (error) {
    fail("Phase 6 verification script crashed", error);
  } finally {
    await pool.end();
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("Phase 6 verification complete.");
}

main();
