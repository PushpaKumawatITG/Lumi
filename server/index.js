import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversation.js";
import messageRoutes from "./routes/message.js";
import { errorHandler } from "./middleware/errorHandler.js";
import "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Trust the platform proxy (Render, Heroku, Vercel, etc.) so secure cookies work
if (isProduction) app.set("trust proxy", 1);

// CORS — only needed in dev where Vite serves on a different port
if (!isProduction) {
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    })
  );
}

app.use(express.json({ limit: "20mb" }));

// Session middleware (cookie-based)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "lumi-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,                  // require HTTPS in production
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,      // 30 days
    },
  })
);

// ---- API routes ----
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);

// ---- Serve React build in production (single-service deployment) ----
if (isProduction) {
  const clientDistPath = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDistPath));

  // SPA fallback — any non-API route returns index.html so React Router works
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n  Lumi running on port ${PORT}\n`);
});

export default app;
