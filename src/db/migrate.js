const fs = require("fs");
const path = require("path");

const pool = require("./pool");
const { ensureDatabaseExists } = require("./bootstrap");

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(191) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrationIds() {
  const [rows] = await pool.query("SELECT id FROM schema_migrations ORDER BY id ASC");
  return new Set(rows.map((row) => row.id));
}

async function runMigrations() {
  await ensureDatabaseExists();
  await ensureSchemaMigrationsTable();

  const migrationDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith(".js"))
    .sort();
  const appliedIds = await getAppliedMigrationIds();

  for (const file of files) {
    const migration = require(path.join(migrationDir, file));

    if (appliedIds.has(migration.id)) {
      console.log(`Skipping ${migration.id}`);
      continue;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await migration.up(connection);
      await connection.query("INSERT INTO schema_migrations (id) VALUES (?)", [migration.id]);
      await connection.commit();
      console.log(`Applied ${migration.id}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

runMigrations()
  .then(async () => {
    await pool.end();
    console.log("Migrations complete");
  })
  .catch(async (error) => {
    console.error("Migration failed:", error.message);
    await pool.end();
    process.exit(1);
  });
