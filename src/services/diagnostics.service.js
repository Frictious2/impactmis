const fs = require("fs");
const path = require("path");
const pool = require("../db/pool");
const env = require("../config/env");

function ensureWritable(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(absolutePath, { recursive: true });
  fs.accessSync(absolutePath, fs.constants.W_OK);
  return { path: relativePath, writable: true };
}

async function checkDatabase() {
  try {
    await pool.query("SELECT 1 AS ok");
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function getMigrationSummary() {
  try {
    const [[row]] = await pool.query("SELECT COUNT(*) AS total, MAX(applied_at) AS latest FROM schema_migrations");
    return {
      table_present: true,
      applied_count: Number(row.total || 0),
      latest_applied_at: row.latest || null
    };
  } catch (error) {
    return { table_present: false, error: error.message };
  }
}

async function getDiagnostics() {
  const upload = (() => {
    try {
      return ensureWritable(env.uploadRoot);
    } catch (error) {
      return { path: env.uploadRoot, writable: false, error: error.message };
    }
  })();

  const backup = (() => {
    try {
      return ensureWritable(env.backupDir);
    } catch (error) {
      return { path: env.backupDir, writable: false, error: error.message };
    }
  })();

  const [database, migrations] = await Promise.all([checkDatabase(), getMigrationSummary()]);

  return {
    app: "ImpactMIS",
    app_env: env.appEnv,
    node_env: env.nodeEnv,
    node_version: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    maintenance_mode: env.maintenanceMode,
    database,
    storage: {
      upload,
      backup
    },
    migrations
  };
}

module.exports = {
  getDiagnostics,
  checkDatabase,
  getMigrationSummary,
  ensureWritable
};
