const pool = require("../db/pool");

async function findByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM approval_workflows WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );

  return rows[0] || null;
}

async function upsertByTenantId(tenantId, payload, db = pool) {
  await db.query(
    `
      INSERT INTO approval_workflows (
        tenant_id,
        attendance_approvals,
        payroll_approvals,
        expense_approvals,
        project_report_approvals,
        staff_approvals
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        attendance_approvals = VALUES(attendance_approvals),
        payroll_approvals = VALUES(payroll_approvals),
        expense_approvals = VALUES(expense_approvals),
        project_report_approvals = VALUES(project_report_approvals),
        staff_approvals = VALUES(staff_approvals)
    `,
    [
      tenantId,
      payload.attendance_approvals,
      payload.payroll_approvals,
      payload.expense_approvals,
      payload.project_report_approvals,
      payload.staff_approvals
    ]
  );

  return findByTenantId(tenantId, db);
}

module.exports = {
  findByTenantId,
  upsertByTenantId
};
