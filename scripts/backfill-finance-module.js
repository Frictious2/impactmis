const pool = require("../src/db/pool");
const { parseJsonField } = require("../src/utils/tenant-form");

function normalizeModules(value) {
  const parsed = parseJsonField(value, {});

  if (Array.isArray(parsed)) {
    const modules = {};
    parsed.forEach((code) => {
      modules[code] = true;
    });
    modules.finance = Object.prototype.hasOwnProperty.call(modules, "finance") ? modules.finance : false;
    return modules;
  }

  const modules = parsed && typeof parsed === "object" ? { ...parsed } : {};
  if (!Object.prototype.hasOwnProperty.call(modules, "finance")) {
    modules.finance = false;
  }
  return modules;
}

async function main() {
  const [licenses] = await pool.query(`
    SELECT
      l.id,
      l.tenant_id,
      l.modules_json,
      t.name AS tenant_name,
      t.tenant_code
    FROM licenses l
    INNER JOIN tenants t ON t.id = l.tenant_id
    WHERE l.status = 'active'
    ORDER BY t.name ASC, l.id ASC
  `);

  const affected = [];

  for (const license of licenses) {
    const parsed = parseJsonField(license.modules_json, {});
    const hasFinance = Array.isArray(parsed)
      ? parsed.includes("finance")
      : parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "finance");

    if (hasFinance) {
      continue;
    }

    const normalized = normalizeModules(license.modules_json);
    await pool.query("UPDATE licenses SET modules_json = ?, updated_at = NOW() WHERE id = ?", [
      JSON.stringify(normalized),
      license.id
    ]);

    affected.push({
      license_id: license.id,
      tenant_id: license.tenant_id,
      tenant_code: license.tenant_code,
      tenant_name: license.tenant_name
    });
  }

  if (!affected.length) {
    console.log("PASS: All active licenses already include a finance module key.");
    return;
  }

  console.log(`PASS: Normalized ${affected.length} active license(s) with finance:false.`);
  affected.forEach((item) => {
    console.log(`- ${item.tenant_name} (${item.tenant_code}) license #${item.license_id}`);
  });
}

main()
  .catch((error) => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
