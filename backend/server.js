require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const registrationRoutes = require("./routes/registrations");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random secret at least 32 characters long in backend/.env");
  process.exit(1);
}
const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"]
}}}));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many authentication attempts. Please wait and try again." } }));
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "CampusEvents API" }));
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api", registrationRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, req, res, next) => {
  console.error("Request failed:", err?.message || "Unknown error");
  if (res.headersSent) return next(err);
  if (err?.code === "23505") return res.status(409).json({ error: "That record already exists." });
  if (err?.code === "23503") return res.status(400).json({ error: "This action references a record that does not exist." });
  return res.status(500).json({ error: "The server could not complete this request. Check the server configuration and try again." });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`CampusEvents is running at http://localhost:${port}`));
