require("dotenv").config();
const bcrypt = require("bcryptjs");
const supabase = require("../supabase");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Campus Administrator").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set a valid ADMIN_EMAIL in backend/.env before running this script.");
  if (password.length < 12 || password.length > 128) throw new Error("Set ADMIN_PASSWORD to a unique password of 12–128 characters.");
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from("app_users").upsert({ name, email, password_hash, role: "admin" }, { onConflict: "email" }).select("id,email,role").single();
  if (error) throw new Error(`Could not create admin: ${error.message}`);
  console.log(`Admin account ready for ${data.email}. Keep its password private.`);
})().catch(error => { console.error(error.message); process.exit(1); });
