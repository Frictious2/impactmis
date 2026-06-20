require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");
const env = require("../src/config/env");

const tenantCode = process.env.DEMO_TENANT_CODE || "DEMO-NGO";
const adminEmail = process.env.DEMO_ADMIN_EMAIL || "tenantadmin@demo.local";
const donorEmail = process.env.DEMO_DONOR_EMAIL || "donor@demo.local";

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function count(sql, params = []) {
  const row = await one(sql, params);
  return Number(row?.total || 0);
}

async function main() {
  const tenant = await one("SELECT * FROM tenants WHERE tenant_code = ? LIMIT 1", [tenantCode]);
  if (!tenant) {
    fail(`demo tenant not found: ${tenantCode}`);
    return;
  }
  pass(`demo tenant exists: ${tenant.name}`);

  const license = await one(
    "SELECT * FROM licenses WHERE tenant_id = ? AND status = 'active' AND NOW() BETWEEN starts_at AND expires_at LIMIT 1",
    [tenant.id]
  );
  license ? pass("active demo license exists") : fail("active demo license missing");

  const admin = await one("SELECT * FROM users WHERE tenant_id = ? AND LOWER(email) = LOWER(?) AND status = 'active' LIMIT 1", [
    tenant.id,
    adminEmail
  ]);
  admin ? pass("tenant admin login account exists") : fail("tenant admin login account missing");

  const donor = await one("SELECT * FROM users WHERE tenant_id = ? AND LOWER(email) = LOWER(?) AND role = 'Donor' AND status = 'active' LIMIT 1", [
    tenant.id,
    donorEmail
  ]);
  donor ? pass("donor login account exists") : fail("donor login account missing");

  (await count("SELECT COUNT(*) AS total FROM staff_members WHERE tenant_id = ?", [tenant.id])) > 0
    ? pass("sample staff exists")
    : fail("sample staff missing");
  (await count("SELECT COUNT(*) AS total FROM projects WHERE tenant_id = ?", [tenant.id])) > 0
    ? pass("sample project exists")
    : fail("sample project missing");
  (await count("SELECT COUNT(*) AS total FROM activity_reports WHERE tenant_id = ?", [tenant.id])) > 0
    ? pass("sample activity report exists")
    : fail("sample activity report missing");

  const backupDir = path.join(process.cwd(), env.backupDir);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.accessSync(backupDir, fs.constants.W_OK);
  pass("backup directory writable");

  require("../src/services/report.service");
  pass("reports center service loads");
}

main()
  .catch((error) => {
    fail(error.stack || error.message);
  })
  .finally(async () => {
    await pool.end();
  });
