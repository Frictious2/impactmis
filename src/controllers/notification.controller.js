const notificationService = require("../services/notification.service");

async function notifications(req, res, next) {
  try {
    const filters = {
      category: req.query.category || "",
      read_state: req.query.read_state || ""
    };
    const rows = await notificationService.listUserNotifications(req.currentUser.tenant_id, req.currentUser.id, filters);
    const layout = req.currentUser.role === "Donor" ? "layouts/donor-layout" : "layouts/tenant-layout";
    return res.render(layout, {
      pageTitle: "Notifications",
      contentPartial: "../pages/tenant/notifications/index",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Notifications" }],
      notifications: rows,
      filters,
      categories: ["system", "approval", "attendance", "project", "activity_report", "payroll", "finance", "license", "donor", "security"]
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    await notificationService.markNotificationRead(
      req.currentUser.tenant_id,
      req.currentUser.id,
      req.params.id,
      req.currentUser.id,
      req.ip
    );
    req.flash("success", "Notification marked as read.");
    return res.redirect(req.get("Referrer") || "/notifications");
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllNotificationsRead(req.currentUser.tenant_id, req.currentUser.id, req.ip);
    req.flash("success", "All notifications marked as read.");
    return res.redirect("/notifications");
  } catch (error) {
    return next(error);
  }
}

module.exports = { notifications, markRead, markAllRead };
