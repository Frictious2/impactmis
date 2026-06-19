const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 3000),
  appEnv: process.env.APP_ENV || "development",
  sessionSecret: process.env.SESSION_SECRET || "change_me",
  dbHost: process.env.DB_HOST || "localhost",
  dbUser: process.env.DB_USER || "root",
  dbPass: process.env.DB_PASS || "",
  dbName: process.env.DB_NAME || "impactmis",
  dbPort: Number(process.env.DB_PORT || 3306),
  devAdminName: process.env.DEV_ADMIN_NAME || "Developer Admin",
  devAdminEmail: process.env.DEV_ADMIN_EMAIL || "admin@impactmis.local",
  devAdminPassword: process.env.DEV_ADMIN_PASSWORD || "ChangeMe123!"
};

env.isProduction = env.appEnv === "production";

if (env.isProduction && (!process.env.SESSION_SECRET || env.sessionSecret === "change_me")) {
  throw new Error("SESSION_SECRET must be set to a strong non-default value in production.");
}

module.exports = env;
