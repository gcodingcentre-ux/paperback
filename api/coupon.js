// POST { code } -> { code, type, value }   Checks a coupon on the server so private codes are never sent to visitors.
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  try {
    if (!(await L.rateLimit("coupon:" + L.ip(req), 30, 900))) return L.send(res, 429, { error: "Too many tries. Please wait a few minutes." });
    const code = String(L.body(req).code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) return L.send(res, 404, { error: "That code isn't valid." });
    const content = await L.redis().get(L.CONTENT_KEY);
    const c = ((content && Array.isArray(content.coupons)) ? content.coupons : []).find(x => x && x.code === code && L.couponLive(x));
    if (!c) return L.send(res, 404, { error: "That code isn't valid or has expired." });
    return L.send(res, 200, { code: c.code, type: c.type, value: c.value });
  } catch (e) { L.fail(res, e); }
};
