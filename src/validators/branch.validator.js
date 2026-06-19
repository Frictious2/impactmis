const { body } = require("express-validator");
const branchRepo = require("../repos/branch.repo");

function prepareBranchInput(req, res, next) {
  req.body.branch_code = req.body.branch_code ? String(req.body.branch_code).trim().toUpperCase() : "";
  req.body.name = req.body.name ? String(req.body.name).trim() : "";
  req.body.address = req.body.address ? String(req.body.address).trim() : "";
  req.body.city = req.body.city ? String(req.body.city).trim() : "";
  req.body.district = req.body.district ? String(req.body.district).trim() : "";
  req.body.country = req.body.country ? String(req.body.country).trim() : "Sierra Leone";
  req.body.latitude = req.body.latitude ? String(req.body.latitude).trim() : "";
  req.body.longitude = req.body.longitude ? String(req.body.longitude).trim() : "";
  req.body.geofence_radius_meters = req.body.geofence_radius_meters
    ? String(req.body.geofence_radius_meters).trim()
    : "100";
  req.body.contact_name = req.body.contact_name ? String(req.body.contact_name).trim() : "";
  req.body.contact_phone = req.body.contact_phone ? String(req.body.contact_phone).trim() : "";
  req.body.status = req.body.status ? String(req.body.status).trim() : "active";
  next();
}

const branchValidator = [
  body("branch_code")
    .notEmpty()
    .withMessage("Branch code is required.")
    .bail()
    .custom(async (value, { req }) => {
      const exists = await branchRepo.existsByCodeForTenant(
        value,
        req.currentUser.tenant_id,
        req.params.id || null
      );
      if (exists) {
        throw new Error("Branch code is already in use for this tenant.");
      }
      return true;
    }),
  body("name").notEmpty().withMessage("Branch name is required."),
  body("address").notEmpty().withMessage("Address is required."),
  body("latitude")
    .notEmpty()
    .withMessage("Latitude is required.")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be a valid coordinate."),
  body("longitude")
    .notEmpty()
    .withMessage("Longitude is required.")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be a valid coordinate."),
  body("geofence_radius_meters")
    .isInt({ min: 10 })
    .withMessage("Geofence radius must be at least 10 meters."),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Branch status is invalid."),
  body("contact_phone")
    .optional({ values: "falsy" })
    .isLength({ max: 50 })
    .withMessage("Contact phone is too long.")
];

module.exports = {
  prepareBranchInput,
  branchValidator
};
