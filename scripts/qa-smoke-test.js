const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const pool = require("../src/db/pool");
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
  "notifications",
  "messages"
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
  "../src/repos/report.repo",
  "../src/repos/notification.repo",
  "../src/repos/message.repo"
];

const UPLOAD_DIRS = [
  "public/uploads/activity-reports",
  "public/uploads/expenses"
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

async function main() {
  await checkTables();
  await checkLicenses();
  await checkDeveloperAdmin();
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
