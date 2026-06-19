const pool = require("../db/pool");

async function getPayrollSettings(tenantId, db = pool) {
  const [rows] = await db.query("SELECT * FROM payroll_settings WHERE tenant_id = ? LIMIT 1", [tenantId]);
  return rows[0] || null;
}

async function upsertPayrollSettings(tenantId, payload, db = pool) {
  await db.query(
    `
      INSERT INTO payroll_settings (
        tenant_id,
        currency,
        pay_frequency,
        default_work_days_per_month,
        default_work_hours_per_day,
        overtime_enabled,
        approval_required
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        currency = VALUES(currency),
        pay_frequency = VALUES(pay_frequency),
        default_work_days_per_month = VALUES(default_work_days_per_month),
        default_work_hours_per_day = VALUES(default_work_hours_per_day),
        overtime_enabled = VALUES(overtime_enabled),
        approval_required = VALUES(approval_required)
    `,
    [
      tenantId,
      payload.currency,
      payload.pay_frequency,
      payload.default_work_days_per_month,
      payload.default_work_hours_per_day,
      payload.overtime_enabled ? 1 : 0,
      payload.approval_required ? 1 : 0
    ]
  );

  return getPayrollSettings(tenantId, db);
}

async function listCompensation(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        sm.id AS staff_member_id,
        sm.staff_code,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        sm.status AS staff_status,
        d.department_name,
        b.name AS branch_name,
        sc.id AS compensation_id,
        sc.base_salary,
        sc.pay_type,
        sc.currency,
        sc.effective_from,
        sc.effective_to,
        sc.status AS compensation_status
      FROM staff_members sm
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b
        ON b.id = sm.branch_id
       AND b.tenant_id = sm.tenant_id
      LEFT JOIN staff_compensation sc
        ON sc.id = (
          SELECT sc2.id
          FROM staff_compensation sc2
          WHERE sc2.tenant_id = sm.tenant_id
            AND sc2.staff_member_id = sm.id
            AND sc2.status = 'active'
          ORDER BY sc2.effective_from DESC, sc2.id DESC
          LIMIT 1
        )
      WHERE sm.tenant_id = ?
      ORDER BY sm.staff_code ASC, staff_name ASC
    `,
    [tenantId]
  );

  return rows;
}

async function deactivateActiveCompensation(tenantId, staffMemberId, db = pool) {
  await db.query(
    `
      UPDATE staff_compensation
      SET status = 'inactive',
          effective_to = COALESCE(effective_to, CURDATE())
      WHERE tenant_id = ?
        AND staff_member_id = ?
        AND status = 'active'
    `,
    [tenantId, staffMemberId]
  );
}

async function createCompensation(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO staff_compensation (
        tenant_id,
        staff_member_id,
        base_salary,
        pay_type,
        currency,
        effective_from,
        effective_to,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.staff_member_id,
      payload.base_salary,
      payload.pay_type,
      payload.currency,
      payload.effective_from,
      payload.effective_to,
      payload.status || "active",
      userId || null,
      userId || null
    ]
  );

  return findCompensationById(tenantId, result.insertId, db);
}

async function findCompensationById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM staff_compensation WHERE tenant_id = ? AND id = ? LIMIT 1", [
    tenantId,
    id
  ]);
  return rows[0] || null;
}

async function listAllowanceTypes(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM allowance_types WHERE tenant_id = ? ORDER BY status ASC, name ASC",
    [tenantId]
  );
  return rows;
}

async function listActiveAllowanceTypes(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM allowance_types WHERE tenant_id = ? AND status = 'active' ORDER BY name ASC",
    [tenantId]
  );
  return rows;
}

async function createAllowanceType(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO allowance_types (
        tenant_id,
        name,
        code,
        description,
        calculation_type,
        default_amount,
        taxable,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.name,
      payload.code,
      payload.description,
      payload.calculation_type,
      payload.default_amount,
      payload.taxable ? 1 : 0,
      payload.status,
      userId || null,
      userId || null
    ]
  );

  return findAllowanceTypeById(tenantId, result.insertId, db);
}

async function updateAllowanceType(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE allowance_types
      SET name = ?,
          code = ?,
          description = ?,
          calculation_type = ?,
          default_amount = ?,
          taxable = ?,
          status = ?,
          updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.name,
      payload.code,
      payload.description,
      payload.calculation_type,
      payload.default_amount,
      payload.taxable ? 1 : 0,
      payload.status,
      userId || null,
      tenantId,
      id
    ]
  );
  return findAllowanceTypeById(tenantId, id, db);
}

async function findAllowanceTypeById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM allowance_types WHERE tenant_id = ? AND id = ? LIMIT 1", [
    tenantId,
    id
  ]);
  return rows[0] || null;
}

async function existsAllowanceCode(tenantId, code, excludeId = null, db = pool) {
  const params = [tenantId, code];
  let sql = "SELECT id FROM allowance_types WHERE tenant_id = ? AND code = ?";
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function listDeductionTypes(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM deduction_types WHERE tenant_id = ? ORDER BY status ASC, name ASC",
    [tenantId]
  );
  return rows;
}

async function listActiveDeductionTypes(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM deduction_types WHERE tenant_id = ? AND status = 'active' ORDER BY name ASC",
    [tenantId]
  );
  return rows;
}

async function createDeductionType(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO deduction_types (
        tenant_id,
        name,
        code,
        description,
        calculation_type,
        default_amount,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.name,
      payload.code,
      payload.description,
      payload.calculation_type,
      payload.default_amount,
      payload.status,
      userId || null,
      userId || null
    ]
  );

  return findDeductionTypeById(tenantId, result.insertId, db);
}

async function updateDeductionType(tenantId, id, payload, userId, db = pool) {
  await db.query(
    `
      UPDATE deduction_types
      SET name = ?,
          code = ?,
          description = ?,
          calculation_type = ?,
          default_amount = ?,
          status = ?,
          updated_by = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [
      payload.name,
      payload.code,
      payload.description,
      payload.calculation_type,
      payload.default_amount,
      payload.status,
      userId || null,
      tenantId,
      id
    ]
  );
  return findDeductionTypeById(tenantId, id, db);
}

async function findDeductionTypeById(tenantId, id, db = pool) {
  const [rows] = await db.query("SELECT * FROM deduction_types WHERE tenant_id = ? AND id = ? LIMIT 1", [
    tenantId,
    id
  ]);
  return rows[0] || null;
}

async function existsDeductionCode(tenantId, code, excludeId = null, db = pool) {
  const params = [tenantId, code];
  let sql = "SELECT id FROM deduction_types WHERE tenant_id = ? AND code = ?";
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function createStaffAllowance(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO staff_allowances (
        tenant_id,
        staff_member_id,
        allowance_type_id,
        amount,
        effective_from,
        effective_to,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.staff_member_id,
      payload.allowance_type_id,
      payload.amount,
      payload.effective_from,
      payload.effective_to,
      payload.status,
      userId || null,
      userId || null
    ]
  );
  return result.insertId;
}

async function createStaffDeduction(tenantId, payload, userId, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO staff_deductions (
        tenant_id,
        staff_member_id,
        deduction_type_id,
        amount,
        effective_from,
        effective_to,
        status,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId,
      payload.staff_member_id,
      payload.deduction_type_id,
      payload.amount,
      payload.effective_from,
      payload.effective_to,
      payload.status,
      userId || null,
      userId || null
    ]
  );
  return result.insertId;
}

async function listStaffAllowances(tenantId, staffMemberId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT sa.*, at.name, at.code, at.calculation_type, at.taxable
      FROM staff_allowances sa
      INNER JOIN allowance_types at
        ON at.id = sa.allowance_type_id
       AND at.tenant_id = sa.tenant_id
      WHERE sa.tenant_id = ?
        AND sa.staff_member_id = ?
      ORDER BY sa.status ASC, sa.effective_from DESC, sa.id DESC
    `,
    [tenantId, staffMemberId]
  );
  return rows;
}

async function listStaffDeductions(tenantId, staffMemberId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT sd.*, dt.name, dt.code, dt.calculation_type
      FROM staff_deductions sd
      INNER JOIN deduction_types dt
        ON dt.id = sd.deduction_type_id
       AND dt.tenant_id = sd.tenant_id
      WHERE sd.tenant_id = ?
        AND sd.staff_member_id = ?
      ORDER BY sd.status ASC, sd.effective_from DESC, sd.id DESC
    `,
    [tenantId, staffMemberId]
  );
  return rows;
}

async function getPayrollGenerationRows(tenantId, periodStart, periodEnd, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        sm.id AS staff_member_id,
        sm.staff_code,
        CONCAT_WS(' ', sm.first_name, sm.middle_name, sm.last_name) AS staff_name,
        d.department_name,
        b.name AS branch_name,
        sc.base_salary,
        sc.pay_type,
        sc.currency,
        COALESCE(allowance_totals.total_amount, 0) AS allowance_total,
        COALESCE(deduction_totals.total_amount, 0) AS deduction_total,
        COALESCE(attendance_totals.days_present, 0) AS attendance_days_present,
        COALESCE(attendance_totals.days_absent, 0) AS attendance_days_absent
      FROM staff_members sm
      INNER JOIN staff_compensation sc
        ON sc.id = (
          SELECT sc2.id
          FROM staff_compensation sc2
          WHERE sc2.tenant_id = sm.tenant_id
            AND sc2.staff_member_id = sm.id
            AND sc2.status = 'active'
            AND sc2.effective_from <= ?
            AND (sc2.effective_to IS NULL OR sc2.effective_to >= ?)
          ORDER BY sc2.effective_from DESC, sc2.id DESC
          LIMIT 1
        )
      LEFT JOIN departments d
        ON d.id = sm.department_id
       AND d.tenant_id = sm.tenant_id
      LEFT JOIN branches b
        ON b.id = sm.branch_id
       AND b.tenant_id = sm.tenant_id
      LEFT JOIN (
        SELECT tenant_id, staff_member_id, SUM(amount) AS total_amount
        FROM staff_allowances
        WHERE tenant_id = ?
          AND status = 'active'
          AND effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
        GROUP BY tenant_id, staff_member_id
      ) allowance_totals
        ON allowance_totals.tenant_id = sm.tenant_id
       AND allowance_totals.staff_member_id = sm.id
      LEFT JOIN (
        SELECT tenant_id, staff_member_id, SUM(amount) AS total_amount
        FROM staff_deductions
        WHERE tenant_id = ?
          AND status = 'active'
          AND effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
        GROUP BY tenant_id, staff_member_id
      ) deduction_totals
        ON deduction_totals.tenant_id = sm.tenant_id
       AND deduction_totals.staff_member_id = sm.id
      LEFT JOIN (
        SELECT
          tenant_id,
          staff_member_id,
          SUM(CASE WHEN status IN ('present', 'late', 'excused', 'sick', 'on_leave') THEN 1 ELSE 0 END) AS days_present,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS days_absent
        FROM attendance_records
        WHERE tenant_id = ?
          AND attendance_date BETWEEN ? AND ?
        GROUP BY tenant_id, staff_member_id
      ) attendance_totals
        ON attendance_totals.tenant_id = sm.tenant_id
       AND attendance_totals.staff_member_id = sm.id
      WHERE sm.tenant_id = ?
        AND sm.status = 'active'
      ORDER BY sm.staff_code ASC, staff_name ASC
    `,
    [
      periodEnd,
      periodStart,
      tenantId,
      periodEnd,
      periodStart,
      tenantId,
      periodEnd,
      periodStart,
      tenantId,
      periodStart,
      periodEnd,
      tenantId
    ]
  );

  return rows;
}

async function findActivePayrollRunByPeriod(tenantId, month, year, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM payroll_runs
      WHERE tenant_id = ?
        AND payroll_month = ?
        AND payroll_year = ?
        AND status <> 'cancelled'
      LIMIT 1
    `,
    [tenantId, month, year]
  );
  return rows[0] || null;
}

async function createPayrollRun(tenantId, payload, userId, db = pool) {
  const activePeriodKey = `${payload.payroll_year}-${String(payload.payroll_month).padStart(2, "0")}`;
  const [result] = await db.query(
    `
      INSERT INTO payroll_runs (
        tenant_id,
        payroll_month,
        payroll_year,
        active_period_key,
        period_start,
        period_end,
        status,
        generated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `,
    [tenantId, payload.payroll_month, payload.payroll_year, activePeriodKey, payload.period_start, payload.period_end, userId || null]
  );
  return findPayrollRun(tenantId, result.insertId, db);
}

async function createPayrollItems(tenantId, payrollRunId, items, db = pool) {
  if (!items.length) {
    return;
  }

  await db.query(
    `
      INSERT INTO payroll_items (
        tenant_id,
        payroll_run_id,
        staff_member_id,
        staff_code,
        staff_name,
        department_name,
        branch_name,
        base_salary,
        allowance_total,
        deduction_total,
        gross_pay,
        net_pay,
        attendance_days_present,
        attendance_days_absent,
        notes
      )
      VALUES ?
    `,
    [
      items.map((item) => [
        tenantId,
        payrollRunId,
        item.staff_member_id,
        item.staff_code,
        item.staff_name,
        item.department_name,
        item.branch_name,
        item.base_salary,
        item.allowance_total,
        item.deduction_total,
        item.gross_pay,
        item.net_pay,
        item.attendance_days_present,
        item.attendance_days_absent,
        item.notes || null
      ])
    ]
  );
}

async function existsPayslipReference(tenantId, payslipReference, excludeItemId = null, db = pool) {
  const params = [tenantId, payslipReference];
  let sql = "SELECT id FROM payroll_items WHERE tenant_id = ? AND payslip_reference = ?";
  if (excludeItemId) {
    sql += " AND id <> ?";
    params.push(excludeItemId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Boolean(rows[0]);
}

async function updatePayrollItemReference(tenantId, itemId, payslipReference, db = pool) {
  await db.query(
    `
      UPDATE payroll_items
      SET payslip_reference = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [payslipReference, tenantId, itemId]
  );
}

async function updatePayrollRunTotals(tenantId, payrollRunId, totals, db = pool) {
  await db.query(
    `
      UPDATE payroll_runs
      SET total_gross = ?,
          total_deductions = ?,
          total_net = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [totals.total_gross, totals.total_deductions, totals.total_net, tenantId, payrollRunId]
  );
  return findPayrollRun(tenantId, payrollRunId, db);
}

async function listPayrollRuns(tenantId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT pr.*, generator.full_name AS generated_by_name
      FROM payroll_runs pr
      LEFT JOIN users generator ON generator.id = pr.generated_by
      WHERE pr.tenant_id = ?
      ORDER BY pr.payroll_year DESC, pr.payroll_month DESC, pr.id DESC
    `,
    [tenantId]
  );
  return rows;
}

async function findPayrollRun(tenantId, id, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pr.*,
        generator.full_name AS generated_by_name,
        submitter.full_name AS submitted_by_name,
        approver.full_name AS approved_by_name,
        payer.full_name AS paid_by_name
      FROM payroll_runs pr
      LEFT JOIN users generator ON generator.id = pr.generated_by
      LEFT JOIN users submitter ON submitter.id = pr.submitted_by
      LEFT JOIN users approver ON approver.id = pr.approved_by
      LEFT JOIN users payer ON payer.id = pr.paid_by
      WHERE pr.tenant_id = ?
        AND pr.id = ?
      LIMIT 1
    `,
    [tenantId, id]
  );
  return rows[0] || null;
}

async function listPayrollItems(tenantId, payrollRunId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM payroll_items
      WHERE tenant_id = ?
        AND payroll_run_id = ?
      ORDER BY staff_code ASC, staff_name ASC
    `,
    [tenantId, payrollRunId]
  );
  return rows;
}

async function findPayrollItem(tenantId, payrollRunId, itemId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pi.*,
        pr.payroll_month,
        pr.payroll_year,
        pr.period_start,
        pr.period_end,
        pr.status AS run_status,
        pr.created_at AS run_created_at
      FROM payroll_items pi
      INNER JOIN payroll_runs pr
        ON pr.id = pi.payroll_run_id
       AND pr.tenant_id = pi.tenant_id
      WHERE pi.tenant_id = ?
        AND pi.payroll_run_id = ?
        AND pi.id = ?
      LIMIT 1
    `,
    [tenantId, payrollRunId, itemId]
  );
  return rows[0] || null;
}

async function findPayrollItemForStaff(tenantId, staffMemberId, runId, itemId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pi.*,
        pr.payroll_month,
        pr.payroll_year,
        pr.period_start,
        pr.period_end,
        pr.status AS run_status,
        pr.created_at AS run_created_at
      FROM payroll_items pi
      INNER JOIN payroll_runs pr
        ON pr.id = pi.payroll_run_id
       AND pr.tenant_id = pi.tenant_id
      WHERE pi.tenant_id = ?
        AND pi.staff_member_id = ?
        AND pi.payroll_run_id = ?
        AND pi.id = ?
      LIMIT 1
    `,
    [tenantId, staffMemberId, runId, itemId]
  );
  return rows[0] || null;
}

async function listPayrollItemsByStaffMember(tenantId, staffMemberId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT
        pi.*,
        pr.payroll_month,
        pr.payroll_year,
        pr.period_start,
        pr.period_end,
        pr.status AS run_status
      FROM payroll_items pi
      INNER JOIN payroll_runs pr
        ON pr.id = pi.payroll_run_id
       AND pr.tenant_id = pi.tenant_id
      WHERE pi.tenant_id = ?
        AND pi.staff_member_id = ?
        AND pr.status <> 'cancelled'
      ORDER BY pr.payroll_year DESC, pr.payroll_month DESC, pi.id DESC
    `,
    [tenantId, staffMemberId]
  );
  return rows;
}

async function updatePayrollItemPaymentStatus(tenantId, payrollRunId, itemId, status, db = pool) {
  await db.query(
    `
      UPDATE payroll_items
      SET payment_status = ?,
          payment_date = CASE WHEN ? = 'paid' THEN CURDATE() ELSE NULL END
      WHERE tenant_id = ?
        AND payroll_run_id = ?
        AND id = ?
    `,
    [status, status, tenantId, payrollRunId, itemId]
  );
  return findPayrollItem(tenantId, payrollRunId, itemId, db);
}

async function updatePayrollRunStatus(tenantId, id, status, userColumn, userId, db = pool) {
  const activeKeySql = status === "cancelled" ? ", active_period_key = NULL" : "";
  const userSql = userColumn ? `, ${userColumn} = ?` : "";
  const params = userColumn ? [status, userId || null, tenantId, id] : [status, tenantId, id];
  await db.query(
    `
      UPDATE payroll_runs
      SET status = ?
          ${userSql}
          ${activeKeySql}
      WHERE tenant_id = ?
        AND id = ?
    `,
    params
  );
  return findPayrollRun(tenantId, id, db);
}

async function countPendingApprovalByTenantId(tenantId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM payroll_runs WHERE tenant_id = ? AND status = 'submitted'",
    [tenantId]
  );
  return Number(row.total || 0);
}

async function getCurrentMonthPayrollByTenantId(tenantId, db = pool) {
  const now = new Date();
  const [rows] = await db.query(
    `
      SELECT status, total_net
      FROM payroll_runs
      WHERE tenant_id = ?
        AND payroll_month = ?
        AND payroll_year = ?
        AND status <> 'cancelled'
      ORDER BY id DESC
      LIMIT 1
    `,
    [tenantId, now.getMonth() + 1, now.getFullYear()]
  );
  return rows[0] || null;
}

module.exports = {
  getPayrollSettings,
  upsertPayrollSettings,
  listCompensation,
  deactivateActiveCompensation,
  createCompensation,
  findCompensationById,
  listAllowanceTypes,
  listActiveAllowanceTypes,
  createAllowanceType,
  updateAllowanceType,
  findAllowanceTypeById,
  existsAllowanceCode,
  listDeductionTypes,
  listActiveDeductionTypes,
  createDeductionType,
  updateDeductionType,
  findDeductionTypeById,
  existsDeductionCode,
  createStaffAllowance,
  createStaffDeduction,
  listStaffAllowances,
  listStaffDeductions,
  getPayrollGenerationRows,
  findActivePayrollRunByPeriod,
  createPayrollRun,
  createPayrollItems,
  existsPayslipReference,
  updatePayrollItemReference,
  updatePayrollRunTotals,
  listPayrollRuns,
  findPayrollRun,
  listPayrollItems,
  findPayrollItem,
  findPayrollItemForStaff,
  listPayrollItemsByStaffMember,
  updatePayrollItemPaymentStatus,
  updatePayrollRunStatus,
  countPendingApprovalByTenantId,
  getCurrentMonthPayrollByTenantId
};
