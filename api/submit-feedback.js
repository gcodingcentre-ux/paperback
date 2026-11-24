// POST { name, rating, message }  (public)  -> goes to the admin's "pending" queue
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  try {
    const okRate = await L.rateLimit("fb:" + L.ip(req), 5, 3600); // 5 messages per hour per IP
    if (!okRate) return L.send(res, 429, { error: "Too many messages. Please try later." });

    const b = L.body(req);
    const name = String(b.name || "").trim().slice(0, 80);
    const message = String(b.message || "").trim().slice(0, 1000);
    const rating = Math.round(Number(b.rating));
    if (!name || !message || !(rating >= 1 && rating <= 5)) return L.send(res, 400, { error: "Please fill in all fields." });

    const item = {
      id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, message, rating: String(rating), date: new Date().toISOString().slice(0, 10), status: "pending"
    };
    await L.redis().lpush(L.PENDING_KEY, item);
    await L.redis().ltrim(L.PENDING_KEY, 0, 199);
    return L.send(res, 200, { ok: true });
  } catch (e) { L.fail(res, e); }
};
