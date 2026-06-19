const fs = require("fs");
const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = req.currentUser?.tenant_id || "unknown";
    const uploadDir = path.join(process.cwd(), "public", "uploads", "expenses", String(tenantId));
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Only jpeg, png, webp, and pdf receipt files are allowed.");
      error.code = "INVALID_EXPENSE_FILE_TYPE";
      return cb(error);
    }
    return cb(null, true);
  }
}).single("receipt_file");

function expenseUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }
    req.flash("error", error.code === "LIMIT_FILE_SIZE" ? "Receipt file must be 5MB or smaller." : error.message);
    const fallback = req.params.id ? `/expenses/${req.params.id}` : "/expenses/create";
    return res.redirect(fallback);
  });
}

module.exports = { expenseUpload };
