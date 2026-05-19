const fs = require("fs");
const path = require("path");

const pool = require("./pool");
const { ensureDatabaseExists } = require("./bootstrap");

async function runSeeds() {
  await ensureDatabaseExists();

  const seedDir = path.join(__dirname, "seeds");
  const files = fs
    .readdirSync(seedDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const seed = require(path.join(seedDir, file));
    await seed.run(pool);
    console.log(`Seeded ${seed.id}`);
  }
}

runSeeds()
  .then(async () => {
    await pool.end();
    console.log("Seeding complete");
  })
  .catch(async (error) => {
    console.error("Seeding failed:", error.message);
    await pool.end();
    process.exit(1);
  });
