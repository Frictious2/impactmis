const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const pool = require("../src/db/pool");
const auditLogRepo = require("../src/repos/audit-log.repo");
const env = require("../src/config/env");
const { getModuleCodes, parseJsonField } = require("../src/utils/tenant-form");

const REQUIRED_TABLES = [
  "tenants",
  "licenses",
  "users",
  "roles",
  "permissions",
  "audit_logs",
  "organization_profiles",
  "departments",
  "branches",
  "staff_members",
  "attendance_records",
  "projects",
  "project_assignments",
  "project_tasks",
  "activity_reports",
  "activity_report_attachments",
  "project_indicators",
  "indicator_updates",
  "payroll_runs",
  "payroll_items",
  "finance_categories",
  "project_budgets",
  "expenses",
  "expense_attachments",
  "chart_of_accounts",
  "journal_entries",
  "journal_entry_lines",
  "bank_accounts",
  "bank_transactions",
  "logframes",
  "logframe_outcomes",
  "logframe_outputs",
  "logframe_activities",
  "indicator_measurements",
  "survey_forms",
  "survey_questions",
  "survey_responses",
  "survey_answers",
  "notifications",
  "messages"
];

const REQUIRED_MIGRATIONS = [
  "001_create_tenants.js",
  "007_create_audit_logs.js",
  "012_create_staff_members.js",
  "013_create_attendance_records.js",
  "014_create_branches.js",
  "017_create_projects.js",
  "020_create_activity_reports.js",
  "024_create_payroll_settings.js",
  "031_create_payroll_items.js",
  "034_create_finance_categories.js",
  "040_create_chart_of_accounts.js",
  "044_create_bank_transactions.js",
  "045_create_logframes.js",
  "049_create_indicator_measurements.js",
  "050_create_survey_forms.js",
  "052_create_survey_responses_and_answers.js"
];

const LOAD_CHECKS = [
  "../src/routes/auth.routes",
  "../src/routes/developer.routes",
  "../src/routes/tenant.routes",
  "../src/routes/donor.routes",
  "../src/repos/staff.repo",
  "../src/repos/project.repo",
  "../src/repos/payroll.repo",
  "../src/repos/expense.repo",
  "../src/repos/accounting.repo",
  "../src/repos/bank.repo",
  "../src/repos/logframe.repo",
  "../src/repos/measurement.repo",
  "../src/repos/survey.repo",
  "../src/repos/report.repo",
  "../src/repos/notification.repo",
  "../src/repos/message.repo",
  "../src/services/backup.service",
  "../src/services/accounting.service",
  "../src/services/bank.service",
  "../src/services/logframe.service",
  "../src/services/measurement.service",
  "../src/services/survey.service",
  "../src/services/diagnostics.service",
  "../src/middleware/maintenance-mode"
];

const UPLOAD_DIRS = [
  env.uploadRoot,
  "public/uploads/activity-reports",
  "public/uploads/expenses",
  env.backupDir,
  env.logDir,
  "storage/tmp"
];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function checkTables() {
  for (const table of REQUIRED_TABLES) {
    if (await tableExists(table)) {
      pass(`table exists: ${table}`);
    } else {
      fail(`missing table: ${table}`);
    }
  }
}

function checkMigrationsExist() {
  REQUIRED_MIGRATIONS.forEach((migration) => {
    const filePath = path.join(process.cwd(), "src", "db", "migrations", migration);
    if (fs.existsSync(filePath)) {
      pass(`migration exists: ${migration}`);
    } else {
      fail(`missing migration file: ${migration}`);
    }
  });
}

async function checkLicenses() {
  const expected = getModuleCodes();
  const [licenses] = await pool.query("SELECT id, modules_json FROM licenses WHERE status = 'active'");
  const missing = [];

  licenses.forEach((license) => {
    const modules = parseJsonField(license.modules_json, {});
    expected.forEach((code) => {
      const hasKey = Array.isArray(modules)
        ? modules.includes(code)
        : modules && typeof modules === "object" && Object.prototype.hasOwnProperty.call(modules, code);
      if (!hasKey) {
        missing.push({ license_id: license.id, code });
      }
    });
  });

  if (missing.length) {
    fail(`active licenses missing module keys: ${JSON.stringify(missing)}`);
  } else {
    pass("active license module keys normalized");
  }
}

async function checkDeveloperAdmin() {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE user_type = 'developer' AND tenant_id IS NULL AND status = 'active'"
  );
  if (Number(row.total) > 0) {
    pass("active developer admin exists");
  } else {
    fail("no active developer admin found");
  }
}

function checkModuleLoads() {
  LOAD_CHECKS.forEach((modulePath) => {
    try {
      require(modulePath);
      pass(`module loads: ${modulePath}`);
    } catch (error) {
      fail(`module failed to load: ${modulePath} (${error.message})`);
    }
  });
}

function checkUploadDirs() {
  UPLOAD_DIRS.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    fs.mkdirSync(fullPath, { recursive: true });
    fs.accessSync(fullPath, fs.constants.W_OK);
    pass(`upload directory writable: ${dir}`);
  });
}

function checkHealthRouteExists() {
  const appSource = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");
  if (appSource.includes('app.get("/health"') || appSource.includes("app.get('/health'")) {
    pass("health endpoint route is registered");
  } else {
    fail("health endpoint route is not registered");
  }
}

function runPhase6VerifyIfAvailable() {
  const scriptPath = path.join(process.cwd(), "scripts", "verify-phase6.js");
  if (!fs.existsSync(scriptPath)) {
    pass("Phase 6 verify script not present; skipped");
    return;
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status === 0) {
    pass("Phase 6 verify script passes");
  } else {
    fail(`Phase 6 verify script failed: ${result.stderr || result.stdout}`);
  }
}

async function checkAuditIsolation() {
  const [tenants] = await pool.query("SELECT id FROM tenants ORDER BY id ASC LIMIT 2");
  if (!tenants.length) {
    fail("audit isolation check requires at least one tenant");
    return;
  }

  const tenantA = tenants[0].id;
  const tenantB = tenants[1] ? tenants[1].id : null;
  const ipAddress = "127.0.0.77";
  const insertedIds = [];

  try {
    const rows = [
      [null, null, "developer.login", "user", null, JSON.stringify({ qa: true }), ipAddress],
      [tenantA, null, "staff.created", "staff", "qa-a", JSON.stringify({ qa: true }), ipAddress],
      [tenantA, null, "license.updated", "license", "qa-license", JSON.stringify({ qa: true }), ipAddress],
      [tenantA, null, "tenant.created", "tenant", String(tenantA), JSON.stringify({ qa: true }), ipAddress]
    ];

    if (tenantB) {
      rows.push([tenantB, null, "staff.created", "staff", "qa-b", JSON.stringify({ qa: true }), ipAddress]);
    }

    for (const row of rows) {
      const [result] = await pool.query(
        `
          INSERT INTO audit_logs (
            tenant_id, user_id, action, entity_type, entity_id, metadata_json, ip_address
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        row
      );
      insertedIds.push(result.insertId);
    }

    const tenantLogs = await auditLogRepo.listTenantAuditLogs(tenantA, {}, 20);
    const qaTenantLogs = tenantLogs.filter((log) => log.ip_address === ipAddress);
    const actions = qaTenantLogs.map((log) => log.action).sort();

    if (actions.length !== 1 || actions[0] !== "staff.created") {
      fail(`tenant audit isolation failed; tenant saw actions: ${actions.join(", ") || "none"}`);
    } else {
      pass("tenant audit query excludes system, other-tenant, license, and tenant lifecycle logs");
    }

    const developerLogs = await auditLogRepo.listDeveloperAuditLogs({ action: "developer." }, 20);
    if (developerLogs.some((log) => log.ip_address === ipAddress && log.action === "developer.login")) {
      pass("developer audit query can see developer/system logs");
    } else {
      fail("developer audit query could not see temporary developer/system log");
    }
  } finally {
    if (insertedIds.length) {
      await pool.query("DELETE FROM audit_logs WHERE id IN (?)", [insertedIds]);
    }
  }
}

async function main() {
  checkMigrationsExist();
  await checkTables();
  await checkLicenses();
  await checkDeveloperAdmin();
  await checkAuditIsolation();
  checkHealthRouteExists();
  checkModuleLoads();
  checkUploadDirs();
  runPhase6VerifyIfAvailable();
}

main()
  .catch((error) => {
    fail(error.stack || error.message);
  })
  .finally(async () => {
    await pool.end();
  });
