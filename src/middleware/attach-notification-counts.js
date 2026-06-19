const notificationService = require("../services/notification.service");
const messageService = require("../services/message.service");

async function attachNotificationCounts(req, res, next) {
  try {
    res.locals.unreadNotificationsCount = 0;
    res.locals.unreadMessagesCount = 0;
    res.locals.latestNotifications = [];

    if (!req.currentUser || !req.currentUser.tenant_id) {
      return next();
    }

    const tenantId = req.currentUser.tenant_id;
    const userId = req.currentUser.id;
    const [unreadNotificationsCount, unreadMessagesCount, latestNotifications] = await Promise.all([
      notificationService.countUnreadNotifications(tenantId, userId),
      messageService.countUnreadMessages(tenantId, userId),
      notificationService.latestUserNotifications(tenantId, userId, 5)
    ]);

    res.locals.unreadNotificationsCount = unreadNotificationsCount;
    res.locals.unreadMessagesCount = unreadMessagesCount;
    res.locals.latestNotifications = latestNotifications;
    return next();
  } catch (error) {
    res.locals.unreadNotificationsCount = 0;
    res.locals.unreadMessagesCount = 0;
    res.locals.latestNotifications = [];
    return next();
  }
}

module.exports = { attachNotificationCounts };
