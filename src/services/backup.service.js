const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const env = require("../config/env");
const logger = require("./logger.service");
const pool = require("../db/pool");

const BACKUP_NAME_PATTERN = /^impactmis-db-\d{8}-\d{6}\.sql$/;

function backupDir() {
  const absoluteDir = path.resolve(process.cwd(), env.backupDir);
  fs.mkdirSync(absoluteDir, { recursive: true });
  return absoluteDir;
}

function timestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `${date}-${time}`;
}

function validateFilename(filename) {
  const base = path.basename(String(filename || ""));
  if (base !== filename || !BACKUP_NAME_PATTERN.test(base)) {
    const error = new Error("Invalid backup filename.");
    error.statusCode = 400;
    throw error;
  }
  return base;
}

function getBackupPath(filename) {
  const safeName = validateFilename(filename);
  const absoluteDir = backupDir();
  const absolutePath = path.resolve(absoluteDir, safeName);
  if (!absolutePath.startsWith(`${absoluteDir}${path.sep}`)) {
    const error = new Error("Invalid backup path.");
    error.statusCode = 400;
    throw error;
  }
  return absolutePath;
}

function runMysqldump(outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      `--host=${env.dbHost}`,
      `--port=${env.dbPort}`,
      `--user=${env.dbUser}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      env.dbName
    ];

    const dump = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: env.dbPass || "" },
      windowsHide: true
    });
    const output = fs.createWriteStream(outputPath);
    let stderr = "";

    dump.stdout.pipe(output);
    dump.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    dump.on("error", (error) => {
      output.destroy();
      reject(error);
    });
    dump.on("close", (code) => {
      output.end();
      if (code === 0) {
        return resolve();
      }
      reject(new Error(stderr || `mysqldump exited with code ${code}`));
    });
  });
}

function sqlValue(value) {
  if (value === null || typeof value === "undefined") {
    return "NULL";
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

async function createNodeSqlDump(outputPath) {
  const [tables] = await pool.query("SHOW TABLES");
  const tableKey = `Tables_in_${env.dbName}`;
  const chunks = [
    "-- ImpactMIS fallback SQL backup",
    `-- Generated at ${new Date().toISOString()}`,
    "SET FOREIGN_KEY_CHECKS=0;",
    ""
  ];

  for (const row of tables) {
    const tableName = row[tableKey] || Object.values(row)[0];
    const [[createRow]] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
    chunks.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    chunks.push(`${createRow["Create Table"]};`);

    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    for (const record of rows) {
      const columns = Object.keys(record).map((column) => `\`${column}\``).join(", ");
      const values = Object.values(record).map(sqlValue).join(", ");
      chunks.push(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});`);
    }
    chunks.push("");
  }

  chunks.push("SET FOREIGN_KEY_CHECKS=1;");
  fs.writeFileSync(outputPath, `${chunks.join("\n")}\n`);
}

async function createDatabaseBackup() {
  const filename = `impactmis-db-${timestamp()}.sql`;
  const outputPath = getBackupPath(filename);

  try {
    try {
      await runMysqldump(outputPath);
    } catch (error) {
      logger.error("mysqldump failed; using fallback SQL dump", { error: error.message });
      await createNodeSqlDump(outputPath);
    }
    const stats = fs.statSync(outputPath);
    logger.info("Database backup created", { filename, size: stats.size });
    return {
      filename,
      path: outputPath,
      size: stats.size,
      created_at: stats.birthtime
    };
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
    logger.error("Database backup failed", { filename, error: error.message });
    throw error;
  }
}

function listBackups() {
  return fs
    .readdirSync(backupDir())
    .filter((filename) => BACKUP_NAME_PATTERN.test(filename))
    .map((filename) => {
      const filePath = getBackupPath(filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime
      };
    })
    .sort((a, b) => b.modified_at - a.modified_at);
}

function verifyBackupFile(filename) {
  const filePath = getBackupPath(filename);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const error = new Error("Backup file not found.");
    error.statusCode = 404;
    throw error;
  }
  return filePath;
}

function deleteBackup(filename) {
  const filePath = verifyBackupFile(filename);
  fs.rmSync(filePath, { force: true });
  logger.info("Database backup deleted", { filename });
}

function deleteOldBackups(retentionDays = env.backupRetentionDays) {
  const cutoff = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;
  const deleted = [];

  listBackups().forEach((backup) => {
    if (new Date(backup.modified_at).getTime() < cutoff) {
      deleteBackup(backup.filename);
      deleted.push(backup.filename);
    }
  });

  logger.info("Old backup cleanup completed", { retentionDays, deleted_count: deleted.length });
  return deleted;
}

module.exports = {
  createDatabaseBackup,
  listBackups,
  deleteOldBackups,
  getBackupPath,
  verifyBackupFile,
  deleteBackup
};
