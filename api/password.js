// POST { action: "change", current, next }   (admin logged in)  -> changes the password
// POST { action: "reset",  key, next }       (forgot password)   -> key is ADMIN_RECOVERY_KEY (Vercel environment variable; falls back to ADMIN_SECRET)
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  try {
    const b = L.body(req), next = String(b.next || "");
    if (next.length < 8 || next.length > 200) return L.send(res, 400, { error: "The new password must be 8 to 200 characters." });

    if (b.action === "change") {
      if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
      if (!(await L.rateLimit("pwchange:" + L.ip(req), 10, 900))) return L.send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
      if (!(await L.checkPassword(String(b.current || "")))) return L.send(res, 403, { error: "Your current password is wrong." });
      await L.setPassword(next);
      return L.send(res, 200, { ok: true });
    }

    if (b.action === "reset") {
      if (!(await L.rateLimit("pwreset:" + L.ip(req), 5, 900))) return L.send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
      const recovery = process.env.ADMIN_RECOVERY_KEY || process.env.ADMIN_SECRET || "";
      if (!recovery || !L.safeEqual(String(b.key || ""), recovery)) return L.send(res, 403, { error: "That recovery key is not correct." });
      await L.setPassword(next);
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: "Unknown request." });
  } catch (e) { L.fail(res, e); }
};
