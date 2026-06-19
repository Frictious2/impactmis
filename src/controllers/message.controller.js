const messageService = require("../services/message.service");

async function inbox(req, res, next) {
  try {
    const messages = await messageService.listInbox(req.currentUser.tenant_id, req.currentUser.id);
    const layout = req.currentUser.role === "Donor" ? "layouts/donor-layout" : "layouts/tenant-layout";
    return res.render(layout, {
      pageTitle: "Inbox",
      contentPartial: "../pages/tenant/messages/inbox",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Messages" }],
      messages
    });
  } catch (error) {
    return next(error);
  }
}

async function sent(req, res, next) {
  try {
    const messages = await messageService.listSent(req.currentUser.tenant_id, req.currentUser.id);
    const layout = req.currentUser.role === "Donor" ? "layouts/donor-layout" : "layouts/tenant-layout";
    return res.render(layout, {
      pageTitle: "Sent Messages",
      contentPartial: "../pages/tenant/messages/sent",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Messages", href: "/messages" }, { label: "Sent" }],
      messages
    });
  } catch (error) {
    return next(error);
  }
}

async function showCreate(req, res, next) {
  try {
    if (req.currentUser.role === "Donor") {
      req.flash("error", "Donor users cannot compose messages in this phase.");
      return res.redirect("/messages");
    }
    const recipients = await messageService.listAllowedRecipients(req.currentUser.tenant_id, req.currentUser);
    return res.render("layouts/tenant-layout", {
      pageTitle: "Compose Message",
      contentPartial: "../pages/tenant/messages/create",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Messages", href: "/messages" }, { label: "Compose" }],
      recipients,
      formData: { recipient_user_id: "", subject: "", body: "" },
      validationErrors: []
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (req.currentUser.role === "Donor") {
      req.flash("error", "Donor users cannot compose messages in this phase.");
      return res.redirect("/messages");
    }
    const recipients = await messageService.listAllowedRecipients(req.currentUser.tenant_id, req.currentUser);
    const errors = [];
    if (!req.body.recipient_user_id) errors.push({ msg: "Recipient is required." });
    if (!String(req.body.subject || "").trim()) errors.push({ msg: "Subject is required." });
    if (!String(req.body.body || "").trim()) errors.push({ msg: "Message body is required." });
    if (errors.length) {
      return res.status(422).render("layouts/tenant-layout", {
        pageTitle: "Compose Message",
        contentPartial: "../pages/tenant/messages/create",
        breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Messages", href: "/messages" }, { label: "Compose" }],
        recipients,
        formData: req.body,
        validationErrors: errors
      });
    }
    await messageService.createMessage(
      req.currentUser.tenant_id,
      req.currentUser.id,
      req.body.recipient_user_id,
      req.body,
      req.ip
    );
    req.flash("success", "Message sent.");
    return res.redirect("/messages/sent");
  } catch (error) {
    if (error.statusCode) {
      req.flash("error", error.message);
      return res.redirect("/messages/create");
    }
    return next(error);
  }
}

async function detail(req, res, next) {
  try {
    const message = await messageService.readMessage(req.currentUser.tenant_id, req.currentUser.id, req.params.id, req.ip);
    if (!message) {
      return res.status(404).render("pages/errors/404", { pageTitle: "Message Not Found" });
    }
    const layout = req.currentUser.role === "Donor" ? "layouts/donor-layout" : "layouts/tenant-layout";
    return res.render(layout, {
      pageTitle: message.subject,
      contentPartial: "../pages/tenant/messages/show",
      breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Messages", href: "/messages" }, { label: message.subject }],
      message
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    await messageService.markMessageRead(req.currentUser.tenant_id, req.currentUser.id, req.params.id, req.ip);
    req.flash("success", "Message marked as read.");
    return res.redirect(`/messages/${req.params.id}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { inbox, sent, showCreate, create, detail, markRead };
