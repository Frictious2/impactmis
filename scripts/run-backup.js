const backupService = require("../src/services/backup.service");
const pool = require("../src/db/pool");

async function main() {
  const backup = await backupService.createDatabaseBackup();
  const deleted = backupService.deleteOldBackups();
  console.log(`PASS: Created backup ${backup.filename} (${backup.size} bytes).`);
  console.log(`PASS: Removed ${deleted.length} old backup(s).`);
}

main()
  .catch((error) => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
