require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../src/db/pool");
const { ensureDatabaseExists } = require("../src/db/bootstrap");

const MODULE_CODES = ["staff", "attendance", "branches", "projects", "reports", "donors", "payroll", "finance", "approvals"];

const cfg = {
  tenantCode: process.env.DEMO_TENANT_CODE || "DEMO-NGO",
  tenantName: process.env.DEMO_TENANT_NAME || "Demo NGO",
  adminEmail: process.env.DEMO_ADMIN_EMAIL || "tenantadmin@demo.local",
  adminPassword: process.env.DEMO_ADMIN_PASSWORD || "ChangeMe123!",
  donorEmail: process.env.DEMO_DONOR_EMAIL || "donor@demo.local",
  donorPassword: process.env.DEMO_DONOR_PASSWORD || "ChangeMe123!"
};

function slugify(value) {
  return String(value || "demo-ngo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function ensureTenant() {
  const existing = await one("SELECT * FROM tenants WHERE tenant_code = ? LIMIT 1", [cfg.tenantCode]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO tenants (name, tenant_code, slug, contact_name, contact_email, contact_phone, country, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Sierra Leone', 'active')`,
    [cfg.tenantName, cfg.tenantCode, slugify(cfg.tenantName), "Demo Contact", cfg.adminEmail, "+232 00 000000"]
  );
  return one("SELECT * FROM tenants WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureLicense(tenantId) {
  const existing = await one("SELECT * FROM licenses WHERE tenant_id = ? AND status = 'active' LIMIT 1", [tenantId]);
  const modules = MODULE_CODES.reduce((map, code) => {
    map[code] = true;
    return map;
  }, {});
  if (existing) {
    await pool.query("UPDATE licenses SET modules_json = ?, expires_at = DATE_ADD(CURDATE(), INTERVAL 12 MONTH) WHERE id = ?", [
      JSON.stringify(modules),
      existing.id
    ]);
    return one("SELECT * FROM licenses WHERE id = ? LIMIT 1", [existing.id]);
  }
  const [result] = await pool.query(
    `INSERT INTO licenses (tenant_id, plan_name, duration_months, starts_at, expires_at, status, modules_json, seat_limit)
     VALUES (?, 'Pilot Demo', 12, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 'active', ?, 25)`,
    [tenantId, JSON.stringify(modules)]
  );
  return one("SELECT * FROM licenses WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureUser(tenantId, fullName, email, password, role) {
  const existing = await one("SELECT * FROM users WHERE tenant_id = ? AND LOWER(email) = LOWER(?) LIMIT 1", [tenantId, email]);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    `INSERT INTO users (tenant_id, full_name, email, password_hash, role, user_type, status, must_change_password, tenant_scope_key)
     VALUES (?, ?, ?, ?, ?, 'tenant', 'active', 0, ?)`,
    [tenantId, fullName, email, passwordHash, role, String(tenantId)]
  );
  return one("SELECT * FROM users WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureOrganization(tenantId) {
  const existing = await one("SELECT id FROM organization_profiles WHERE tenant_id = ? LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO organization_profiles
      (tenant_id, organization_name, address, city, district, country, registration_number, website, email, phone, mission_statement, organization_type, fiscal_year_start_month)
     VALUES (?, ?, '12 Demo Street', 'Freetown', 'Western Area', 'Sierra Leone', 'DEMO-REG-001', 'https://demo.local', ?, '+232 00 000000', 'Improving community outcomes through accountable programming.', 'NGO', 1)`,
    [tenantId, cfg.tenantName, cfg.adminEmail]
  );
  return { id: result.insertId };
}

async function ensureDepartment(tenantId, name, description) {
  const existing = await one("SELECT * FROM departments WHERE tenant_id = ? AND department_name = ? LIMIT 1", [tenantId, name]);
  if (existing) return existing;
  const [result] = await pool.query(
    "INSERT INTO departments (tenant_id, department_name, description, status) VALUES (?, ?, ?, 'active')",
    [tenantId, name, description]
  );
  return one("SELECT * FROM departments WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureBranch(tenantId, userId) {
  const existing = await one("SELECT * FROM branches WHERE tenant_id = ? AND branch_code = 'HQ' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO branches
      (tenant_id, branch_code, name, address, city, district, latitude, longitude, geofence_radius_meters, contact_name, contact_phone, status, created_by, updated_by)
     VALUES (?, 'HQ', 'Head Office', '12 Demo Street', 'Freetown', 'Western Area', 8.46570000, -13.23170000, 150, 'Demo Contact', '+232 00 000000', 'active', ?, ?)`,
    [tenantId, userId, userId]
  );
  return one("SELECT * FROM branches WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureStaff(tenantId, userId, departmentId, branchId) {
  const existing = await one("SELECT * FROM staff_members WHERE tenant_id = ? AND staff_code = 'STF-0001' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO staff_members
      (tenant_id, staff_code, first_name, last_name, gender, phone, email, address, department_id, branch_id, position_title, employment_type, start_date, status, emergency_contact_name, emergency_contact_phone, created_by, updated_by)
     VALUES (?, 'STF-0001', 'Aminata', 'Kamara', 'female', '+232 76 000001', 'aminata@demo.local', 'Freetown', ?, ?, 'Program Officer', 'staff', CURDATE(), 'active', 'Mohamed Kamara', '+232 76 000002', ?, ?)`,
    [tenantId, departmentId, branchId, userId, userId]
  );
  return one("SELECT * FROM staff_members WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureProject(tenantId, adminUserId, branchId) {
  const existing = await one("SELECT * FROM projects WHERE tenant_id = ? AND project_code = 'PRJ-DEMO-001' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO projects
      (tenant_id, project_code, project_name, project_description, branch_id, project_manager_id, donor_name, budget, start_date, end_date, status, completion_percentage, created_by, updated_by)
     VALUES (?, 'PRJ-DEMO-001', 'Community Health Outreach Pilot', 'Demo project for pilot walkthrough and donor accountability.', ?, ?, 'Demo Donor Fund', 50000.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 'active', 25, ?, ?)`,
    [tenantId, branchId, adminUserId, adminUserId, adminUserId]
  );
  return one("SELECT * FROM projects WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureTask(tenantId, projectId, staffId, userId) {
  const existing = await one("SELECT * FROM project_tasks WHERE tenant_id = ? AND project_id = ? AND title = 'Conduct baseline community visit' LIMIT 1", [tenantId, projectId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO project_tasks (tenant_id, project_id, assigned_staff_id, title, description, due_date, priority, status, completion_percentage, created_by, updated_by)
     VALUES (?, ?, ?, 'Conduct baseline community visit', 'Collect initial beneficiary and service access information.', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'high', 'in_progress', 40, ?, ?)`,
    [tenantId, projectId, staffId, userId, userId]
  );
  return one("SELECT * FROM project_tasks WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureActivityReport(tenantId, projectId, taskId, staffId, branchId, userId) {
  const existing = await one("SELECT * FROM activity_reports WHERE tenant_id = ? AND report_code = 'AR-DEMO-001' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO activity_reports
      (tenant_id, report_code, project_id, task_id, staff_member_id, branch_id, report_date, report_type, title, summary, activities_completed, challenges, recommendations, beneficiaries_reached, male_beneficiaries, female_beneficiaries, youth_beneficiaries, status, submitted_by, approved_by, approved_at)
     VALUES (?, 'AR-DEMO-001', ?, ?, ?, ?, CURDATE(), 'field_visit', 'Pilot outreach field visit', 'Demo approved report for donor and M&E review.', 'Community meeting and household visits completed.', 'Transport delays noted.', 'Plan earlier vehicle booking.', 120, 55, 65, 40, 'approved', ?, ?, NOW())`,
    [tenantId, projectId, taskId, staffId, branchId, userId, userId]
  );
  return one("SELECT * FROM activity_reports WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureIndicator(tenantId, projectId, userId) {
  const existing = await one("SELECT * FROM project_indicators WHERE tenant_id = ? AND project_id = ? AND indicator_name = 'Households reached' LIMIT 1", [tenantId, projectId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO project_indicators (tenant_id, project_id, indicator_name, description, target_value, current_value, unit, status, created_by, updated_by)
     VALUES (?, ?, 'Households reached', 'Number of households reached through outreach.', 500, 120, 'households', 'active', ?, ?)`,
    [tenantId, projectId, userId, userId]
  );
  return one("SELECT * FROM project_indicators WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureFinanceCategory(tenantId, userId) {
  const existing = await one("SELECT * FROM finance_categories WHERE tenant_id = ? AND code = 'TRAIN' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    "INSERT INTO finance_categories (tenant_id, name, code, category_type, description, status, created_by, updated_by) VALUES (?, 'Training & Outreach', 'TRAIN', 'expense', 'Pilot outreach expenses', 'active', ?, ?)",
    [tenantId, userId, userId]
  );
  return one("SELECT * FROM finance_categories WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureExpense(tenantId, projectId, branchId, categoryId, userId) {
  const existing = await one("SELECT * FROM expenses WHERE tenant_id = ? AND expense_code = 'EXP-DEMO-001' LIMIT 1", [tenantId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO expenses
      (tenant_id, expense_code, project_id, branch_id, category_id, expense_date, vendor_name, description, amount, payment_method, receipt_number, status, submitted_by, approved_by, approved_at)
     VALUES (?, 'EXP-DEMO-001', ?, ?, ?, CURDATE(), 'Demo Supplies Vendor', 'Refreshments and materials for outreach meeting.', 1250.00, 'cash', 'DEMO-RCPT-001', 'approved', ?, ?, NOW())`,
    [tenantId, projectId, branchId, categoryId, userId, userId]
  );
  return one("SELECT * FROM expenses WHERE id = ? LIMIT 1", [result.insertId]);
}

async function ensureCompensation(tenantId, staffId, userId) {
  const existing = await one("SELECT * FROM staff_compensation WHERE tenant_id = ? AND staff_member_id = ? AND status = 'active' LIMIT 1", [tenantId, staffId]);
  if (existing) return existing;
  const [result] = await pool.query(
    `INSERT INTO staff_compensation (tenant_id, staff_member_id, base_salary, pay_type, currency, effective_from, status, created_by, updated_by)
     VALUES (?, ?, 3500.00, 'monthly', 'NLe', CURDATE(), 'active', ?, ?)`,
    [tenantId, staffId, userId, userId]
  );
  return one("SELECT * FROM staff_compensation WHERE id = ? LIMIT 1", [result.insertId]);
}

async function main() {
  await ensureDatabaseExists();
  const tenant = await ensureTenant();
  const license = await ensureLicense(tenant.id);
  const admin = await ensureUser(tenant.id, "Demo Tenant Admin", cfg.adminEmail, cfg.adminPassword, "Tenant Admin");
  const donor = await ensureUser(tenant.id, "Demo Donor User", cfg.donorEmail, cfg.donorPassword, "Donor");
  await ensureOrganization(tenant.id);
  const programs = await ensureDepartment(tenant.id, "Programs", "Program delivery and field implementation.");
  await ensureDepartment(tenant.id, "Finance", "Finance and compliance.");
  const branch = await ensureBranch(tenant.id, admin.id);
  const staff = await ensureStaff(tenant.id, admin.id, programs.id, branch.id);
  const project = await ensureProject(tenant.id, admin.id, branch.id);
  const task = await ensureTask(tenant.id, project.id, staff.id, admin.id);
  const report = await ensureActivityReport(tenant.id, project.id, task.id, staff.id, branch.id, admin.id);
  const indicator = await ensureIndicator(tenant.id, project.id, admin.id);
  const category = await ensureFinanceCategory(tenant.id, admin.id);
  const expense = await ensureExpense(tenant.id, project.id, branch.id, category.id, admin.id);
  const compensation = await ensureCompensation(tenant.id, staff.id, admin.id);

  console.log("Demo tenant seed complete.");
  console.log(`Tenant: ${tenant.name} (${tenant.tenant_code})`);
  console.log(`License: ${license.plan_name} active until ${license.expires_at}`);
  console.log(`Tenant Admin: ${cfg.adminEmail} / ${cfg.adminPassword}`);
  console.log(`Donor User: ${cfg.donorEmail} / ${cfg.donorPassword}`);
  console.log(`Sample project: ${project.project_code} - ${project.project_name}`);
  console.log(`Sample activity report: ${report.report_code}`);
  console.log(`Sample indicator: ${indicator.indicator_name}`);
  console.log(`Sample expense: ${expense.expense_code}`);
  console.log(`Sample compensation id: ${compensation.id}`);
}

main()
  .catch((error) => {
    console.error("Demo tenant seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
