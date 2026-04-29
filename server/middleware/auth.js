import { Users } from "../db.js";

/**
 * Session-based auth middleware.
 * Reads userId from express-session, attaches user to req.user.
 */
export function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = Users.findById(userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Invalid session" });
  }
  req.user = user;
  next();
}
