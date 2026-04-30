/**
 * Simple JSON-file database — no native dependencies, no compilation.
 * Perfect for a single-user / small-team chat app.
 *
 * Data shape:
 * {
 *   users: [{ id, email, name, password_hash, created_at }],
 *   conversations: [{ id, user_id, title, created_at, updated_at }],
 *   messages: [{ id, conversation_id, role, content, timestamp }],
 *   _nextUserId, _nextMessageId
 * }
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "db.json");

// ---- Initialize ----
function loadData() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [],
      conversations: [],
      messages: [],
      _nextUserId: 1,
      _nextMessageId: 1,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

let data = loadData();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toISOString();
}

// ---- User helpers ----
export const Users = {
  create({ email, password, name }) {
    const hash = bcrypt.hashSync(password, 10);
    const user = {
      id: data._nextUserId++,
      email: email.toLowerCase().trim(),
      name: name || "User",
      password_hash: hash,
      created_at: now(),
    };
    data.users.push(user);
    save();
    return user;
  },

  findByEmail(email) {
    if (typeof email !== "string") return null;
    return data.users.find((u) => u.email === email.toLowerCase().trim());
  },

  findById(id) {
    const u = data.users.find((u) => u.id === id);
    if (!u) return null;
    // Return without password hash
    const { password_hash, ...safe } = u;
    return safe;
  },

  verifyPassword(user, password) {
    if (!user?.password_hash || typeof password !== "string") return false;
    return bcrypt.compareSync(password, user.password_hash);
  },
};

// ---- Conversation helpers ----
export const Conversations = {
  create(userId) {
    const conv = {
      id: uuid(),
      user_id: userId,
      title: "New Chat",
      created_at: now(),
      updated_at: now(),
    };
    data.conversations.push(conv);
    save();
    return conv;
  },

  findById(id) {
    return data.conversations.find((c) => c.id === id);
  },

  listByUser(userId) {
    return data.conversations
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  updateTitle(id, title) {
    const c = data.conversations.find((c) => c.id === id);
    if (c) {
      c.title = title;
      save();
    }
  },

  touch(id) {
    const c = data.conversations.find((c) => c.id === id);
    if (c) {
      c.updated_at = now();
      save();
    }
  },

  delete(id) {
    data.conversations = data.conversations.filter((c) => c.id !== id);
    data.messages = data.messages.filter((m) => m.conversation_id !== id);
    save();
  },
};

// ---- Message helpers ----
export const Messages = {
  create({ conversationId, role, content, attachments }) {
    const msg = {
      id: data._nextMessageId++,
      conversation_id: conversationId,
      role,
      content,
      attachments: attachments || [],
      feedback: null,
      timestamp: now(),
    };
    data.messages.push(msg);
    Conversations.touch(conversationId);
    save();
    return msg;
  },

  listByConversation(conversationId) {
    return data.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => a.id - b.id);
  },

  count(conversationId) {
    return data.messages.filter((m) => m.conversation_id === conversationId).length;
  },

  // Returns { ok: true } on success, or { ok: false, status } on failure.
  // Verifies the message belongs to a conversation owned by userId.
  setFeedback(messageId, userId, feedback) {
    const msg = data.messages.find((m) => m.id === messageId);
    if (!msg) return { ok: false, status: 404 };
    const conv = data.conversations.find((c) => c.id === msg.conversation_id);
    if (!conv || conv.user_id !== userId) return { ok: false, status: 403 };
    msg.feedback = feedback;
    save();
    return { ok: true };
  },
};
