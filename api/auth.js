// POST { id, password }  ->  { token }   (login check happens on the server)
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  try {
    const okRate = await L.rateLimit("login:" + L.ip(req), 10, 900); // 10 tries per 15 min per IP
    if (!okRate) return L.send(res, 429, { error: "Too many attempts. Try again in a few minutes." });

    const { id, password } = L.body(req);
    const ADMIN_ID = process.env.ADMIN_ID;
    if (!ADMIN_ID) return L.send(res, 500, { error: "Admin login is not configured on the server." });

    if (L.safeEqual(id || "", ADMIN_ID) && await L.checkPassword(password || "")) {
      return L.send(res, 200, { token: L.sign({ exp: Date.now() + 12 * 3600 * 1000 }) });
    }
    return L.send(res, 401, { error: "Wrong login ID or password." });
  } catch (e) { L.fail(res, e); }
};
