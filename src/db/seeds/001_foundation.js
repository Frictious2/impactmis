const bcrypt = require("bcryptjs");
const env = require("../../config/env");

const permissions = [
  ["developer.dashboard.view", "View developer dashboard"],
  ["developer.tenants.manage", "Manage tenant records"],
  ["developer.licenses.manage", "Manage license records"],
  ["developer.users.manage", "Manage developer and tenant users"],
  ["developer.audit_logs.view", "View system audit logs"],
  ["developer.settings.manage", "Manage system settings"],
  ["tenant.dashboard.view", "View tenant dashboard"],
  ["tenant.staff.view", "View staff and volunteer area"],
  ["tenant.attendance.view", "View attendance area"],
  ["tenant.projects.view", "View projects area"],
  ["tenant.payroll.view", "View payroll area"],
  ["tenant.reports.view", "View reports area"],
  ["tenant.approvals.view", "View approvals area"],
  ["tenant.audit_logs.view", "View tenant audit logs"],
  ["tenant.settings.manage", "Manage tenant settings"]
];

const roles = [
  ["Developer", "Developer / Super Admin"],
  ["Tenant Admin", "NGO/CBO Admin"],
  ["HR Manager", "Human resources manager"],
  ["Finance Manager", "Finance and payroll manager"],
  ["Project Manager", "Project manager"],
  ["Data Entry Officer", "Data entry officer"],
  ["Staff", "Staff member"],
  ["Volunteer", "Volunteer user"],
  ["Auditor", "Audit user"],
  ["Donor", "Donor read-only user"]
];

const rolePermissionMap = {
  Developer: permissions.map(([code]) => code),
  "Tenant Admin": [
    "tenant.dashboard.view",
    "tenant.staff.view",
    "tenant.attendance.view",
    "tenant.projects.view",
    "tenant.payroll.view",
    "tenant.reports.view",
    "tenant.approvals.view",
    "tenant.audit_logs.view",
    "tenant.settings.manage"
  ],
  "HR Manager": ["tenant.dashboard.view", "tenant.staff.view", "tenant.attendance.view"],
  "Finance Manager": ["tenant.dashboard.view", "tenant.payroll.view", "tenant.reports.view"],
  "Project Manager": ["tenant.dashboard.view", "tenant.projects.view", "tenant.reports.view"],
  "Data Entry Officer": ["tenant.dashboard.view", "tenant.staff.view", "tenant.attendance.view"],
  Staff: ["tenant.dashboard.view"],
  Volunteer: ["tenant.dashboard.view"],
  Auditor: ["tenant.dashboard.view", "tenant.audit_logs.view", "tenant.reports.view"],
  Donor: ["tenant.dashboard.view", "tenant.reports.view"]
};

module.exports = {
  id: "001_foundation",
  run: async (db) => {
    for (const [code, description] of permissions) {
      await db.query(
        `
          INSERT INTO permissions (code, description)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE description = VALUES(description)
        `,
        [code, description]
      );
    }

    for (const [name, description] of roles) {
      await db.query(
        `
          INSERT INTO roles (tenant_id, name, description, is_system, scope_key)
          VALUES (NULL, ?, ?, TRUE, 'system')
          ON DUPLICATE KEY UPDATE description = VALUES(description), is_system = VALUES(is_system)
        `,
        [name, description]
      );
    }

    const [roleRows] = await db.query("SELECT id, name FROM roles WHERE tenant_id IS NULL");
    const [permissionRows] = await db.query("SELECT id, code FROM permissions");

    const roleIdsByName = Object.fromEntries(roleRows.map((row) => [row.name, row.id]));
    const permissionIdsByCode = Object.fromEntries(permissionRows.map((row) => [row.code, row.id]));

    await db.query("DELETE FROM role_permissions");

    for (const [roleName, permissionCodes] of Object.entries(rolePermissionMap)) {
      for (const code of permissionCodes) {
        await db.query(
          `
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `,
          [roleIdsByName[roleName], permissionIdsByCode[code]]
        );
      }
    }

    const passwordHash = await bcrypt.hash(env.devAdminPassword, 12);

    await db.query(
      `
        INSERT INTO users (
          tenant_id,
          full_name,
          email,
          password_hash,
          role,
          user_type,
          status,
          must_change_password,
          tenant_scope_key
        )
        VALUES (NULL, ?, ?, ?, 'Developer', 'developer', 'active', TRUE, 'developer')
        ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          status = VALUES(status),
          must_change_password = VALUES(must_change_password)
      `,
      [env.devAdminName, env.devAdminEmail, passwordHash]
    );
  }
};
