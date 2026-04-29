/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app as a serverless handler.
 * This file lives at /api/index.js (Vercel convention).
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import conversationRoutes from "../server/routes/conversation.js";
import messageRoutes from "../server/routes/message.js";
import { errorHandler } from "../server/middleware/errorHandler.js";

const app = express();

// CORS for production
const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, true); // Be permissive in serverless (Vercel same-origin)
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// MongoDB connection (reuse across invocations)
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
}

// Ensure DB is connected before handling requests
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);

// Error handler
app.use(errorHandler);

export default app;
