/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app as a serverless handler.
 * This file lives at /api/index.js (Vercel convention).
 */
import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import authRoutes from "../server/routes/auth.js";
import conversationRoutes from "../server/routes/conversation.js";
import messageRoutes from "../server/routes/message.js";
import { errorHandler } from "../server/middleware/errorHandler.js";
import { connectDB } from "../server/db.js";

const app = express();

// Vercel sits behind a proxy; required for secure cookies + sameSite=none
app.set("trust proxy", 1);

app.use(express.json({ limit: "20mb" }));

// Session middleware — stored in Mongo so cookies survive across serverless invocations
app.use(
  session({
    secret: process.env.SESSION_SECRET || "lumi-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 30 * 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

// Warm up the Mongo connection on cold start (cached across invocations)
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);

app.use(errorHandler);

export default app;
