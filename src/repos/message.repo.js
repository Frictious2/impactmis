const pool = require("../db/pool");

async function listInbox(tenantId, userId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT m.*, sender.full_name AS sender_name, sender.role AS sender_role
      FROM messages m
      INNER JOIN users sender ON sender.id = m.sender_user_id
      WHERE m.tenant_id = ?
        AND m.recipient_user_id = ?
      ORDER BY m.created_at DESC, m.id DESC
    `,
    [tenantId, userId]
  );
  return rows;
}

async function listSent(tenantId, userId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT m.*, recipient.full_name AS recipient_name, recipient.role AS recipient_role
      FROM messages m
      INNER JOIN users recipient ON recipient.id = m.recipient_user_id
      WHERE m.tenant_id = ?
        AND m.sender_user_id = ?
      ORDER BY m.created_at DESC, m.id DESC
    `,
    [tenantId, userId]
  );
  return rows;
}

async function createMessage(tenantId, senderUserId, recipientUserId, payload, db = pool) {
  const [result] = await db.query(
    `
      INSERT INTO messages (tenant_id, sender_user_id, recipient_user_id, subject, body)
      VALUES (?, ?, ?, ?, ?)
    `,
    [tenantId, senderUserId, recipientUserId, payload.subject, payload.body]
  );
  return result.insertId;
}

async function readMessage(tenantId, userId, messageId, db = pool) {
  const [rows] = await db.query(
    `
      SELECT m.*, sender.full_name AS sender_name, recipient.full_name AS recipient_name
      FROM messages m
      INNER JOIN users sender ON sender.id = m.sender_user_id
      INNER JOIN users recipient ON recipient.id = m.recipient_user_id
      WHERE m.tenant_id = ?
        AND m.id = ?
        AND (m.sender_user_id = ? OR m.recipient_user_id = ?)
      LIMIT 1
    `,
    [tenantId, messageId, userId, userId]
  );
  return rows[0] || null;
}

async function markMessageRead(tenantId, userId, messageId, db = pool) {
  await db.query(
    `
      UPDATE messages
      SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE tenant_id = ?
        AND id = ?
        AND recipient_user_id = ?
    `,
    [tenantId, messageId, userId]
  );
}

async function countUnreadMessages(tenantId, userId, db = pool) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM messages WHERE tenant_id = ? AND recipient_user_id = ? AND is_read = 0",
    [tenantId, userId]
  );
  return Number(row.total || 0);
}

module.exports = {
  listInbox,
  listSent,
  createMessage,
  readMessage,
  markMessageRead,
  countUnreadMessages
};
