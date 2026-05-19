const pool = require("../db/pool");

async function findByTenantId(tenantId, db = pool) {
  const [rows] = await db.query(
    "SELECT * FROM organization_profiles WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );

  return rows[0] || null;
}

async function upsertByTenantId(tenantId, payload, db = pool) {
  await db.query(
    `
      INSERT INTO organization_profiles (
        tenant_id,
        organization_name,
        logo,
        address,
        city,
        district,
        country,
        registration_number,
        website,
        email,
        phone,
        mission_statement,
        organization_type,
        fiscal_year_start_month
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        organization_name = VALUES(organization_name),
        logo = VALUES(logo),
        address = VALUES(address),
        city = VALUES(city),
        district = VALUES(district),
        country = VALUES(country),
        registration_number = VALUES(registration_number),
        website = VALUES(website),
        email = VALUES(email),
        phone = VALUES(phone),
        mission_statement = VALUES(mission_statement),
        organization_type = VALUES(organization_type),
        fiscal_year_start_month = VALUES(fiscal_year_start_month)
    `,
    [
      tenantId,
      payload.organization_name,
      payload.logo,
      payload.address,
      payload.city,
      payload.district,
      payload.country,
      payload.registration_number,
      payload.website,
      payload.email,
      payload.phone,
      payload.mission_statement,
      payload.organization_type,
      payload.fiscal_year_start_month
    ]
  );

  return findByTenantId(tenantId, db);
}

module.exports = {
  findByTenantId,
  upsertByTenantId
};
