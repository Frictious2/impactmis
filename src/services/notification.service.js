const pool = require("../db/pool");
const notificationRepo = require("../repos/notification.repo");
const auditLogRepo = require("../repos/audit-log.repo");

async function createNotification(payload) {
  return notificationRepo.createNotification(payload);
}

async function createUserNotification(tenantId, userId, payload) {
  return createNotification({ ...payload, tenant_id: tenantId, user_id: userId });
}

async function createTenantNotification(tenantId, payload) {
  return createNotification({ ...payload, tenant_id: tenantId, user_id: null });
}

async function listUserNotifications(tenantId, userId, filters) {
  return notificationRepo.listUserNotifications(tenantId, userId, filters);
}

async function markNotificationRead(tenantId, userId, notificationId, actorUserId, ipAddress) {
  await notificationRepo.markNotificationRead(tenantId, userId, notificationId);
  await auditLogRepo.create({
    tenant_id: tenantId,
    user_id: actorUserId || userId,
    action: "notification.read",
    entity_type: "notification",
    entity_id: String(notificationId),
    metadata_json: { notification_id: Number(notificationId) },
    ip_address: ipAddress
  });
}

async function markAllNotificationsRead(tenantId, userId, ipAddress) {
  await notificationRepo.markAllNotificationsRead(tenantId, userId);
  await auditLogRepo.create({
    tenant_id: tenantId,
    user_id: userId,
    action: "notification.read_all",
    entity_type: "notification",
    metadata_json: { user_id: userId },
    ip_address: ipAddress
  });
}

async function countUnreadNotifications(tenantId, userId) {
  return notificationRepo.countUnreadNotifications(tenantId, userId);
}

async function latestUserNotifications(tenantId, userId, limit = 5) {
  return notificationRepo.latestUserNotifications(tenantId, userId, limit);
}

async function notifyRoles(tenantId, roles, payload) {
  try {
    const users = await notificationRepo.listActiveTenantUsersByRoles(tenantId, roles);
    await Promise.all(users.map((user) => createUserNotification(tenantId, user.id, payload)));
  } catch (error) {
    console.error("Notification delivery failed:", error.message);
  }
}

async function safeUserNotification(tenantId, userId, payload) {
  if (!userId) {
    return;
  }
  try {
    await createUserNotification(tenantId, userId, payload);
  } catch (error) {
    console.error("Notification delivery failed:", error.message);
  }
}

async function safeUserNotificationOnceToday(tenantId, userId, payload) {
  if (!userId) {
    return;
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const exists = await notificationRepo.existsRecentUserNotification(
      tenantId,
      userId,
      payload.category || "system",
      payload.title,
      `${today} 00:00:00`
    );
    if (!exists) {
      await createUserNotification(tenantId, userId, payload);
    }
  } catch (error) {
    console.error("Notification delivery failed:", error.message);
  }
}

module.exports = {
  createNotification,
  createUserNotification,
  createTenantNotification,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
  latestUserNotifications,
  notifyRoles,
  safeUserNotification,
  safeUserNotificationOnceToday
};
