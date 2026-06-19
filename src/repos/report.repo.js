const pool = require("../db/pool");

function addCommonFilters(where, params, alias, filters) {
  if (filters.date_from) {
    where.push(`${alias}.created_at >= ?`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push(`${alias}.created_at <= ?`);
    params.push(filters.date_to);
  }
  if (filters.status) {
    where.push(`${alias}.status = ?`);
    params.push(filters.status);
  }
}

async function staffRegister(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["sm.tenant_id = ?"];
  if (filters.department_id) {
    where.push("sm.department_id = ?");
    params.push(filters.department_id);
  }
  if (filters.branch_id) {
    where.push("sm.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.status) {
    where.push("sm.status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT sm.staff_code, CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS full_name,
             sm.employment_type, d.department_name AS department, b.name AS branch,
             sm.position_title AS position, sm.phone, sm.email, sm.status, sm.start_date
      FROM staff_members sm
      LEFT JOIN departments d ON d.id = sm.department_id AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b ON b.id = sm.branch_id AND b.tenant_id = sm.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY sm.staff_code ASC
    `,
    params
  );
  return rows;
}

async function attendanceSummary(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?"];
  if (filters.date_from) {
    where.push("ar.attendance_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("ar.attendance_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.department_id) {
    where.push("sm.department_id = ?");
    params.push(filters.department_id);
  }
  if (filters.branch_id) {
    where.push("sm.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.staff_member_id) {
    where.push("ar.staff_member_id = ?");
    params.push(filters.staff_member_id);
  }
  const [rows] = await db.query(
    `
      SELECT sm.staff_code, CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS full_name,
             d.department_name AS department, b.name AS branch,
             SUM(ar.status = 'present') AS present_count,
             SUM(ar.status = 'absent') AS absent_count,
             SUM(ar.status = 'late') AS late_count,
             SUM(ar.status = 'on_leave') AS on_leave_count,
             ? AS date_from, ? AS date_to
      FROM attendance_records ar
      INNER JOIN staff_members sm ON sm.id = ar.staff_member_id AND sm.tenant_id = ar.tenant_id
      LEFT JOIN departments d ON d.id = sm.department_id AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b ON b.id = sm.branch_id AND b.tenant_id = sm.tenant_id
      WHERE ${where.join(" AND ")}
      GROUP BY sm.id, sm.staff_code, full_name, department, branch
      ORDER BY sm.staff_code ASC
    `,
    [filters.date_from || "", filters.date_to || "", ...params]
  );
  return rows;
}

async function geofenceExceptions(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?", "ar.geofence_status = 'outside'"];
  if (filters.date_from) {
    where.push("ar.attendance_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("ar.attendance_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.branch_id) {
    where.push("ar.branch_id = ?");
    params.push(filters.branch_id);
  }
  const [rows] = await db.query(
    `
      SELECT ar.attendance_date, sm.staff_code, CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS full_name,
             b.name AS branch, ar.latitude, ar.longitude, ar.distance_from_branch_meters, ar.geofence_status
      FROM attendance_records ar
      INNER JOIN staff_members sm ON sm.id = ar.staff_member_id AND sm.tenant_id = ar.tenant_id
      LEFT JOIN branches b ON b.id = ar.branch_id AND b.tenant_id = ar.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY ar.attendance_date DESC, ar.id DESC
    `,
    params
  );
  return rows;
}

async function projectPortfolio(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["p.tenant_id = ?"];
  if (filters.branch_id) {
    where.push("p.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.status) {
    where.push("p.status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT p.project_code, p.project_name, b.name AS branch, manager.full_name AS manager,
             p.donor_name, p.budget, p.status, p.completion_percentage, p.start_date, p.end_date
      FROM projects p
      LEFT JOIN branches b ON b.id = p.branch_id AND b.tenant_id = p.tenant_id
      LEFT JOIN users manager ON manager.id = p.project_manager_id AND manager.tenant_id = p.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.created_at DESC
    `,
    params
  );
  return rows;
}

async function activityRegister(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?"];
  if (filters.date_from) {
    where.push("ar.report_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("ar.report_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.project_id) {
    where.push("ar.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.branch_id) {
    where.push("ar.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.status) {
    where.push("ar.status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT ar.report_code, ar.title, p.project_name AS project, b.name AS branch, ar.report_type,
             ar.report_date, ar.beneficiaries_reached, ar.status
      FROM activity_reports ar
      INNER JOIN projects p ON p.id = ar.project_id AND p.tenant_id = ar.tenant_id
      LEFT JOIN branches b ON b.id = ar.branch_id AND b.tenant_id = ar.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY ar.report_date DESC, ar.id DESC
    `,
    params
  );
  return rows;
}

async function beneficiarySummary(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["ar.tenant_id = ?", "ar.status = 'approved'"];
  if (filters.date_from) {
    where.push("ar.report_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("ar.report_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.project_id) {
    where.push("ar.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.branch_id) {
    where.push("ar.branch_id = ?");
    params.push(filters.branch_id);
  }
  const [rows] = await db.query(
    `
      SELECT p.project_name AS project, COALESCE(b.name, 'Unassigned') AS branch,
             SUM(ar.beneficiaries_reached) AS total_beneficiaries,
             SUM(ar.male_beneficiaries) AS male_beneficiaries,
             SUM(ar.female_beneficiaries) AS female_beneficiaries,
             SUM(ar.youth_beneficiaries) AS youth_beneficiaries
      FROM activity_reports ar
      INNER JOIN projects p ON p.id = ar.project_id AND p.tenant_id = ar.tenant_id
      LEFT JOIN branches b ON b.id = ar.branch_id AND b.tenant_id = ar.tenant_id
      WHERE ${where.join(" AND ")}
      GROUP BY p.id, project, branch
      ORDER BY project ASC
    `,
    params
  );
  return rows;
}

async function indicatorProgress(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["pi.tenant_id = ?"];
  if (filters.project_id) {
    where.push("pi.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.status) {
    where.push("pi.status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT p.project_name AS project, pi.indicator_name, pi.target_value, pi.current_value, pi.unit,
             CASE WHEN pi.target_value > 0 THEN ROUND((pi.current_value / pi.target_value) * 100, 2) ELSE 0 END AS progress_percentage,
             pi.status
      FROM project_indicators pi
      INNER JOIN projects p ON p.id = pi.project_id AND p.tenant_id = pi.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.project_name ASC, pi.indicator_name ASC
    `,
    params
  );
  return rows;
}

async function payrollSummary(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["tenant_id = ?"];
  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT payroll_month, payroll_year, status, total_gross, total_deductions, total_net
      FROM payroll_runs
      WHERE ${where.join(" AND ")}
      ORDER BY payroll_year DESC, payroll_month DESC
    `,
    params
  );
  return rows;
}

async function expenseRegister(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["e.tenant_id = ?"];
  if (filters.date_from) {
    where.push("e.expense_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("e.expense_date <= ?");
    params.push(filters.date_to);
  }
  if (filters.project_id) {
    where.push("e.project_id = ?");
    params.push(filters.project_id);
  }
  if (filters.branch_id) {
    where.push("e.branch_id = ?");
    params.push(filters.branch_id);
  }
  if (filters.status) {
    where.push("e.status = ?");
    params.push(filters.status);
  }
  const [rows] = await db.query(
    `
      SELECT e.expense_code, e.expense_date, p.project_name AS project, b.name AS branch, fc.name AS category,
             e.description, e.amount, e.payment_method, e.status
      FROM expenses e
      LEFT JOIN projects p ON p.id = e.project_id AND p.tenant_id = e.tenant_id
      LEFT JOIN branches b ON b.id = e.branch_id AND b.tenant_id = e.tenant_id
      INNER JOIN finance_categories fc ON fc.id = e.category_id AND fc.tenant_id = e.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.expense_date DESC, e.id DESC
    `,
    params
  );
  return rows;
}

async function budgetUtilization(tenantId, filters = {}, db = pool) {
  const params = [tenantId];
  const where = ["pb.tenant_id = ?"];
  if (filters.project_id) {
    where.push("pb.project_id = ?");
    params.push(filters.project_id);
  }
  const [rows] = await db.query(
    `
      SELECT p.project_name AS project, fc.name AS category, pb.budget_amount, pb.spent_amount,
             (pb.budget_amount - pb.spent_amount) AS remaining_amount,
             CASE WHEN pb.budget_amount > 0 THEN ROUND((pb.spent_amount / pb.budget_amount) * 100, 2) ELSE 0 END AS utilization_percentage
      FROM project_budgets pb
      INNER JOIN projects p ON p.id = pb.project_id AND p.tenant_id = pb.tenant_id
      INNER JOIN finance_categories fc ON fc.id = pb.category_id AND fc.tenant_id = pb.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.project_name ASC, fc.name ASC
    `,
    params
  );
  return rows;
}

module.exports = {
  staffRegister,
  attendanceSummary,
  geofenceExceptions,
  projectPortfolio,
  activityRegister,
  beneficiarySummary,
  indicatorProgress,
  payrollSummary,
  expenseRegister,
  budgetUtilization
};
