const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../supabase");
const { requireAuth, setSessionCookie, clearSessionCookie } = require("../middleware/auth");
const router = express.Router();

function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
function validEmail(email) { return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

router.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be 8–128 characters long." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from("app_users").insert({ name, email, password_hash, role: "student" }).select("id,name,email,role").single();
    if (error?.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
    if (error) return next(error);
    setSessionCookie(res, data);
    return res.status(201).json({ user: publicUser(data) });
  } catch (error) { next(error); }
});
router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== "string" || password.length > 128) return res.status(400).json({ error: "Enter a valid email and password." });
    const { data: user, error } = await supabase.from("app_users").select("id,name,email,role,password_hash").eq("email", email).maybeSingle();
    if (error) return next(error);
    const valid = user && await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Email or password is incorrect." });
    setSessionCookie(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
router.post("/logout", (req, res) => { clearSessionCookie(res); res.json({ message: "Logged out." }); });
module.exports = router;
