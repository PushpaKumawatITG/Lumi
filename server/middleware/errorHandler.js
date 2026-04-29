/**
 * Global error handling middleware.
 * Catches unhandled errors and returns a clean JSON response.
 */
export function errorHandler(err, req, res, _next) {
  console.error("Server error:", err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
}
