const pool = require("../db/pool");

async function listTenantAssignableRoles() {
  const [rows] = await pool.query(
    `
      SELECT id, name, description
      FROM roles
      WHERE tenant_id IS NULL
        AND name <> 'Developer'
      ORDER BY name ASC
    `
  );

  return rows;
}

async function isTenantAssignableRole(roleName) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM roles
      WHERE tenant_id IS NULL
        AND name = ?
        AND name <> 'Developer'
      LIMIT 1
    `,
    [roleName]
  );

  return Boolean(rows[0]);
}

module.exports = {
  listTenantAssignableRoles,
  isTenantAssignableRole
};
