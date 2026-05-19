const { body } = require("express-validator");
const staffRepo = require("../repos/staff.repo");

function normalizeTime(value) {
  if (!value) {
    return null;
  }
  return String(value).trim();
}

function prepareAttendanceInput(req, res, next) {
  req.body.staff_member_id = req.body.staff_member_id ? String(req.body.staff_member_id).trim() : "";
  req.body.attendance_date = (req.body.attendance_date || "").trim();
  req.body.status = (req.body.status || "").trim();
  req.body.check_in_time = normalizeTime(req.body.check_in_time);
  req.body.check_out_time = normalizeTime(req.body.check_out_time);
  req.body.location = req.body.location ? String(req.body.location).trim() : "";
  req.body.notes = req.body.notes ? String(req.body.notes).trim() : "";
  req.body.approval_status = (req.body.approval_status || "submitted").trim();
  next();
}

function prepareBulkAttendanceInput(req, res, next) {
  req.body.attendance_date = (req.body.attendance_date || "").trim();
  const rows = Array.isArray(req.body.entries)
    ? req.body.entries
    : Object.values(req.body.entries || {});

  req.body.entries = rows.map((entry) => ({
    staff_member_id: entry.staff_member_id ? String(entry.staff_member_id).trim() : "",
    status: (entry.status || "").trim(),
    check_in_time: normalizeTime(entry.check_in_time),
    check_out_time: normalizeTime(entry.check_out_time),
    notes: entry.notes ? String(entry.notes).trim() : "",
    location: entry.location ? String(entry.location).trim() : ""
  }));
  next();
}

function prepareRejectInput(req, res, next) {
  req.body.rejection_reason = req.body.rejection_reason ? String(req.body.rejection_reason).trim() : "";
  next();
}

const attendanceValidator = [
  body("staff_member_id")
    .notEmpty()
    .withMessage("Staff member is required.")
    .bail()
    .custom(async (value, { req }) => {
      const staffMember = await staffRepo.findStaffById(req.currentUser.tenant_id, value);
      if (!staffMember) {
        throw new Error("Selected staff member was not found.");
      }
      if (staffMember.status !== "active") {
        throw new Error("Only active staff or volunteers can receive attendance.");
      }
      return true;
    }),
  body("attendance_date").isISO8601().withMessage("Attendance date is required."),
  body("status")
    .isIn(["present", "absent", "late", "excused", "sick", "on_leave"])
    .withMessage("Attendance status is invalid."),
  body("check_in_time")
    .optional({ values: "falsy" })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage("Check in time must be valid."),
  body("check_out_time")
    .optional({ values: "falsy" })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage("Check out time must be valid.")
    .bail()
    .custom((value, { req }) => {
      if (!value || !req.body.check_in_time) {
        return true;
      }
      if (value < req.body.check_in_time) {
        throw new Error("Check out time cannot be earlier than check in time.");
      }
      return true;
    }),
  body("approval_status")
    .optional()
    .isIn(["draft", "submitted", "approved", "rejected"])
    .withMessage("Approval status is invalid.")
];

const bulkAttendanceValidator = [
  body("attendance_date").isISO8601().withMessage("Attendance date is required."),
  body("entries").custom((entries) => {
    if (!Array.isArray(entries) || !entries.length) {
      throw new Error("Bulk attendance entries are required.");
    }
    return true;
  })
];

const rejectAttendanceValidator = [
  body("rejection_reason").notEmpty().withMessage("Rejection reason is required.")
];

module.exports = {
  prepareAttendanceInput,
  prepareBulkAttendanceInput,
  prepareRejectInput,
  attendanceValidator,
  bulkAttendanceValidator,
  rejectAttendanceValidator
};
