const path = require("path");
const multer = require("multer");
const activityReportService = require("../services/activity-report.service");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

function createStorage() {
  return multer.diskStorage({
    destination(req, file, cb) {
      try {
        const { absoluteDir } = activityReportService.ensureUploadDirectory(req.currentUser.tenant_id);
        cb(null, absoluteDir);
      } catch (error) {
        cb(error);
      }
    },
    filename(req, file, cb) {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      cb(null, safeName);
    }
  });
}

const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("Only JPEG, PNG, WEBP images and PDF files are allowed.");
      error.statusCode = 422;
      return cb(error);
    }
    return cb(null, true);
  }
});

function activityReportUpload(req, res, next) {
  upload.single("attachment")(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Attachment must be 5MB or smaller."
        : error.message || "Attachment upload failed.";

    req.flash("error", message);
    return res.redirect(`/activity-reports/${req.params.id}?tab=attachments`);
  });
}

module.exports = {
  activityReportUpload
};
