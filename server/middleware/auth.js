import { Users } from "../db.js";

/**
 * Session-based auth middleware.
 * Reads userId from express-session, attaches user to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await Users.findById(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Invalid session" });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
