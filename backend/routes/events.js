const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();
const categories = ["Technology", "Workshop", "Cultural", "Sports", "Career", "Other"];

async function fetchEvents(id) {
  let query = supabase.from("events").select("id,title,description,category,venue,starts_at,capacity,created_at,registrations(id,status)");
  if (id) query = query.eq("id", id);
  query = query.order("starts_at", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(e => {
    const registered = (e.registrations || []).filter(r => r.status === "registered").length;
    const { registrations, ...event } = e;
    return { ...event, registration_count: registered };
  });
}
function validateEvent(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = body.category;
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const starts_at = body.starts_at;
  const capacity = Number(body.capacity);
  if (title.length < 3 || title.length > 120) return "Title must be 3–120 characters.";
  if (description.length < 5 || description.length > 2000) return "Description must be 5–2000 characters.";
  if (!categories.includes(category)) return "Choose a valid event category.";
  if (venue.length < 2 || venue.length > 160) return "Venue must be 2–160 characters.";
  if (typeof starts_at !== "string" || Number.isNaN(Date.parse(starts_at)) || new Date(starts_at).getTime() <= Date.now()) return "Choose a valid future date and time.";
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return "Capacity must be a whole number between 1 and 10,000.";
  return null;
}
function eventValues(body) { return { title: body.title.trim(), description: body.description.trim(), category: body.category, venue: body.venue.trim(), starts_at: new Date(body.starts_at).toISOString(), capacity: Number(body.capacity) }; }

router.get("/", async (req, res, next) => {
  try {
    const events = await fetchEvents();
    res.json({ events: events.filter(e => new Date(e.starts_at).getTime() > Date.now()) });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const issue = validateEvent(req.body); if (issue) return res.status(400).json({ error: issue });
    const { data, error } = await supabase.from("events").insert(eventValues(req.body)).select("id").single();
    if (error) return next(error);
    const events = await fetchEvents(data.id);
    res.status(201).json({ event: events[0] });
  } catch (error) { next(error); }
});
router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const issue = validateEvent(req.body); if (issue) return res.status(400).json({ error: issue });
    const { data: existing, error: readError } = await supabase.from("events").select("id,capacity,registrations(id,status)").eq("id", req.params.id).maybeSingle();
    if (readError) return next(readError);
    if (!existing) return res.status(404).json({ error: "Event not found." });
    const registered = (existing.registrations || []).filter(r => r.status === "registered").length;
    if (Number(req.body.capacity) < registered) return res.status(409).json({ error: `Capacity cannot be less than the ${registered} current registrations.` });
    const { error } = await supabase.from("events").update(eventValues(req.body)).eq("id", req.params.id);
    if (error?.code === "23514") return res.status(400).json({ error: "The event details violate a database rule." });
    if (error) return next(error);
    res.json({ event: (await fetchEvents(req.params.id))[0] });
  } catch (error) { next(error); }
});
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("events").delete().eq("id", req.params.id).select("id").maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: "Event not found." });
    res.json({ message: "Event deleted." });
  } catch (error) { next(error); }
});
module.exports = router;
