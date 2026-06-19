const pool = require("../src/db/pool");
const { getModuleCodes, parseJsonField } = require("../src/utils/tenant-form");

const SHOULD_FIX = process.argv.includes("--fix");
const EXPECTED_MODULES = getModuleCodes();

function normalizeModules(value) {
  const parsed = parseJsonField(value, {});
  const modules = {};

  if (Array.isArray(parsed)) {
    parsed.forEach((code) => {
      modules[code] = true;
    });
  } else if (parsed && typeof parsed === "object") {
    Object.assign(modules, parsed);
  }

  EXPECTED_MODULES.forEach((code) => {
    if (!Object.prototype.hasOwnProperty.call(modules, code)) {
      modules[code] = false;
    }
  });

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

  const findings = [];

  for (const license of licenses) {
    const parsed = parseJsonField(license.modules_json, {});
    const missing = EXPECTED_MODULES.filter((code) => {
      if (Array.isArray(parsed)) {
        return !parsed.includes(code);
      }
      return !parsed || typeof parsed !== "object" || !Object.prototype.hasOwnProperty.call(parsed, code);
    });

    if (!missing.length) {
      continue;
    }

    findings.push({
      license_id: license.id,
      tenant_name: license.tenant_name,
      tenant_code: license.tenant_code,
      missing
    });

    if (SHOULD_FIX) {
      await pool.query("UPDATE licenses SET modules_json = ?, updated_at = NOW() WHERE id = ?", [
        JSON.stringify(normalizeModules(license.modules_json)),
        license.id
      ]);
    }
  }

  if (!findings.length) {
    console.log("PASS: All active licenses include expected module keys.");
    return;
  }

  console.log(`${SHOULD_FIX ? "FIXED" : "WARN"}: ${findings.length} active license(s) are missing module keys.`);
  findings.forEach((finding) => {
    console.log(
      `- ${finding.tenant_name} (${finding.tenant_code}) license #${finding.license_id}: ${finding.missing.join(", ")}`
    );
  });

  if (!SHOULD_FIX) {
    console.log("Run `node scripts/audit-license-modules.js --fix` to normalize missing keys to false.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
