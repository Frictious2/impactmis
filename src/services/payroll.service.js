const pool = require("../db/pool");
const payrollRepo = require("../repos/payroll.repo");
const staffRepo = require("../repos/staff.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const organizationProfileRepo = require("../repos/organization-profile.repo");
const notificationService = require("./notification.service");
const { normalizeNullable } = require("../utils/tenant-form");

const MANAGE_ROLES = new Set(["Tenant Admin", "Finance Manager"]);
const VIEW_ROLES = new Set(["Tenant Admin", "Finance Manager", "Auditor"]);

function toMoney(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return Number(Number(value).toFixed(2));
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function normalizeSettings(payload) {
  return {
    currency: String(payload.currency || "NLe").trim() || "NLe",
    pay_frequency: payload.pay_frequency || "monthly",
    default_work_days_per_month: Number(payload.default_work_days_per_month || 22),
    default_work_hours_per_day: toMoney(payload.default_work_hours_per_day, 8),
    overtime_enabled: payload.overtime_enabled === "on" || payload.overtime_enabled === true,
    approval_required: payload.approval_required === "on" || payload.approval_required === true
  };
}

function normalizeCompensation(payload) {
  return {
    staff_member_id: Number(payload.staff_member_id),
    base_salary: toMoney(payload.base_salary),
    pay_type: payload.pay_type || "monthly",
    currency: String(payload.currency || "NLe").trim() || "NLe",
    effective_from: payload.effective_from,
    effective_to: normalizeNullable(payload.effective_to),
    status: payload.status || "active"
  };
}

function normalizeAllowanceType(payload) {
  return {
    name: String(payload.name || "").trim(),
    code: normalizeCode(payload.code),
    description: normalizeNullable(payload.description),
    calculation_type: payload.calculation_type || "fixed",
    default_amount: toMoney(payload.default_amount),
    taxable: payload.taxable === "on" || payload.taxable === true,
    status: payload.status || "active"
  };
}

function normalizeDeductionType(payload) {
  return {
    name: String(payload.name || "").trim(),
    code: normalizeCode(payload.code),
    description: normalizeNullable(payload.description),
    calculation_type: payload.calculation_type || "fixed",
    default_amount: toMoney(payload.default_amount),
    status: payload.status || "active"
  };
}

function normalizeStaffAllowance(payload) {
  return {
    staff_member_id: Number(payload.staff_member_id),
    allowance_type_id: Number(payload.allowance_type_id),
    amount: toMoney(payload.amount),
    effective_from: payload.effective_from,
    effective_to: normalizeNullable(payload.effective_to),
    status: payload.status || "active"
  };
}

function normalizeStaffDeduction(payload) {
  return {
    staff_member_id: Number(payload.staff_member_id),
    deduction_type_id: Number(payload.deduction_type_id),
    amount: toMoney(payload.amount),
    effective_from: payload.effective_from,
    effective_to: normalizeNullable(payload.effective_to),
    status: payload.status || "active"
  };
}

function normalizeRunPayload(payload) {
  return {
    payroll_month: Number(payload.payroll_month),
    payroll_year: Number(payload.payroll_year),
    period_start: payload.period_start,
    period_end: payload.period_end
  };
}

function buildPayslipReference(run, item, suffix = "") {
  return `PAY-${run.payroll_year}${String(run.payroll_month).padStart(2, "0")}-${item.staff_code}${suffix}`;
}

async function logAudit(db, tenantId, userId, ipAddress, action, entityType, entityId, metadata) {
  await auditLogRepo.create(
    {
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      metadata_json: metadata,
      ip_address: ipAddress
    },
    db
  );
}

async function assertStaffBelongsToTenant(tenantId, staffMemberId, db = pool) {
  const staffMember = await staffRepo.findStaffById(tenantId, staffMemberId, db);
  if (!staffMember) {
    const error = new Error("Selected staff member was not found.");
    error.statusCode = 404;
    throw error;
  }
  return staffMember;
}

async function assertPayrollRun(tenantId, id, db = pool) {
  const run = await payrollRepo.findPayrollRun(tenantId, id, db);
  if (!run) {
    const error = new Error("Payroll run was not found.");
    error.statusCode = 404;
    throw error;
  }
  return run;
}

async function ensurePayslipReference(tenantId, run, item, db = pool) {
  if (item.payslip_reference) {
    return item.payslip_reference;
  }

  let reference = buildPayslipReference(run, item);
  if (await payrollRepo.existsPayslipReference(tenantId, reference, item.id, db)) {
    reference = buildPayslipReference(run, item, `-${item.id}`);
  }

  await payrollRepo.updatePayrollItemReference(tenantId, item.id, reference, db);
  item.payslip_reference = reference;
  return reference;
}

async function ensurePayslipReferences(tenantId, run, items, db = pool) {
  for (const item of items) {
    await ensurePayslipReference(tenantId, run, item, db);
  }
  return items;
}

async function getPayrollSettings(tenantId) {
  const settings = await payrollRepo.getPayrollSettings(tenantId);
  return (
    settings || {
      currency: "NLe",
      pay_frequency: "monthly",
      default_work_days_per_month: 22,
      default_work_hours_per_day: 8,
      overtime_enabled: 0,
      approval_required: 1
    }
  );
}

async function updatePayrollSettings(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const settings = await payrollRepo.upsertPayrollSettings(tenantId, normalizeSettings(payload), connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.settings_updated", "payroll_settings", settings.id, {
      currency: settings.currency,
      pay_frequency: settings.pay_frequency
    });
    await connection.commit();
    return settings;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listCompensation(tenantId) {
  return payrollRepo.listCompensation(tenantId);
}

async function listStaffPaySetup(tenantId, staffMemberId) {
  const [staffMember, allowances, deductions, allowanceTypes, deductionTypes] = await Promise.all([
    assertStaffBelongsToTenant(tenantId, staffMemberId),
    payrollRepo.listStaffAllowances(tenantId, staffMemberId),
    payrollRepo.listStaffDeductions(tenantId, staffMemberId),
    payrollRepo.listActiveAllowanceTypes(tenantId),
    payrollRepo.listActiveDeductionTypes(tenantId)
  ]);
  const compensationRows = await payrollRepo.listCompensation(tenantId);
  const compensation = compensationRows.find((row) => Number(row.staff_member_id) === Number(staffMemberId)) || null;
  return { staffMember, compensation, allowances, deductions, allowanceTypes, deductionTypes };
}

async function setStaffCompensation(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeCompensation(payload);
    const staffMember = await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    if (normalized.status === "active") {
      await payrollRepo.deactivateActiveCompensation(tenantId, normalized.staff_member_id, connection);
    }
    const compensation = await payrollRepo.createCompensation(tenantId, normalized, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.compensation_set", "staff_member", staffMember.id, {
      staff_member_id: staffMember.id,
      amount: normalized.base_salary,
      pay_type: normalized.pay_type
    });
    await connection.commit();
    return compensation;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listAllowanceTypes(tenantId) {
  return payrollRepo.listAllowanceTypes(tenantId);
}

async function createAllowanceType(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeAllowanceType(payload);
    if (await payrollRepo.existsAllowanceCode(tenantId, normalized.code, null, connection)) {
      const error = new Error("Allowance code already exists for this tenant.");
      error.statusCode = 422;
      throw error;
    }
    const type = await payrollRepo.createAllowanceType(tenantId, normalized, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.allowance_type_created", "allowance_type", type.id, {
      allowance_type_id: type.id,
      code: type.code
    });
    await connection.commit();
    return type;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAllowanceType(tenantId, id, payload, userId) {
  const normalized = normalizeAllowanceType(payload);
  if (await payrollRepo.existsAllowanceCode(tenantId, normalized.code, id)) {
    const error = new Error("Allowance code already exists for this tenant.");
    error.statusCode = 422;
    throw error;
  }
  const type = await payrollRepo.updateAllowanceType(tenantId, id, normalized, userId);
  if (!type) {
    const error = new Error("Allowance type was not found.");
    error.statusCode = 404;
    throw error;
  }
  return type;
}

async function listDeductionTypes(tenantId) {
  return payrollRepo.listDeductionTypes(tenantId);
}

async function createDeductionType(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeDeductionType(payload);
    if (await payrollRepo.existsDeductionCode(tenantId, normalized.code, null, connection)) {
      const error = new Error("Deduction code already exists for this tenant.");
      error.statusCode = 422;
      throw error;
    }
    const type = await payrollRepo.createDeductionType(tenantId, normalized, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.deduction_type_created", "deduction_type", type.id, {
      deduction_type_id: type.id,
      code: type.code
    });
    await connection.commit();
    return type;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDeductionType(tenantId, id, payload, userId) {
  const normalized = normalizeDeductionType(payload);
  if (await payrollRepo.existsDeductionCode(tenantId, normalized.code, id)) {
    const error = new Error("Deduction code already exists for this tenant.");
    error.statusCode = 422;
    throw error;
  }
  const type = await payrollRepo.updateDeductionType(tenantId, id, normalized, userId);
  if (!type) {
    const error = new Error("Deduction type was not found.");
    error.statusCode = 404;
    throw error;
  }
  return type;
}

async function assignStaffAllowance(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeStaffAllowance(payload);
    await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    const type = await payrollRepo.findAllowanceTypeById(tenantId, normalized.allowance_type_id, connection);
    if (!type) {
      const error = new Error("Allowance type was not found.");
      error.statusCode = 404;
      throw error;
    }
    const id = await payrollRepo.createStaffAllowance(tenantId, normalized, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.staff_allowance_added", "staff_member", normalized.staff_member_id, {
      staff_member_id: normalized.staff_member_id,
      allowance_type_id: normalized.allowance_type_id,
      amount: normalized.amount
    });
    await connection.commit();
    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assignStaffDeduction(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeStaffDeduction(payload);
    await assertStaffBelongsToTenant(tenantId, normalized.staff_member_id, connection);
    const type = await payrollRepo.findDeductionTypeById(tenantId, normalized.deduction_type_id, connection);
    if (!type) {
      const error = new Error("Deduction type was not found.");
      error.statusCode = 404;
      throw error;
    }
    const id = await payrollRepo.createStaffDeduction(tenantId, normalized, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.staff_deduction_added", "staff_member", normalized.staff_member_id, {
      staff_member_id: normalized.staff_member_id,
      deduction_type_id: normalized.deduction_type_id,
      amount: normalized.amount
    });
    await connection.commit();
    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generatePayrollRun(tenantId, payload, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const normalized = normalizeRunPayload(payload);
    const existing = await payrollRepo.findActivePayrollRunByPeriod(
      tenantId,
      normalized.payroll_month,
      normalized.payroll_year,
      connection
    );
    if (existing) {
      const error = new Error("An active payroll run already exists for this month and year.");
      error.statusCode = 422;
      throw error;
    }

    const sourceRows = await payrollRepo.getPayrollGenerationRows(
      tenantId,
      normalized.period_start,
      normalized.period_end,
      connection
    );
    const items = sourceRows.map((row) => {
      const baseSalary = toMoney(row.base_salary);
      const allowanceTotal = toMoney(row.allowance_total);
      const deductionTotal = toMoney(row.deduction_total);
      const grossPay = toMoney(baseSalary + allowanceTotal);
      const netPay = toMoney(grossPay - deductionTotal);
      return {
        staff_member_id: row.staff_member_id,
        staff_code: row.staff_code,
        staff_name: row.staff_name,
        department_name: row.department_name,
        branch_name: row.branch_name,
        base_salary: baseSalary,
        allowance_total: allowanceTotal,
        deduction_total: deductionTotal,
        gross_pay: grossPay,
        net_pay: netPay,
        attendance_days_present: toMoney(row.attendance_days_present),
        attendance_days_absent: toMoney(row.attendance_days_absent)
      };
    });

    const totals = items.reduce(
      (acc, item) => ({
        total_gross: toMoney(acc.total_gross + item.gross_pay),
        total_deductions: toMoney(acc.total_deductions + item.deduction_total),
        total_net: toMoney(acc.total_net + item.net_pay)
      }),
      { total_gross: 0, total_deductions: 0, total_net: 0 }
    );

    const run = await payrollRepo.createPayrollRun(tenantId, normalized, userId, connection);
    await payrollRepo.createPayrollItems(tenantId, run.id, items, connection);
    const updatedRun = await payrollRepo.updatePayrollRunTotals(tenantId, run.id, totals, connection);
    const generatedItems = await payrollRepo.listPayrollItems(tenantId, run.id, connection);
    await ensurePayslipReferences(tenantId, updatedRun, generatedItems, connection);
    await logAudit(connection, tenantId, userId, ipAddress, "payroll.run_generated", "payroll_run", run.id, {
      payroll_run_id: run.id,
      month: normalized.payroll_month,
      year: normalized.payroll_year,
      total_gross: totals.total_gross,
      total_deductions: totals.total_deductions,
      total_net: totals.total_net
    });
    await connection.commit();
    return updatedRun;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listPayrollRuns(tenantId) {
  return payrollRepo.listPayrollRuns(tenantId);
}

async function findPayrollRun(tenantId, id) {
  const run = await payrollRepo.findPayrollRun(tenantId, id);
  if (!run) {
    return null;
  }
  const items = await payrollRepo.listPayrollItems(tenantId, id);
  await ensurePayslipReferences(tenantId, run, items);
  return { run, items };
}

async function findPayslip(tenantId, runId, itemId, userId, ipAddress) {
  const item = await payrollRepo.findPayrollItem(tenantId, runId, itemId);
  if (!item) {
    return null;
  }
  await ensurePayslipReference(tenantId, item, item);
  const organizationProfile = await organizationProfileRepo.findByTenantId(tenantId);
  await logAudit(pool, tenantId, userId, ipAddress, "payroll.payslip_viewed", "payroll_item", item.id, {
    payroll_run_id: Number(runId),
    payroll_item_id: item.id,
    staff_member_id: item.staff_member_id,
    payslip_reference: item.payslip_reference
  });
  return { item, organizationProfile };
}

async function findSelfPayslip(tenantId, userId, runId, itemId, ipAddress) {
  const staffMember = await staffRepo.findByUserIdForTenant(tenantId, userId);
  if (!staffMember) {
    const error = new Error("No linked staff record was found for your user account.");
    error.statusCode = 404;
    throw error;
  }
  const item = await payrollRepo.findPayrollItemForStaff(tenantId, staffMember.id, runId, itemId);
  if (!item) {
    return null;
  }
  await ensurePayslipReference(tenantId, item, item);
  const organizationProfile = await organizationProfileRepo.findByTenantId(tenantId);
  await logAudit(pool, tenantId, userId, ipAddress, "payroll.payslip_viewed", "payroll_item", item.id, {
    payroll_run_id: Number(runId),
    payroll_item_id: item.id,
    staff_member_id: item.staff_member_id,
    payslip_reference: item.payslip_reference
  });
  return { item, organizationProfile, staffMember };
}

async function listMyPayroll(tenantId, userId) {
  const staffMember = await staffRepo.findByUserIdForTenant(tenantId, userId);
  if (!staffMember) {
    return { staffMember: null, items: [] };
  }
  const items = await payrollRepo.listPayrollItemsByStaffMember(tenantId, staffMember.id);
  for (const item of items) {
    await ensurePayslipReference(tenantId, item, item);
  }
  return { staffMember, items };
}

async function updatePayrollItemPaymentStatus(tenantId, runId, itemId, status, userId, ipAddress) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const item = await payrollRepo.findPayrollItem(tenantId, runId, itemId, connection);
    if (!item) {
      const error = new Error("Payroll item was not found.");
      error.statusCode = 404;
      throw error;
    }
    if (!["approved", "paid"].includes(item.run_status)) {
      const error = new Error("Payroll item payment status can only be changed after the run is approved or paid.");
      error.statusCode = 422;
      throw error;
    }
    await ensurePayslipReference(tenantId, item, item, connection);
    const updated = await payrollRepo.updatePayrollItemPaymentStatus(tenantId, runId, itemId, status, connection);
    await logAudit(
      connection,
      tenantId,
      userId,
      ipAddress,
      status === "paid" ? "payroll.item_marked_paid" : "payroll.item_marked_unpaid",
      "payroll_item",
      itemId,
      {
        payroll_run_id: Number(runId),
        payroll_item_id: Number(itemId),
        staff_member_id: updated.staff_member_id,
        payslip_reference: updated.payslip_reference
      }
    );
    await connection.commit();
    if (nextStatus === "submitted") {
      notificationService.notifyRoles(tenantId, ["Tenant Admin", "Finance Manager"], {
        title: "Payroll submitted",
        message: `Payroll ${updated.payroll_month}/${updated.payroll_year} is waiting for approval.`,
        type: "warning",
        category: "payroll",
        link_url: `/payroll/runs/${id}`,
        created_by: userId
      });
    }
    if (nextStatus === "approved" || nextStatus === "paid") {
      notificationService.notifyRoles(tenantId, ["Finance Manager"], {
        title: `Payroll ${nextStatus}`,
        message: `Payroll ${updated.payroll_month}/${updated.payroll_year} was ${nextStatus}.`,
        type: nextStatus === "approved" ? "success" : "info",
        category: "payroll",
        link_url: `/payroll/runs/${id}`,
        created_by: userId
      });
    }
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function logPayrollExport(tenantId, runId, userId, ipAddress) {
  const run = await assertPayrollRun(tenantId, runId);
  await logAudit(pool, tenantId, userId, ipAddress, "payroll.exported", "payroll_run", runId, {
    payroll_run_id: Number(runId),
    month: run.payroll_month,
    year: run.payroll_year
  });
  return run;
}

async function transitionRun(tenantId, id, nextStatus, userColumn, validCurrentStatuses, userId, ipAddress, auditAction) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const run = await assertPayrollRun(tenantId, id, connection);
    if (!validCurrentStatuses.has(run.status)) {
      const error = new Error(`Payroll run cannot be changed from ${run.status} to ${nextStatus}.`);
      error.statusCode = 422;
      throw error;
    }
    const updated = await payrollRepo.updatePayrollRunStatus(tenantId, id, nextStatus, userColumn, userId, connection);
    await logAudit(connection, tenantId, userId, ipAddress, auditAction, "payroll_run", id, {
      payroll_run_id: Number(id),
      month: updated.payroll_month,
      year: updated.payroll_year,
      total_net: Number(updated.total_net || 0)
    });
    await connection.commit();
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submitPayrollRun(tenantId, id, userId, ipAddress) {
  return transitionRun(
    tenantId,
    id,
    "submitted",
    "submitted_by",
    new Set(["draft"]),
    userId,
    ipAddress,
    "payroll.run_submitted"
  );
}

async function approvePayrollRun(tenantId, id, userId, ipAddress) {
  return transitionRun(
    tenantId,
    id,
    "approved",
    "approved_by",
    new Set(["submitted"]),
    userId,
    ipAddress,
    "payroll.run_approved"
  );
}

async function markPayrollPaid(tenantId, id, userId, ipAddress) {
  return transitionRun(
    tenantId,
    id,
    "paid",
    "paid_by",
    new Set(["approved"]),
    userId,
    ipAddress,
    "payroll.run_paid"
  );
}

async function cancelPayrollRun(tenantId, id, userId, ipAddress) {
  return transitionRun(
    tenantId,
    id,
    "cancelled",
    null,
    new Set(["draft", "submitted", "approved"]),
    userId,
    ipAddress,
    "payroll.run_cancelled"
  );
}

module.exports = {
  MANAGE_ROLES,
  VIEW_ROLES,
  getPayrollSettings,
  updatePayrollSettings,
  listCompensation,
  setStaffCompensation,
  listAllowanceTypes,
  createAllowanceType,
  updateAllowanceType,
  listDeductionTypes,
  createDeductionType,
  updateDeductionType,
  assignStaffAllowance,
  assignStaffDeduction,
  listStaffPaySetup,
  generatePayrollRun,
  listPayrollRuns,
  findPayrollRun,
  findPayslip,
  findSelfPayslip,
  listMyPayroll,
  updatePayrollItemPaymentStatus,
  logPayrollExport,
  submitPayrollRun,
  approvePayrollRun,
  markPayrollPaid,
  cancelPayrollRun
};
