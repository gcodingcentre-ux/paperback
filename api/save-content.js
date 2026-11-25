// POST { content }  (admin only)  -> saves the whole CMS data in Redis
const L = require("./_lib");
const IMG_URL = /^\/api\/image\?id=[a-f0-9]{16}$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
  try {
    const { content } = L.body(req);
    if (!content || typeof content !== "object") return L.send(res, 400, { error: "No content received." });

    const clean = {};
    for (const k of L.SEGMENTS) {
      const list = content[k];
      if (!Array.isArray(list) || list.length > 500) return L.send(res, 400, { error: "Invalid data in: " + k });
      clean[k] = list.filter(x => x && typeof x === "object" && !Array.isArray(x));
      if (k === "coupons") {
        const seen = new Set(), out = [];
        for (const c of clean[k]) {
          const code = String(c.code || "").trim().toUpperCase(), value = Number(c.value);
          if (!/^[A-Z0-9_-]{2,20}$/.test(code)) return L.send(res, 400, { error: "Coupon code must be 2–20 letters or numbers, no spaces: “" + (c.code || "(empty)") + "”" });
          if (seen.has(code)) return L.send(res, 400, { error: "Coupon code used twice: " + code });
          const type = c.type === "flat" ? "flat" : "percent";
          if (!(value > 0) || (type === "percent" && value > 100) || value > 100000) return L.send(res, 400, { error: "Coupon " + code + ": discount must be 1–100 for percent, or a rupee amount above 0." });
          seen.add(code);
          out.push({ id: c.id, code, type, value, active: c.active === "No" ? "No" : "Yes", show: c.show === "Yes" ? "Yes" : "No", expires: /^\d{4}-\d{2}-\d{2}$/.test(String(c.expires || "")) ? c.expires : "", note: String(c.note || "").slice(0, 120) });
        }
        clean[k] = out;
      }
      if (k === "books") clean[k] = clean[k].map(b => ({ ...b, image: IMG_URL.test(String(b.image || "")) ? b.image : "" }));
    }
    const json = JSON.stringify(clean);
    if (json.length > 1500000) return L.send(res, 413, { error: "Content is too large." });

    await L.redis().set(L.CONTENT_KEY, clean);

    // Visitor feedback that now exists in the saved content is no longer "waiting".
    const known = new Set(clean.feedback.map(f => f.id));
    const waiting = (await L.redis().lrange(L.PENDING_KEY, 0, 199)) || [];
    const still = waiting.filter(f => f && !known.has(f.id));
    if (still.length !== waiting.length) {
      await L.redis().del(L.PENDING_KEY);
      if (still.length) await L.redis().rpush(L.PENDING_KEY, ...still);
    }
    return L.send(res, 200, { ok: true });
  } catch (e) { L.fail(res, e); }
};
