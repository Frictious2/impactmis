const tenantRepo = require("../repos/tenant.repo");

const MODULE_CATALOG = [
  { code: "staff", label: "Staff" },
  { code: "attendance", label: "Attendance" },
  { code: "branches", label: "Branches" },
  { code: "projects", label: "Projects" },
  { code: "reports", label: "Reports / M&E" },
  { code: "donors", label: "Donor Portal" },
  { code: "payroll", label: "Payroll" },
  { code: "finance", label: "Finance & Expenses" },
  { code: "approvals", label: "Approvals" }
];

function getModuleCatalog() {
  return MODULE_CATALOG;
}

function getModuleCodes() {
  return MODULE_CATALOG.map((module) => module.code);
}

function normalizeNullable(value) {
  if (typeof value !== "string") {
    return value || null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value) {
  const normalized = normalizeNullable(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeTenantCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function normalizeDateInput(value) {
  return String(value || "").trim();
}

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function coerceModules(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value) {
    return [value];
  }

  return [];
}

function buildModuleAccessMap(value, { includeMissing = false } = {}) {
  const selected = new Set(coerceModules(value));
  return MODULE_CATALOG.reduce((modules, module) => {
    if (selected.has(module.code)) {
      modules[module.code] = true;
    } else if (includeMissing) {
      modules[module.code] = false;
    }
    return modules;
  }, {});
}

function getSelectedModuleCodes(value) {
  const parsed = parseJsonField(value, value);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([, enabled]) => !(enabled === false || enabled === "false" || enabled === 0 || enabled === "0"))
      .map(([code]) => code);
  }

  return coerceModules(value);
}

function getModuleLabel(code) {
  const module = MODULE_CATALOG.find((item) => item.code === code);
  return module ? module.label : code;
}

function parseJsonField(value, fallback = null) {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

async function buildUniqueTenantCode(rawTenantCode, name) {
  const base =
    normalizeTenantCode(rawTenantCode) ||
    normalizeTenantCode(
      String(name || "")
        .split(/\s+/)
        .slice(0, 4)
        .map((part) => part[0] || "")
        .join("")
    ) ||
    "TENANT";

  let candidate = base;
  let suffix = 1;

  while (await tenantRepo.existsByTenantCode(candidate)) {
    candidate = `${base.slice(0, 26)}-${String(suffix).padStart(2, "0")}`;
    suffix += 1;
  }

  return candidate;
}

async function buildUniqueSlug(rawSlug, name) {
  const base = slugify(rawSlug) || slugify(name) || "tenant";
  let candidate = base;
  let suffix = 1;

  while (await tenantRepo.existsBySlug(candidate)) {
    candidate = `${base.slice(0, 70)}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function calculateLicenseExpiry(startsAt, durationMonths) {
  const startDate = new Date(`${startsAt}T00:00:00`);
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + Number(durationMonths));
  expiryDate.setDate(expiryDate.getDate() - 1);

  const year = expiryDate.getFullYear();
  const month = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const day = String(expiryDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day} 23:59:59`;
}

function buildTenantCreateFormData(source = {}) {
  return {
    name: source.name || "",
    tenant_code: source.tenant_code || "",
    slug: source.slug || "",
    primary_domain: source.primary_domain || "",
    contact_name: source.contact_name || "",
    contact_email: source.contact_email || "",
    contact_phone: source.contact_phone || "",
    country: source.country || "Sierra Leone",
    plan_name: source.plan_name || "Standard",
    duration_months: source.duration_months || 12,
    starts_at: source.starts_at || new Date().toISOString().slice(0, 10),
    modules: coerceModules(source.modules).length ? coerceModules(source.modules) : getModuleCodes(),
    seat_limit: source.seat_limit || 25,
    admin_full_name: source.admin_full_name || "",
    admin_email: source.admin_email || "",
    temporary_password: source.temporary_password || "",
    must_change_password:
      source.must_change_password === "false" || source.must_change_password === false ? "false" : "true"
  };
}

function buildLicenseFormData(source = {}) {
  const selectedModules = getSelectedModuleCodes(source.modules || source.modules_json);
  return {
    plan_name: source.plan_name || "Standard",
    duration_months: source.duration_months || 12,
    starts_at: formatDateInput(source.starts_at) || new Date().toISOString().slice(0, 10),
    expires_at: formatDateInput(source.expires_at),
    modules: selectedModules.length ? selectedModules : getModuleCodes(),
    seat_limit: source.seat_limit || 25,
    status: source.status || "active"
  };
}

module.exports = {
  getModuleCatalog,
  getModuleCodes,
  buildModuleAccessMap,
  getSelectedModuleCodes,
  getModuleLabel,
  normalizeNullable,
  normalizeEmail,
  normalizeTenantCode,
  slugify,
  normalizeDateInput,
  formatDateInput,
  coerceModules,
  buildUniqueTenantCode,
  buildUniqueSlug,
  calculateLicenseExpiry,
  parseJsonField,
  buildTenantCreateFormData,
  buildLicenseFormData
};
