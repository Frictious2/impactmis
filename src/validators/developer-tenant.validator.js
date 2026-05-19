const { body } = require("express-validator");
const tenantRepo = require("../repos/tenant.repo");
const {
  buildUniqueTenantCode,
  buildUniqueSlug,
  coerceModules,
  getModuleCodes,
  normalizeDateInput,
  normalizeEmail,
  normalizeTenantCode,
  slugify
} = require("../utils/tenant-form");

async function prepareTenantCreateInput(req, res, next) {
  try {
    const name = req.body.name || "";
    req.body.name = name.trim();
    req.body.tenant_code = await buildUniqueTenantCode(req.body.tenant_code, name);
    req.body.slug = await buildUniqueSlug(req.body.slug, name);
    req.body.contact_email = normalizeEmail(req.body.contact_email);
    req.body.admin_email = normalizeEmail(req.body.admin_email);
    req.body.country = (req.body.country || "Sierra Leone").trim();
    req.body.starts_at = normalizeDateInput(req.body.starts_at);
    req.body.modules = coerceModules(req.body.modules);
    const rawMustChange = Array.isArray(req.body.must_change_password)
      ? req.body.must_change_password[req.body.must_change_password.length - 1]
      : req.body.must_change_password;
    req.body.must_change_password = rawMustChange === "false" ? "false" : "true";
    next();
  } catch (error) {
    next(error);
  }
}

function prepareLicenseInput(req, res, next) {
  req.body.plan_name = (req.body.plan_name || "").trim();
  req.body.starts_at = normalizeDateInput(req.body.starts_at);
  req.body.modules = coerceModules(req.body.modules);
  req.body.status = (req.body.status || "active").trim();
  next();
}

const createTenantValidator = [
  body("name").trim().notEmpty().withMessage("Tenant name is required."),
  body("tenant_code")
    .customSanitizer((value) => normalizeTenantCode(value))
    .notEmpty()
    .withMessage("Tenant code could not be generated.")
    .bail()
    .custom(async (value) => {
      const exists = await tenantRepo.existsByTenantCode(value);
      if (exists) {
        throw new Error("Tenant code is already in use.");
      }
      return true;
    }),
  body("slug")
    .customSanitizer((value) => slugify(value))
    .notEmpty()
    .withMessage("Slug could not be generated.")
    .bail()
    .custom(async (value) => {
      const exists = await tenantRepo.existsBySlug(value);
      if (exists) {
        throw new Error("Slug is already in use.");
      }
      return true;
    }),
  body("primary_domain").optional({ values: "falsy" }).trim().isLength({ max: 255 }),
  body("contact_email")
    .optional({ values: "falsy" })
    .isEmail()
    .withMessage("Contact email must be a valid email address."),
  body("plan_name").trim().notEmpty().withMessage("Plan name is required."),
  body("duration_months")
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive number of months."),
  body("starts_at").isISO8601().withMessage("Start date is required."),
  body("seat_limit").isInt({ min: 1 }).withMessage("Seat limit must be a positive number."),
  body("modules").custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error("Select at least one enabled module.");
    }

    const validCodes = new Set(getModuleCodes());
    for (const code of value) {
      if (!validCodes.has(code)) {
        throw new Error("One or more selected modules are invalid.");
      }
    }

    return true;
  }),
  body("admin_full_name").trim().notEmpty().withMessage("Admin full name is required."),
  body("admin_email").isEmail().withMessage("Admin email must be a valid email address."),
  body("temporary_password")
    .isLength({ min: 8 })
    .withMessage("Temporary password must be at least 8 characters long.")
];

const issueLicenseValidator = [
  body("plan_name").trim().notEmpty().withMessage("Plan name is required."),
  body("duration_months")
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive number of months."),
  body("starts_at").isISO8601().withMessage("Start date is required."),
  body("seat_limit").isInt({ min: 1 }).withMessage("Seat limit must be a positive number."),
  body("status")
    .isIn(["active", "expired", "revoked"])
    .withMessage("Status must be active, expired, or revoked."),
  body("modules").custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error("Select at least one enabled module.");
    }

    const validCodes = new Set(getModuleCodes());
    for (const code of value) {
      if (!validCodes.has(code)) {
        throw new Error("One or more selected modules are invalid.");
      }
    }

    return true;
  })
];

module.exports = {
  prepareTenantCreateInput,
  prepareLicenseInput,
  createTenantValidator,
  issueLicenseValidator
};
