const $ = (selector) => document.querySelector(selector);
const state = { user: null, events: [], registrations: [], authMode: "login" };
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function escapeText(value) { return String(value ?? ""); }
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function setNotice(message) { const n = $("#notice"); n.textContent = message; n.classList.toggle("hidden", !message); }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to be announced" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function dateParts(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? { day: "--", month: "---" } : { day: d.toLocaleDateString("en-IN", { day: "2-digit" }), month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase() };
}
function categoryClass(category) { return String(category || "other").toLowerCase().replace(/[^a-z]/g, ""); }
function categorySymbol(category) {
  return ({ Technology: "⌘", Workshop: "✳", Cultural: "✦", Sports: "↗", Career: "◎", Other: "✺" })[category] || "✺";
}
function updateAccountUI() {
  const loggedIn = Boolean(state.user);
  $("#loginOpen").classList.toggle("hidden", loggedIn);
  $("#registerOpen").classList.toggle("hidden", loggedIn);
  $("#logoutButton").classList.toggle("hidden", !loggedIn);
  $("#myRegistrationsNav").classList.toggle("hidden", !loggedIn);
  $("#userLabel").textContent = loggedIn ? state.user.name : "";
  $("#adminSection").classList.toggle("hidden", !loggedIn || state.user.role !== "admin");
  $("#registrationsSection").classList.toggle("hidden", !loggedIn);
  if (loggedIn && state.user.role === "admin") $("#myRegistrationsNav").classList.add("hidden");
}
function eventCard(event) {
  const parts = dateParts(event.starts_at);
  const remaining = Math.max(0, event.capacity - event.registration_count);
  const isRegistered = state.registrations.some(r => r.event_id === event.id && r.status === "registered");
  const isPast = new Date(event.starts_at).getTime() <= Date.now();
  const unavailable = remaining < 1 || isPast;
  const actionLabel = isRegistered ? "Registered ✓" : isPast ? "Event ended" : remaining < 1 ? "Full" : state.user ? "Register →" : "Log in to join";
  const card = document.createElement("article"); card.className = "event-card";
  const cover = document.createElement("div"); cover.className = `event-cover cover-${categoryClass(event.category)}`;
  const pill = document.createElement("span"); pill.className = "category-pill"; pill.textContent = event.category;
  const symbol = document.createElement("span"); symbol.className = "event-symbol"; symbol.textContent = categorySymbol(event.category);
  const date = document.createElement("div"); date.className = "event-date-tile";
  const day = document.createElement("strong"); day.textContent = parts.day;
  const month = document.createElement("span"); month.textContent = parts.month;
  date.append(day, month); cover.append(pill, symbol, date);
  const body = document.createElement("div"); body.className = "event-card-body";
  const title = document.createElement("h3"); title.textContent = event.title;
  const description = document.createElement("p"); description.className = "event-description"; description.textContent = event.description;
  const meta = document.createElement("div"); meta.className = "event-meta";
  for (const [symbolText, text] of [["◷", formatDate(event.starts_at)], ["⌖", event.venue]]) {
    const line = document.createElement("span"); const icon = document.createElement("b"); icon.textContent = symbolText;
    const value = document.createElement("span"); value.textContent = text; line.append(icon, value); meta.append(line);
  }
  const footer = document.createElement("div"); footer.className = "event-footer";
  const spots = document.createElement("span"); spots.className = "spots"; spots.textContent = `${remaining} spots left`;
  const button = document.createElement("button"); button.className = `button ${isRegistered || unavailable ? "button-ghost" : "button-primary"}`; button.textContent = actionLabel;
  button.disabled = isRegistered || unavailable; button.addEventListener("click", () => handleRegister(event.id));
  footer.append(spots, button); body.append(title, description, meta, footer); card.append(cover, body);
  return card;
}
function renderEvents() {
  const grid = $("#eventsGrid"); grid.replaceChildren();
  const query = $("#searchInput").value.trim().toLowerCase(); const category = $("#categoryFilter").value;
  const visible = state.events.filter(e => (!category || e.category === category) && (!query || `${e.title} ${e.description} ${e.venue} ${e.category}`.toLowerCase().includes(query)));
  $("#eventCount").textContent = state.events.filter(e => new Date(e.starts_at).getTime() > Date.now()).length;
  visible.forEach(event => grid.append(eventCard(event)));
  $("#emptyState").classList.toggle("hidden", visible.length !== 0);
}
function renderRegistrations() {
  const list = $("#registrationsList"); list.replaceChildren();
  if (!state.registrations.length) {
    const empty = document.createElement("div"); empty.className = "empty-state";
    const heading = document.createElement("h3"); heading.textContent = "Nothing on your calendar yet";
    const p = document.createElement("p"); p.textContent = "Explore events above and register for something you like.";
    empty.append(heading, p); list.append(empty); return;
  }
  state.registrations.forEach(reg => {
    const row = document.createElement("div"); row.className = "registration-row";
    const details = document.createElement("div"); const title = document.createElement("h3"); title.textContent = reg.event.title;
    const info = document.createElement("p"); info.textContent = `${formatDate(reg.event.starts_at)} · ${reg.event.venue}`;
    details.append(title, info);
    const actions = document.createElement("div"); actions.className = "registration-actions";
    const status = document.createElement("span"); status.className = `status-pill ${reg.status === "cancelled" ? "status-cancelled" : ""}`; status.textContent = reg.status === "registered" ? "Confirmed" : "Cancelled";
    actions.append(status);
    if (reg.status === "registered" && new Date(reg.event.starts_at).getTime() > Date.now()) {
      const cancel = document.createElement("button"); cancel.className = "small-button"; cancel.textContent = "Cancel registration";
      cancel.addEventListener("click", () => cancelRegistration(reg.id)); actions.append(cancel);
    }
    row.append(details, actions); list.append(row);
  });
}
function renderAdminEvents() {
  const list = $("#adminEventsList"); list.replaceChildren();
  if (!state.events.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "No events created yet."; list.append(p); return; }
  state.events.forEach(event => {
    const row = document.createElement("div"); row.className = "admin-event-row";
    const details = document.createElement("div"); const title = document.createElement("strong"); title.textContent = event.title;
    const sub = document.createElement("span"); sub.textContent = `${formatDate(event.starts_at)} · ${event.registration_count}/${event.capacity} registered`;
    details.append(title, sub); const actions = document.createElement("div"); actions.className = "admin-event-actions";
    const edit = document.createElement("button"); edit.textContent = "Edit"; edit.addEventListener("click", () => beginEdit(event));
    const del = document.createElement("button"); del.className = "delete-event"; del.textContent = "Delete"; del.addEventListener("click", () => deleteEvent(event.id, event.title));
    actions.append(edit, del); row.append(details, actions); list.append(row);
  });
}
async function refreshEvents() {
  const result = await api("/events"); state.events = result.events;
  renderEvents(); if (state.user?.role === "admin") renderAdminEvents();
}
async function refreshRegistrations() {
  if (!state.user) { state.registrations = []; return; }
  const result = await api("/registrations/mine"); state.registrations = result.registrations;
  renderRegistrations(); renderEvents();
}
async function handleRegister(id) {
  if (!state.user) { openAuth("login"); showToast("Log in or create an account to register."); return; }
  try { await api(`/events/${id}/register`, { method: "POST" }); await Promise.all([refreshEvents(), refreshRegistrations()]); showToast("You're registered! See you there."); }
  catch (error) { showToast(error.message); }
}
async function cancelRegistration(id) {
  if (!confirm("Cancel this event registration?")) return;
  try { await api(`/registrations/${id}`, { method: "DELETE" }); await Promise.all([refreshEvents(), refreshRegistrations()]); showToast("Registration cancelled."); }
  catch (error) { showToast(error.message); }
}
function openAuth(mode) {
  state.authMode = mode; const signup = mode === "register";
  $("#authTitle").textContent = signup ? "Your campus story starts here." : "Good things start here.";
  $("#authSubtitle").textContent = signup ? "Create your account and find your people." : "Log in to register for events and manage your plans.";
  $("#nameField").classList.toggle("hidden", !signup); $("#fullName").required = signup;
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("#authSubmit").textContent = signup ? "Create account" : "Log in";
  $("#switchText").textContent = signup ? "Already have an account?" : "New here?";
  $("#switchAuth").textContent = signup ? "Log in" : "Create an account";
  $("#authError").classList.add("hidden"); $("#authForm").reset(); $("#authDialog").showModal();
}
async function loadSession() {
  try { const result = await api("/auth/me"); state.user = result.user; }
  catch { state.user = null; }
  updateAccountUI();
}
function resetEventForm() {
  $("#eventForm").reset(); $("#eventId").value = ""; $("#eventCapacity").value = 100;
  $("#eventFormTitle").textContent = "Create an event"; $("#saveEventButton").textContent = "Publish event"; $("#cancelEditButton").classList.add("hidden");
}
function beginEdit(event) {
  $("#eventId").value = event.id; $("#eventTitle").value = event.title; $("#eventCategory").value = event.category;
  $("#eventCapacity").value = event.capacity; $("#eventVenue").value = event.venue; $("#eventDescription").value = event.description;
  const date = new Date(event.starts_at); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  $("#eventDate").value = local; $("#eventFormTitle").textContent = "Edit event"; $("#saveEventButton").textContent = "Save changes"; $("#cancelEditButton").classList.remove("hidden");
  $("#eventForm").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function deleteEvent(id, title) {
  if (!confirm(`Delete "${title}"? Its registrations will also be removed.`)) return;
  try { await api(`/events/${id}`, { method: "DELETE" }); await refreshEvents(); await refreshRegistrations(); showToast("Event deleted."); }
  catch (error) { showToast(error.message); }
}

$("#loginOpen").addEventListener("click", () => openAuth("login"));
$("#registerOpen").addEventListener("click", () => openAuth("register"));
$("#authClose").addEventListener("click", () => $("#authDialog").close());
$("#switchAuth").addEventListener("click", () => openAuth(state.authMode === "login" ? "register" : "login"));
$("#myRegistrationsNav").addEventListener("click", () => $("#registrationsSection").scrollIntoView({ behavior: "smooth" }));
$("#searchInput").addEventListener("input", renderEvents);
$("#categoryFilter").addEventListener("change", renderEvents);
$("#logoutButton").addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); state.user = null; state.registrations = []; updateAccountUI(); renderRegistrations(); await refreshEvents(); showToast("You are logged out."); }
  catch (error) { showToast(error.message); }
});
$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const signup = state.authMode === "register";
  const errorBox = $("#authError"); errorBox.classList.add("hidden"); $("#authSubmit").disabled = true;
  try {
    const body = { email: $("#authEmail").value.trim(), password: $("#authPassword").value };
    if (signup) body.name = $("#fullName").value.trim();
    const result = await api(signup ? "/auth/register" : "/auth/login", { method: "POST", body });
    state.user = result.user; $("#authDialog").close(); updateAccountUI();
    await refreshEvents(); await refreshRegistrations(); if (state.user.role === "admin") renderAdminEvents();
    showToast(signup ? "Account created. Welcome!" : "Welcome back!");
  } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove("hidden"); }
  finally { $("#authSubmit").disabled = false; }
});
$("#eventForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const id = $("#eventId").value;
  const body = { title: $("#eventTitle").value.trim(), category: $("#eventCategory").value, capacity: Number($("#eventCapacity").value), starts_at: new Date($("#eventDate").value).toISOString(), venue: $("#eventVenue").value.trim(), description: $("#eventDescription").value.trim() };
  try {
    await api(id ? `/events/${id}` : "/events", { method: id ? "PATCH" : "POST", body });
    resetEventForm(); await refreshEvents(); showToast(id ? "Event updated." : "Event published.");
  } catch (error) { showToast(error.message); }
});
$("#cancelEditButton").addEventListener("click", resetEventForm);
$("#year").textContent = new Date().getFullYear();

(async function init() {
  try { await loadSession(); await refreshEvents(); if (state.user) await refreshRegistrations(); if (state.user?.role === "admin") renderAdminEvents(); }
  catch (error) { setNotice(`${error.message} Check that the backend is running and Supabase is configured.`); $("#eventsGrid").replaceChildren(); }
})();
