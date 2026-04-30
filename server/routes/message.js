import { Router } from "express";
import Groq from "groq-sdk";
import { Conversations, Messages } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Two models: vision-capable for images, fast text for plain chat
const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Lumi, a warm, helpful, and intelligent AI companion. " +
    "Your name comes from 'lumen' — a unit of light — because you bring clarity to people's questions. " +
    "You're knowledgeable, concise, and friendly. " +
    "Format responses using Markdown when appropriate (code blocks, lists, bold). " +
    "If you don't know something, say so honestly.",
};

/**
 * POST /api/message/:id/feedback — thumbs up/down on an assistant message
 * Body: { feedback: "up" | "down" | null }
 */
router.post("/:id/feedback", (req, res, next) => {
  try {
    const { feedback } = req.body || {};
    if (feedback !== "up" && feedback !== "down" && feedback !== null) {
      return res.status(400).json({ error: "feedback must be 'up', 'down', or null" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid message id" });
    }
    const result = Messages.setFeedback(id, req.user.id, feedback);
    if (!result.ok) return res.status(result.status).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/message/:conversationId — fetch all messages
 */
router.get("/:conversationId", (req, res, next) => {
  try {
    const conv = Conversations.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.user_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });

    const msgs = Messages.listByConversation(req.params.conversationId);
    res.json(msgs);
  } catch (err) {
    next(err);
  }
});

/**
 * Build the content payload for a single user turn.
 * - With images: returns array format with text + image_url parts
 * - Without images: returns plain string
 * - Text file attachments are inlined into the text content
 */
function buildUserContent(text, attachments = []) {
  const images = attachments.filter((a) => a.type === "image");
  const textFiles = attachments.filter((a) => a.type === "text");

  // Inline text file contents
  let combined = text;
  if (textFiles.length > 0) {
    const fileSections = textFiles
      .map(
        (f) =>
          `[Attached file: ${f.name}]\n\`\`\`\n${f.content || ""}\n\`\`\``
      )
      .join("\n\n");
    combined = `${fileSections}\n\n${text || "(see attached files)"}`;
  }

  // No images → plain string
  if (images.length === 0) return combined;

  // With images → multimodal array format
  const parts = [{ type: "text", text: combined || "What's in this image?" }];
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: img.data }, // base64 data URL or http(s)
    });
  }
  return parts;
}

/**
 * POST /api/message/send
 *
 * Body: {
 *   conversationId,
 *   content,             // text from user
 *   history,             // [{ role, content, attachments? }, ...]
 *   attachments          // [{ type: "image"|"text", name, data?, content? }]
 * }
 */
router.post("/send", async (req, res, next) => {
  try {
    const { conversationId, content, history, attachments = [] } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }
    if (!content && attachments.length === 0) {
      return res.status(400).json({ error: "Message or attachment required" });
    }

    const conv = Conversations.findById(conversationId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.user_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });

    // Save user message with attachments (we keep image data URLs in DB so history renders correctly)
    Messages.create({
      conversationId,
      role: "user",
      content: content || "",
      attachments,
    });

    // Auto-title from first message
    const messageCount = Messages.count(conversationId);
    if (messageCount === 1) {
      const titleSource =
        content?.trim() ||
        attachments.map((a) => a.name).filter(Boolean).join(", ") ||
        "New Chat";
      const words = titleSource.split(/\s+/);
      const title = words.slice(0, 7).join(" ") + (words.length > 7 ? "..." : "");
      Conversations.updateTitle(conversationId, title.slice(0, 60));
    }

    // Detect if any message in this turn or recent history has images
    const currentHasImage = attachments.some((a) => a.type === "image");
    const historyHasImage =
      history?.some(
        (m) => Array.isArray(m.attachments) && m.attachments.some((a) => a.type === "image")
      ) || false;
    const useVision = currentHasImage || historyHasImage;
    const model = useVision ? VISION_MODEL : TEXT_MODEL;

    // Build messages array for Groq
    const messages = [SYSTEM_PROMPT];
    if (Array.isArray(history)) {
      const recent = history.slice(-20);
      for (const msg of recent) {
        if (!msg.role || (!msg.content && !msg.attachments?.length)) continue;
        if (msg.role === "user") {
          messages.push({
            role: "user",
            content: buildUserContent(msg.content || "", msg.attachments || []),
          });
        } else if (msg.role === "assistant") {
          messages.push({ role: "assistant", content: msg.content || "" });
        }
      }
    }
    messages.push({
      role: "user",
      content: buildUserContent(content || "", attachments),
    });

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let fullResponse = "";

    try {
      const stream = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } catch (groqErr) {
      const errMsg =
        groqErr.status === 429
          ? "Rate limit exceeded. Please wait a moment and try again."
          : groqErr.status === 401
            ? "Invalid Groq API key. Please check your configuration."
            : groqErr.status === 400
              ? `Request error: ${groqErr.message}`
              : `AI error: ${groqErr.message}`;

      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Save assistant message
    const assistantMsg = Messages.create({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMsg.id })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      next(err);
    }
  }
});

export default router;
