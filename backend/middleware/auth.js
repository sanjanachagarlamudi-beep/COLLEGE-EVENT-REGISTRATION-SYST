const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

const cookieName = "campus_session";
function signSession(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d", issuer: "campus-events" });
}
function setSessionCookie(res, user) {
  res.cookie(cookieName, signSession(user), {
    httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, path: "/"
  });
}
function clearSessionCookie(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", path: "/" });
}
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[cookieName];
    if (!token) return res.status(401).json({ error: "Please log in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "campus-events" });
    const { data: user, error } = await supabase.from("app_users").select("id,name,email,role").eq("id", payload.sub).maybeSingle();
    if (error || !user) { clearSessionCookie(res); return res.status(401).json({ error: "Your session is no longer valid. Please log in again." }); }
    req.user = user;
    next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
  next();
}
module.exports = { requireAuth, requireAdmin, setSessionCookie, clearSessionCookie };
