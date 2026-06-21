const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || process.env.APP_ENV || "development",
  appEnv: process.env.APP_ENV || "development",
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  trustProxy: String(process.env.TRUST_PROXY || "").toLowerCase() === "true",
  maintenanceMode: String(process.env.MAINTENANCE_MODE || "false").toLowerCase() === "true",
  sessionSecret: process.env.SESSION_SECRET || "change_me",
  dbHost: process.env.DB_HOST || "localhost",
  dbUser: process.env.DB_USER || "root",
  dbPass: process.env.DB_PASS || "",
  dbName: process.env.DB_NAME || "impactmis",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbConnectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  uploadRoot: process.env.UPLOAD_ROOT || "public/uploads",
  backupDir: process.env.BACKUP_DIR || "storage/backups",
  backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 14),
  logDir: process.env.LOG_DIR || "storage/logs",
  devAdminName: process.env.DEV_ADMIN_NAME || "Developer Admin",
  devAdminEmail: process.env.DEV_ADMIN_EMAIL || "admin@impactmis.local",
  devAdminPassword: process.env.DEV_ADMIN_PASSWORD || "ChangeMe123!"
};

env.isProduction = env.appEnv === "production";

if (env.isProduction && (!process.env.SESSION_SECRET || env.sessionSecret === "change_me")) {
  throw new Error("SESSION_SECRET must be set to a strong non-default value in production.");
}

module.exports = env;
