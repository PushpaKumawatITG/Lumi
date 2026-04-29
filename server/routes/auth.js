import { Router } from "express";
import { Users } from "../db.js";

const router = Router();

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 */
router.post("/register", (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (Users.findByEmail(email)) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = Users.create({ email, password, name });
    req.session.userId = user.id;
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = Users.findByEmail(email);
    if (!user || !Users.verifyPassword(user, password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.userId = user.id;
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me — current user
 */
router.get("/me", (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const user = Users.findById(userId);
  if (!user) return res.status(401).json({ error: "Invalid session" });
  res.json({ user });
});

export default router;
