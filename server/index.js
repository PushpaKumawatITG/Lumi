import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversation.js";
import messageRoutes from "./routes/message.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { connectDB } from "./db.js";

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

// Session middleware (cookies signed and stored in MongoDB so they survive restarts/serverless)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "lumi-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 30 * 24 * 60 * 60, // 30 days, matches cookie maxAge
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
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

// Eagerly connect to Mongo at startup so the first request isn't slow.
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Lumi running on port ${PORT}\n`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

export default app;
