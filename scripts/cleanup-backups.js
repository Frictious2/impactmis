const backupService = require("../src/services/backup.service");
const pool = require("../src/db/pool");

try {
  const deleted = backupService.deleteOldBackups();
  console.log(`PASS: Removed ${deleted.length} old backup(s).`);
} catch (error) {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
} finally {
  pool.end();
}
