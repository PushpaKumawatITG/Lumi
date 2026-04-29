import { Router } from "express";
import { Conversations, Messages } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * POST /api/conversation/new — create new conversation
 */
router.post("/new", (req, res, next) => {
  try {
    const conv = Conversations.create(req.user.id);
    res.status(201).json(conv);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/conversation/list — fetch all conversations for current user
 * (Replaces /api/conversation/:userId — userId now comes from session)
 */
router.get("/list", (req, res, next) => {
  try {
    const list = Conversations.listByUser(req.user.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/conversation/:id — delete a conversation + its messages
 */
router.delete("/:id", (req, res, next) => {
  try {
    const conv = Conversations.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.user_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });

    Conversations.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/conversation/:id/rename — rename a conversation
 */
router.post("/:id/rename", (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });

    const conv = Conversations.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.user_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });

    Conversations.updateTitle(req.params.id, title.trim().slice(0, 60));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
