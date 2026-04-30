/**
 * MongoDB-backed data layer (Mongoose).
 *
 * Same export surface (Users / Conversations / Messages) as the previous
 * fs-based implementation, but every method is now async. Routes that call
 * these helpers must use `await`.
 *
 * The connection is cached across serverless invocations so Vercel cold-
 * starts don't reconnect on every request.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dns from "dns";

// Some home/ISP DNS servers (notably in IN/PK/Windows) refuse SRV record
// queries, which breaks MongoDB Atlas's `mongodb+srv://` connection format.
// Force Node to use public DNS so the SRV lookup always works. Harmless
// in cloud environments where DNS already works.
dns.setServers(["8.8.8.8", "1.1.1.1", ...dns.getServers()]);

// ---- Connection (cached across invocations) ----
let connectionPromise = null;

export function connectDB() {
  if (connectionPromise) return connectionPromise;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  return connectionPromise;
}

// Ensure DB is ready before any helper runs (idempotent).
async function ready() {
  if (mongoose.connection.readyState !== 1) await connectDB();
}

// ---- Schemas ----
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "User" },
    password_hash: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const conversationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, default: "New Chat" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const attachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "text"], required: true },
    name: String,
    data: String, // for images: base64 data URL
    content: String, // for text files: file contents
    size: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, default: "" },
  attachments: { type: [attachmentSchema], default: [] },
  feedback: { type: String, enum: ["up", "down", null], default: null },
  timestamp: { type: Date, default: Date.now },
});

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
const ConversationModel =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
const MessageModel = mongoose.models.Message || mongoose.model("Message", messageSchema);

// ---- Serializers (return plain objects with `id`, hide internals) ----
function userOut(doc, { withHash = false } = {}) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  const out = { id: String(o._id), email: o.email, name: o.name, created_at: o.created_at };
  if (withHash) out.password_hash = o.password_hash;
  return out;
}
function conversationOut(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    user_id: String(o.user_id),
    title: o.title,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}
function messageOut(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    conversation_id: String(o.conversation_id),
    role: o.role,
    content: o.content,
    attachments: o.attachments || [],
    feedback: o.feedback ?? null,
    timestamp: o.timestamp,
  };
}

function isValidId(id) {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

// ---- User helpers ----
export const Users = {
  async create({ email, password, name }) {
    await ready();
    const hash = bcrypt.hashSync(password, 10);
    const doc = await UserModel.create({
      email: String(email).toLowerCase().trim(),
      name: name || "User",
      password_hash: hash,
    });
    return userOut(doc);
  },

  async findByEmail(email) {
    if (typeof email !== "string") return null;
    await ready();
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() });
    return doc ? userOut(doc, { withHash: true }) : null;
  },

  async findById(id) {
    if (!isValidId(id)) return null;
    await ready();
    const doc = await UserModel.findById(id);
    return doc ? userOut(doc) : null;
  },

  verifyPassword(user, password) {
    if (!user?.password_hash || typeof password !== "string") return false;
    return bcrypt.compareSync(password, user.password_hash);
  },
};

// ---- Conversation helpers ----
export const Conversations = {
  async create(userId) {
    await ready();
    const doc = await ConversationModel.create({ user_id: userId, title: "New Chat" });
    return conversationOut(doc);
  },

  async findById(id) {
    if (!isValidId(id)) return null;
    await ready();
    const doc = await ConversationModel.findById(id);
    return doc ? conversationOut(doc) : null;
  },

  async listByUser(userId) {
    await ready();
    const docs = await ConversationModel.find({ user_id: userId }).sort({ updated_at: -1 });
    return docs.map(conversationOut);
  },

  async updateTitle(id, title) {
    if (!isValidId(id)) return;
    await ready();
    await ConversationModel.updateOne({ _id: id }, { $set: { title } });
  },

  async touch(id) {
    if (!isValidId(id)) return;
    await ready();
    await ConversationModel.updateOne({ _id: id }, { $set: { updated_at: new Date() } });
  },

  async delete(id) {
    if (!isValidId(id)) return;
    await ready();
    await ConversationModel.deleteOne({ _id: id });
    await MessageModel.deleteMany({ conversation_id: id });
  },
};

// ---- Message helpers ----
export const Messages = {
  async create({ conversationId, role, content, attachments }) {
    await ready();
    const doc = await MessageModel.create({
      conversation_id: conversationId,
      role,
      content: content ?? "",
      attachments: attachments || [],
    });
    await Conversations.touch(conversationId);
    return messageOut(doc);
  },

  async listByConversation(conversationId) {
    if (!isValidId(conversationId)) return [];
    await ready();
    const docs = await MessageModel.find({ conversation_id: conversationId }).sort({ timestamp: 1 });
    return docs.map(messageOut);
  },

  async count(conversationId) {
    if (!isValidId(conversationId)) return 0;
    await ready();
    return MessageModel.countDocuments({ conversation_id: conversationId });
  },

  // Returns { ok: true } on success, or { ok: false, status } on failure.
  async setFeedback(messageId, userId, feedback) {
    if (!isValidId(messageId)) return { ok: false, status: 404 };
    await ready();
    const msg = await MessageModel.findById(messageId);
    if (!msg) return { ok: false, status: 404 };
    const conv = await ConversationModel.findById(msg.conversation_id);
    if (!conv || String(conv.user_id) !== String(userId)) return { ok: false, status: 403 };
    msg.feedback = feedback;
    await msg.save();
    return { ok: true };
  },
};
