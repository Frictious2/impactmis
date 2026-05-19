const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const tenantRepo = require("../repos/tenant.repo");
const licenseRepo = require("../repos/license.repo");
const userRepo = require("../repos/user.repo");
const auditLogRepo = require("../repos/audit-log.repo");
const {
  coerceModules,
  calculateLicenseExpiry,
  normalizeNullable,
  normalizeEmail,
  parseJsonField
} = require("../utils/tenant-form");

async function createTenantOnboarding({ actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const tenant = await tenantRepo.create(
      {
        name: payload.name.trim(),
        tenant_code: payload.tenant_code.trim(),
        slug: payload.slug.trim(),
        primary_domain: normalizeNullable(payload.primary_domain),
        contact_name: normalizeNullable(payload.contact_name),
        contact_email: normalizeEmail(payload.contact_email),
        contact_phone: normalizeNullable(payload.contact_phone),
        country: payload.country.trim(),
        status: "active"
      },
      connection
    );

    const license = await createLicenseRecord({
      connection,
      tenantId: tenant.id,
      payload: {
        plan_name: payload.plan_name,
        duration_months: payload.duration_months,
        starts_at: payload.starts_at,
        modules: payload.modules,
        seat_limit: payload.seat_limit,
        status: "active"
      }
    });

    const passwordHash = await bcrypt.hash(payload.temporary_password, 12);
    const adminUser = await userRepo.create(
      {
        tenant_id: tenant.id,
        full_name: payload.admin_full_name.trim(),
        email: normalizeEmail(payload.admin_email),
        password_hash: passwordHash,
        role: "Tenant Admin",
        user_type: "tenant",
        status: "active",
        must_change_password: payload.must_change_password === "true" || payload.must_change_password === true,
        tenant_scope_key: `tenant:${tenant.id}`
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenant.id,
        user_id: actor.id,
        action: "tenant.created",
        entity_type: "tenant",
        entity_id: String(tenant.id),
        metadata_json: {
          tenant_name: tenant.name,
          tenant_code: tenant.tenant_code,
          slug: tenant.slug
        },
        ip_address: ipAddress
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenant.id,
        user_id: actor.id,
        action: "license.issued",
        entity_type: "license",
        entity_id: String(license.id),
        metadata_json: {
          tenant_id: tenant.id,
          plan_name: license.plan_name,
          duration_months: license.duration_months,
          starts_at: license.starts_at,
          expires_at: license.expires_at,
          status: license.status,
          seat_limit: license.seat_limit,
          modules_enabled: parseJsonField(license.modules_json, [])
        },
        ip_address: ipAddress
      },
      connection
    );

    await auditLogRepo.create(
      {
        tenant_id: tenant.id,
        user_id: actor.id,
        action: "admin_user.created",
        entity_type: "user",
        entity_id: String(adminUser.id),
        metadata_json: {
          full_name: adminUser.full_name,
          email: adminUser.email,
          role: adminUser.role,
          must_change_password: Boolean(adminUser.must_change_password)
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return { tenant, license, adminUser };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function issueLicense({ tenantId, actor, ipAddress, payload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const license = await createLicenseRecord({
      connection,
      tenantId,
      payload
    });

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: "license.issued",
        entity_type: "license",
        entity_id: String(license.id),
        metadata_json: {
          tenant_id: tenantId,
          plan_name: license.plan_name,
          duration_months: license.duration_months,
          starts_at: license.starts_at,
          expires_at: license.expires_at,
          status: license.status,
          seat_limit: license.seat_limit,
          modules_enabled: parseJsonField(license.modules_json, [])
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return license;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateTenantStatus({ tenantId, nextStatus, actor, ipAddress }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const tenant = await tenantRepo.updateStatus(tenantId, nextStatus, connection);

    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: actor.id,
        action: nextStatus === "suspended" ? "tenant.suspended" : "tenant.reactivated",
        entity_type: "tenant",
        entity_id: String(tenantId),
        metadata_json: {
          tenant_name: tenant.name,
          status: tenant.status
        },
        ip_address: ipAddress
      },
      connection
    );

    await connection.commit();
    return tenant;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createLicenseRecord({ connection, tenantId, payload }) {
  const status = payload.status || "active";
  const startsAt = payload.starts_at;
  const durationMonths = Number(payload.duration_months);
  const expiresAt = calculateLicenseExpiry(startsAt, durationMonths);
  const modules = coerceModules(payload.modules);

  if (status === "active") {
    await licenseRepo.reclassifyPreviousActiveLicenses(tenantId, startsAt, connection);
  }

  return licenseRepo.create(
    {
      tenant_id: tenantId,
      plan_name: payload.plan_name.trim(),
      duration_months: durationMonths,
      starts_at: startsAt,
      expires_at: expiresAt,
      status,
      modules_json: modules,
      seat_limit: Number(payload.seat_limit)
    },
    connection
  );
}

module.exports = {
  createTenantOnboarding,
  issueLicense,
  updateTenantStatus
};
