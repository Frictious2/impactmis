const messageRepo = require("../repos/message.repo");
const userRepo = require("../repos/user.repo");
const auditLogRepo = require("../repos/audit-log.repo");

const MANAGER_ROLES = new Set(["Tenant Admin", "HR Manager", "Finance Manager", "Project Manager"]);
const LIMITED_SENDER_ROLES = new Set(["Staff", "Volunteer"]);
const LIMITED_RECIPIENT_ROLES = new Set(["Tenant Admin", "HR Manager", "Finance Manager", "Project Manager"]);

async function listInbox(tenantId, userId) {
  return messageRepo.listInbox(tenantId, userId);
}

async function listSent(tenantId, userId) {
  return messageRepo.listSent(tenantId, userId);
}

function canSenderMessage(sender, recipient) {
  if (!sender || !recipient || sender.role === "Donor") {
    return false;
  }
  if (MANAGER_ROLES.has(sender.role)) {
    return true;
  }
  if (LIMITED_SENDER_ROLES.has(sender.role)) {
    return LIMITED_RECIPIENT_ROLES.has(recipient.role);
  }
  return false;
}

async function listAllowedRecipients(tenantId, senderUser) {
  const users = await userRepo.listActiveByTenantId(tenantId);
  return users.filter((user) => user.id !== senderUser.id && canSenderMessage(senderUser, user));
}

async function createMessage(tenantId, senderUserId, recipientUserId, payload, ipAddress) {
  const [sender, recipient] = await Promise.all([
    userRepo.findByIdForTenant(senderUserId, tenantId),
    userRepo.findByIdForTenant(recipientUserId, tenantId)
  ]);
  if (!canSenderMessage(sender, recipient)) {
    const error = new Error("You are not allowed to message this recipient.");
    error.statusCode = 403;
    throw error;
  }
  const messageId = await messageRepo.createMessage(tenantId, senderUserId, recipientUserId, {
    subject: String(payload.subject || "").trim(),
    body: String(payload.body || "").trim()
  });
  await auditLogRepo.create({
    tenant_id: tenantId,
    user_id: senderUserId,
    action: "message.sent",
    entity_type: "message",
    entity_id: String(messageId),
    metadata_json: { message_id: messageId, recipient_user_id: Number(recipientUserId) },
    ip_address: ipAddress
  });
  return messageId;
}

async function readMessage(tenantId, userId, messageId, ipAddress) {
  const message = await messageRepo.readMessage(tenantId, userId, messageId);
  if (!message) {
    return null;
  }
  if (Number(message.recipient_user_id) === Number(userId) && !message.is_read) {
    await messageRepo.markMessageRead(tenantId, userId, messageId);
    await auditLogRepo.create({
      tenant_id: tenantId,
      user_id: userId,
      action: "message.read",
      entity_type: "message",
      entity_id: String(messageId),
      metadata_json: { message_id: Number(messageId), recipient_user_id: userId },
      ip_address: ipAddress
    });
    return messageRepo.readMessage(tenantId, userId, messageId);
  }
  return message;
}

async function markMessageRead(tenantId, userId, messageId, ipAddress) {
  await messageRepo.markMessageRead(tenantId, userId, messageId);
  await auditLogRepo.create({
    tenant_id: tenantId,
    user_id: userId,
    action: "message.read",
    entity_type: "message",
    entity_id: String(messageId),
    metadata_json: { message_id: Number(messageId), recipient_user_id: userId },
    ip_address: ipAddress
  });
}

async function countUnreadMessages(tenantId, userId) {
  return messageRepo.countUnreadMessages(tenantId, userId);
}

module.exports = {
  listInbox,
  listSent,
  listAllowedRecipients,
  createMessage,
  readMessage,
  markMessageRead,
  countUnreadMessages,
  canSenderMessage
};
