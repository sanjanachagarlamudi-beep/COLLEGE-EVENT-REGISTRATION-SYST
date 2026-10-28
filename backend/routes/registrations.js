const express = require("express");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("registrations")
      .select("id,event_id,status,created_at,event:events(id,title,description,category,venue,starts_at,capacity)")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) return next(error);
    res.json({ registrations: (data || []).filter(r => r.event).map(r => ({ ...r, event: r.event })) });
  } catch (error) { next(error); }
});
router.post("/events/:id/register", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.rpc("register_for_event", { p_event_id: req.params.id, p_user_id: req.user.id });
    if (error?.code === "P0002") return res.status(404).json({ error: "Event not found." });
    if (error?.message?.includes("EVENT_FULL")) return res.status(409).json({ error: "Sorry, this event is full." });
    if (error?.message?.includes("EVENT_PAST")) return res.status(409).json({ error: "Registration is closed because the event has started." });
    if (error?.message?.includes("ALREADY_REGISTERED")) return res.status(409).json({ error: "You are already registered for this event." });
    if (error) return next(error);
    res.status(201).json({ registration: data });
  } catch (error) { next(error); }
});
router.delete("/registrations/:id", requireAuth, async (req, res, next) => {
  try {
    const { data: registration, error: readError } = await supabase.from("registrations").select("id,user_id,event_id,status,event:events(starts_at)").eq("id", req.params.id).maybeSingle();
    if (readError) return next(readError);
    if (!registration) return res.status(404).json({ error: "Registration not found." });
    if (registration.user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "You can only cancel your own registration." });
    if (registration.status !== "registered") return res.status(409).json({ error: "This registration is already cancelled." });
    if (new Date(registration.event.starts_at).getTime() <= Date.now()) return res.status(409).json({ error: "Registration cannot be cancelled after the event starts." });
    const { error } = await supabase.from("registrations").update({ status: "cancelled" }).eq("id", registration.id);
    if (error) return next(error);
    res.json({ message: "Registration cancelled." });
  } catch (error) { next(error); }
});
module.exports = router;
