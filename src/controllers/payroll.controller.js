const { validationResult } = require("express-validator");
const payrollService = require("../services/payroll.service");
const {
  buildSettingsFormData,
  buildCompensationFormData,
  buildTypeFormData,
  buildStaffAllowanceFormData,
  buildStaffDeductionFormData,
  buildRunFormData,
  getPayFrequencyOptions,
  getPayTypeOptions,
  getCalculationTypeOptions,
  statusBadge,
  formatDate,
  money
} = require("../utils/payroll-form");

function breadcrumbs(...items) {
  return [{ label: "Dashboard", href: "/dashboard" }, { label: "Payroll", href: "/payroll/runs" }, ...items];
}

function renderNotFound(res, title) {
  return res.status(404).render("pages/errors/404", { pageTitle: title });
}

function renderWithErrors(res, pageTitle, contentPartial, data, errors) {
  return res.status(422).render("layouts/tenant-layout", {
    pageTitle,
    contentPartial,
    ...data,
    validationErrors: errors.array ? errors.array() : errors
  });
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function payrollFilename(req, run) {
  const tenantCode = (req.currentTenant?.tenant_code || "tenant").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `payroll-${tenantCode}-${run.payroll_year}-${String(run.payroll_month).padStart(2, "0")}.csv`;
}

async function settings(req, res, next) {
  try {
    const settingsData = await payrollService.getPayrollSettings(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Payroll Settings",
      contentPartial: "../pages/tenant/payroll/settings",
      breadcrumbs: breadcrumbs({ label: "Settings" }),
      formData: buildSettingsFormData(settingsData),
      payFrequencyOptions: getPayFrequencyOptions(),
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function saveSettings(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderWithErrors(
        res,
        "Payroll Settings",
        "../pages/tenant/payroll/settings",
        {
          breadcrumbs: breadcrumbs({ label: "Settings" }),
          formData: buildSettingsFormData(req.body),
          payFrequencyOptions: getPayFrequencyOptions()
        },
        errors
      );
    }

    await payrollService.updatePayrollSettings(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Payroll settings saved.");
    return res.redirect("/payroll/settings");
  } catch (error) {
    return next(error);
  }
}

async function compensation(req, res, next) {
  try {
    const rows = await payrollService.listCompensation(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Payroll Compensation",
      contentPartial: "../pages/tenant/payroll/compensation/index",
      breadcrumbs: breadcrumbs({ label: "Compensation" }),
      rows,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function compensationDetail(req, res, next) {
  try {
    const context = await payrollService.listStaffPaySetup(req.currentUser.tenant_id, req.params.staffId);
    return res.render("layouts/tenant-layout", {
      pageTitle: `Compensation - ${context.staffMember.full_name}`,
      contentPartial: "../pages/tenant/payroll/compensation/show",
      breadcrumbs: breadcrumbs(
        { label: "Compensation", href: "/payroll/compensation" },
        { label: context.staffMember.full_name }
      ),
      ...context,
      compensationFormData: buildCompensationFormData(context.compensation),
      allowanceFormData: buildStaffAllowanceFormData(),
      deductionFormData: buildStaffDeductionFormData(),
      payTypeOptions: getPayTypeOptions(),
      statusOptions: ["active", "inactive"],
      validationErrors: [],
      allowanceValidationErrors: [],
      deductionValidationErrors: [],
      formatDate,
      money
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return renderNotFound(res, "Staff Member Not Found");
    }
    return next(error);
  }
}

async function saveCompensation(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const context = await payrollService.listStaffPaySetup(req.currentUser.tenant_id, req.params.staffId);
      return renderWithErrors(
        res,
        `Compensation - ${context.staffMember.full_name}`,
        "../pages/tenant/payroll/compensation/show",
        {
          breadcrumbs: breadcrumbs(
            { label: "Compensation", href: "/payroll/compensation" },
            { label: context.staffMember.full_name }
          ),
          ...context,
          compensationFormData: buildCompensationFormData(req.body),
          allowanceFormData: buildStaffAllowanceFormData(),
          deductionFormData: buildStaffDeductionFormData(),
          payTypeOptions: getPayTypeOptions(),
          statusOptions: ["active", "inactive"],
          allowanceValidationErrors: [],
          deductionValidationErrors: [],
          formatDate,
          money
        },
        errors
      );
    }

    await payrollService.setStaffCompensation(
      req.currentUser.tenant_id,
      { ...req.body, staff_member_id: req.params.staffId },
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Staff compensation saved.");
    return res.redirect(`/payroll/compensation/${req.params.staffId}`);
  } catch (error) {
    return next(error);
  }
}

async function allowanceTypes(req, res, next) {
  try {
    const types = await payrollService.listAllowanceTypes(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Allowance Types",
      contentPartial: "../pages/tenant/payroll/allowance-types",
      breadcrumbs: breadcrumbs({ label: "Allowance Types" }),
      types,
      formData: buildTypeFormData(),
      calculationTypeOptions: getCalculationTypeOptions(),
      statusOptions: ["active", "inactive"],
      validationErrors: [],
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function createAllowanceType(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const types = await payrollService.listAllowanceTypes(req.currentUser.tenant_id);
      return renderWithErrors(
        res,
        "Allowance Types",
        "../pages/tenant/payroll/allowance-types",
        {
          breadcrumbs: breadcrumbs({ label: "Allowance Types" }),
          types,
          formData: buildTypeFormData(req.body),
          calculationTypeOptions: getCalculationTypeOptions(),
          statusOptions: ["active", "inactive"],
          money
        },
        errors
      );
    }
    await payrollService.createAllowanceType(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Allowance type created.");
    return res.redirect("/payroll/allowance-types");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/payroll/allowance-types");
    }
    return next(error);
  }
}

async function editAllowanceType(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/payroll/allowance-types");
    }
    await payrollService.updateAllowanceType(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id);
    req.flash("success", "Allowance type updated.");
    return res.redirect("/payroll/allowance-types");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/payroll/allowance-types");
    }
    return next(error);
  }
}

async function deductionTypes(req, res, next) {
  try {
    const types = await payrollService.listDeductionTypes(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Deduction Types",
      contentPartial: "../pages/tenant/payroll/deduction-types",
      breadcrumbs: breadcrumbs({ label: "Deduction Types" }),
      types,
      formData: buildTypeFormData(),
      calculationTypeOptions: getCalculationTypeOptions(),
      statusOptions: ["active", "inactive"],
      validationErrors: [],
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function createDeductionType(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const types = await payrollService.listDeductionTypes(req.currentUser.tenant_id);
      return renderWithErrors(
        res,
        "Deduction Types",
        "../pages/tenant/payroll/deduction-types",
        {
          breadcrumbs: breadcrumbs({ label: "Deduction Types" }),
          types,
          formData: buildTypeFormData(req.body),
          calculationTypeOptions: getCalculationTypeOptions(),
          statusOptions: ["active", "inactive"],
          money
        },
        errors
      );
    }
    await payrollService.createDeductionType(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Deduction type created.");
    return res.redirect("/payroll/deduction-types");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/payroll/deduction-types");
    }
    return next(error);
  }
}

async function editDeductionType(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/payroll/deduction-types");
    }
    await payrollService.updateDeductionType(req.currentUser.tenant_id, req.params.id, req.body, req.currentUser.id);
    req.flash("success", "Deduction type updated.");
    return res.redirect("/payroll/deduction-types");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/payroll/deduction-types");
    }
    return next(error);
  }
}

async function addStaffAllowance(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/payroll/compensation/${req.params.staffId}`);
    }
    await payrollService.assignStaffAllowance(
      req.currentUser.tenant_id,
      { ...req.body, staff_member_id: req.params.staffId },
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Staff allowance added.");
    return res.redirect(`/payroll/compensation/${req.params.staffId}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/payroll/compensation/${req.params.staffId}`);
    }
    return next(error);
  }
}

async function addStaffDeduction(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/payroll/compensation/${req.params.staffId}`);
    }
    await payrollService.assignStaffDeduction(
      req.currentUser.tenant_id,
      { ...req.body, staff_member_id: req.params.staffId },
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Staff deduction added.");
    return res.redirect(`/payroll/compensation/${req.params.staffId}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/payroll/compensation/${req.params.staffId}`);
    }
    return next(error);
  }
}

async function runs(req, res, next) {
  try {
    const rows = await payrollService.listPayrollRuns(req.currentUser.tenant_id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Payroll Runs",
      contentPartial: "../pages/tenant/payroll/runs/index",
      breadcrumbs: breadcrumbs({ label: "Runs" }),
      rows,
      canManagePayroll: payrollService.MANAGE_ROLES.has(req.currentUser.role),
      statusBadge,
      money
    });
  } catch (error) {
    return next(error);
  }
}

function showGenerateRun(req, res) {
  return res.render("layouts/tenant-layout", {
    pageTitle: "Generate Payroll Run",
    contentPartial: "../pages/tenant/payroll/runs/generate",
    breadcrumbs: breadcrumbs({ label: "Runs", href: "/payroll/runs" }, { label: "Generate" }),
    formData: buildRunFormData(req.body),
    validationErrors: []
  });
}

async function generateRun(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderWithErrors(
        res,
        "Generate Payroll Run",
        "../pages/tenant/payroll/runs/generate",
        {
          breadcrumbs: breadcrumbs({ label: "Runs", href: "/payroll/runs" }, { label: "Generate" }),
          formData: buildRunFormData(req.body)
        },
        errors
      );
    }
    const run = await payrollService.generatePayrollRun(req.currentUser.tenant_id, req.body, req.currentUser.id, req.ip);
    req.flash("success", "Payroll run generated.");
    return res.redirect(`/payroll/runs/${run.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/payroll/runs/generate");
    }
    return next(error);
  }
}

async function runDetail(req, res, next) {
  try {
    const context = await payrollService.findPayrollRun(req.currentUser.tenant_id, req.params.id);
    if (!context) {
      return renderNotFound(res, "Payroll Run Not Found");
    }
    return res.render("layouts/tenant-layout", {
      pageTitle: `Payroll ${context.run.payroll_month}/${context.run.payroll_year}`,
      contentPartial: "../pages/tenant/payroll/runs/show",
      breadcrumbs: breadcrumbs({ label: "Runs", href: "/payroll/runs" }, { label: "Run Detail" }),
      ...context,
      canManagePayroll: payrollService.MANAGE_ROLES.has(req.currentUser.role),
      statusBadge,
      formatDate,
      money,
      totals: {
        allowance_total: context.items.reduce((sum, item) => sum + Number(item.allowance_total || 0), 0),
        deduction_total: context.items.reduce((sum, item) => sum + Number(item.deduction_total || 0), 0),
        gross_total: context.items.reduce((sum, item) => sum + Number(item.gross_pay || 0), 0),
        net_total: context.items.reduce((sum, item) => sum + Number(item.net_pay || 0), 0)
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function payslip(req, res, next) {
  try {
    const context = await payrollService.findPayslip(
      req.currentUser.tenant_id,
      req.params.runId,
      req.params.itemId,
      req.currentUser.id,
      req.ip
    );
    if (!context) {
      return renderNotFound(res, "Payslip Not Found");
    }

    return res.render("layouts/tenant-layout", {
      pageTitle: `Payslip ${context.item.payslip_reference}`,
      contentPartial: "../pages/tenant/payroll/payslip",
      breadcrumbs: breadcrumbs(
        { label: "Runs", href: "/payroll/runs" },
        { label: "Run Detail", href: `/payroll/runs/${req.params.runId}` },
        { label: "Payslip" }
      ),
      ...context,
      formatDate,
      money,
      printMode: false,
      backHref: `/payroll/runs/${req.params.runId}`
    });
  } catch (error) {
    return next(error);
  }
}

async function printPayslip(req, res, next) {
  try {
    const context = await payrollService.findPayslip(
      req.currentUser.tenant_id,
      req.params.runId,
      req.params.itemId,
      req.currentUser.id,
      req.ip
    );
    if (!context) {
      return renderNotFound(res, "Payslip Not Found");
    }
    return res.render("layouts/print-layout", {
      pageTitle: `Print Payslip ${context.item.payslip_reference}`,
      contentPartial: "../pages/tenant/payroll/payslip",
      ...context,
      formatDate,
      money,
      printMode: true,
      backHref: `/payroll/runs/${req.params.runId}`
    });
  } catch (error) {
    return next(error);
  }
}

async function exportRunCsv(req, res, next) {
  try {
    const context = await payrollService.findPayrollRun(req.currentUser.tenant_id, req.params.id);
    if (!context) {
      return renderNotFound(res, "Payroll Run Not Found");
    }
    await payrollService.logPayrollExport(req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);

    const headers = [
      "payroll_month",
      "payroll_year",
      "staff_code",
      "staff_name",
      "department",
      "branch",
      "base_salary",
      "allowance_total",
      "deduction_total",
      "gross_pay",
      "net_pay",
      "payment_status"
    ];
    const lines = [
      headers.join(","),
      ...context.items.map((item) =>
        [
          context.run.payroll_month,
          context.run.payroll_year,
          item.staff_code,
          item.staff_name,
          item.department_name || "",
          item.branch_name || "",
          item.base_salary,
          item.allowance_total,
          item.deduction_total,
          item.gross_pay,
          item.net_pay,
          item.payment_status || "unpaid"
        ]
          .map(escapeCsv)
          .join(",")
      )
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${payrollFilename(req, context.run)}"`);
    return res.send(lines.join("\r\n"));
  } catch (error) {
    return next(error);
  }
}

async function updateItemPaymentStatus(req, res, next, status) {
  try {
    await payrollService.updatePayrollItemPaymentStatus(
      req.currentUser.tenant_id,
      req.params.runId,
      req.params.itemId,
      status,
      req.currentUser.id,
      req.ip
    );
    req.flash("success", `Payroll item marked ${status}.`);
    return res.redirect(`/payroll/runs/${req.params.runId}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/payroll/runs/${req.params.runId}`);
    }
    return next(error);
  }
}

async function myPayroll(req, res, next) {
  try {
    const context = await payrollService.listMyPayroll(req.currentUser.tenant_id, req.currentUser.id);
    return res.render("layouts/tenant-layout", {
      pageTitle: "My Payroll",
      contentPartial: "../pages/tenant/payroll/my-payroll",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "My Payroll" }],
      ...context,
      formatDate,
      money
    });
  } catch (error) {
    return next(error);
  }
}

async function myPayslip(req, res, next) {
  try {
    const context = await payrollService.findSelfPayslip(
      req.currentUser.tenant_id,
      req.currentUser.id,
      req.params.runId,
      req.params.itemId,
      req.ip
    );
    if (!context) {
      return renderNotFound(res, "Payslip Not Found");
    }
    return res.render("layouts/tenant-layout", {
      pageTitle: `Payslip ${context.item.payslip_reference}`,
      contentPartial: "../pages/tenant/payroll/payslip",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "My Payroll", href: "/my/payroll" }, { label: "Payslip" }],
      ...context,
      formatDate,
      money,
      printMode: false,
      backHref: "/my/payroll"
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return renderNotFound(res, "Payslip Not Found");
    }
    return next(error);
  }
}

async function myPrintPayslip(req, res, next) {
  try {
    const context = await payrollService.findSelfPayslip(
      req.currentUser.tenant_id,
      req.currentUser.id,
      req.params.runId,
      req.params.itemId,
      req.ip
    );
    if (!context) {
      return renderNotFound(res, "Payslip Not Found");
    }
    return res.render("layouts/print-layout", {
      pageTitle: `Print Payslip ${context.item.payslip_reference}`,
      contentPartial: "../pages/tenant/payroll/payslip",
      ...context,
      formatDate,
      money,
      printMode: true,
      backHref: "/my/payroll"
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return renderNotFound(res, "Payslip Not Found");
    }
    return next(error);
  }
}

async function transition(req, res, next, action) {
  try {
    const methodMap = {
      submit: payrollService.submitPayrollRun,
      approve: payrollService.approvePayrollRun,
      paid: payrollService.markPayrollPaid,
      cancel: payrollService.cancelPayrollRun
    };
    const updated = await methodMap[action](req.currentUser.tenant_id, req.params.id, req.currentUser.id, req.ip);
    req.flash("success", `Payroll run status changed to ${updated.status}.`);
    return res.redirect(`/payroll/runs/${req.params.id}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect(`/payroll/runs/${req.params.id}`);
    }
    return next(error);
  }
}

module.exports = {
  settings,
  saveSettings,
  compensation,
  compensationDetail,
  saveCompensation,
  allowanceTypes,
  createAllowanceType,
  editAllowanceType,
  deductionTypes,
  createDeductionType,
  editDeductionType,
  addStaffAllowance,
  addStaffDeduction,
  runs,
  showGenerateRun,
  generateRun,
  runDetail,
  payslip,
  printPayslip,
  exportRunCsv,
  markItemPaid: (req, res, next) => updateItemPaymentStatus(req, res, next, "paid"),
  markItemUnpaid: (req, res, next) => updateItemPaymentStatus(req, res, next, "unpaid"),
  myPayroll,
  myPayslip,
  myPrintPayslip,
  submitRun: (req, res, next) => transition(req, res, next, "submit"),
  approveRun: (req, res, next) => transition(req, res, next, "approve"),
  markPaid: (req, res, next) => transition(req, res, next, "paid"),
  cancelRun: (req, res, next) => transition(req, res, next, "cancel")
};
