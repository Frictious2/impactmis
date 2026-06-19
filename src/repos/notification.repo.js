const pool = require("../db/pool");

async function createNotification(payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO notifications (
        tenant_id, user_id, title, message, type, category, link_url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.tenant_id || null,
      payload.user_id || null,
      payload.title,
      payload.message,
      payload.type || "info",
      payload.category || "system",
      payload.link_url || null,
      payload.created_by || null
    ]
  );
  return result.insertId;
}

async function listUserNotifications(tenantId, userId, filters = {}, db = pool) {
  const params = [tenantId, userId, tenantId];
  const where = ["((tenant_id = ? AND user_id = ?) OR (tenant_id = ? AND user_id IS NULL))"];
  if (filters.category) {
    where.push("category = ?");
    params.push(filters.category);
  }
  if (filters.read_state === "read") {
    where.push("is_read = 1");
  }
  if (filters.read_state === "unread") {
    where.push("is_read = 0");
  }
  const [rows] = await db.query(
    `
      SELECT *
      FROM notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `,
    params
  );
  return rows;
}

async function latestUserNotifications(tenantId, userId, limit = 5, db = pool) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM notifications
      WHERE ((tenant_id = ? AND user_id = ?) OR (tenant_id = ? AND user_id IS NULL))
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [tenantId, userId, tenantId, Number(limit)]
  );
  return rows;
}

async function markNotificationRead(tenantId, userId, notificationId, db = pool) {
  await db.query(
    `
      UPDATE notifications
      SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE id = ?
        AND ((tenant_id = ? AND user_id = ?) OR (tenant_id = ? AND user_id IS NULL))
    `,
    [notificationId, tenantId, userId, tenantId]
  );
}

async function markAllNotificationsRead(tenantId, userId, db = pool) {
  await db.query(
    `
      UPDATE notifications
      SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE ((tenant_id = ? AND user_id = ?) OR (tenant_id = ? AND user_id IS NULL))
        AND is_read = 0
    `,
    [tenantId, userId, tenantId]
  );
}

async function countUnreadNotifications(tenantId, userId, db = pool) {
  const [[row]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE ((tenant_id = ? AND user_id = ?) OR (tenant_id = ? AND user_id IS NULL))
        AND is_read = 0
    `,
    [tenantId, userId, tenantId]
  );
  return Number(row.total || 0);
}

async function listActiveTenantUsersByRoles(tenantId, roles, db = pool) {
  if (!roles.length) {
    return [];
  }
  const [rows] = await db.query(
    `
      SELECT id, full_name, email, role
      FROM users
      WHERE tenant_id = ?
        AND status = 'active'
        AND role IN (${roles.map(() => "?").join(",")})
    `,
    [tenantId, ...roles]
  );
  return rows;
}

async function existsRecentUserNotification(tenantId, userId, category, title, sinceDate, db = pool) {
  const [rows] = await db.query(
    `
      SELECT id
      FROM notifications
      WHERE tenant_id = ?
        AND user_id = ?
        AND category = ?
        AND title = ?
        AND created_at >= ?
      LIMIT 1
    `,
    [tenantId, userId, category, title, sinceDate]
  );
  return Boolean(rows[0]);
}

module.exports = {
  createNotification,
  listUserNotifications,
  latestUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
  listActiveTenantUsersByRoles,
  existsRecentUserNotification
};
