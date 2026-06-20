const backupService = require("../services/backup.service");

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function index(_req, res, next) {
  try {
    const backups = backupService.listBackups();
    return res.render("layouts/developer-layout", {
      pageTitle: "Backups",
      contentPartial: "../pages/developer/backups/index",
      breadcrumbs: [{ label: "Dashboard", href: "/developer/dashboard" }, { label: "Backups" }],
      backups,
      formatBytes
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const backup = await backupService.createDatabaseBackup();
    backupService.deleteOldBackups();
    req.flash("success", `Backup created: ${backup.filename}`);
    return res.redirect("/developer/backups");
  } catch (error) {
    req.flash("error", `Backup failed: ${error.message}`);
    return res.redirect("/developer/backups");
  }
}

function download(req, res, next) {
  try {
    const filePath = backupService.verifyBackupFile(req.params.filename);
    return res.download(filePath, req.params.filename);
  } catch (error) {
    return next(error);
  }
}

function remove(req, res, next) {
  try {
    backupService.deleteBackup(req.params.filename);
    req.flash("success", "Backup deleted.");
    return res.redirect("/developer/backups");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  create,
  download,
  remove
};
