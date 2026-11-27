// Admin only.
// GET  /api/orders                  -> { orders: [...] }  (newest first)
// POST /api/orders { id, status }   -> changes the status of one order (new | confirmed | delivered | cancelled)
const L = require("./_lib");
const ORDERS_KEY = "pb:orders";
const STATUSES = ["new", "confirmed", "delivered", "cancelled"];

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
  try {
    if (req.method === "GET") {
      const orders = (await L.redis().lrange(ORDERS_KEY, 0, 1999)) || [];
      return L.send(res, 200, { orders });
    }
    const b = L.body(req), id = String(b.id || ""), status = String(b.status || "");
    if (!id || !STATUSES.includes(status)) return L.send(res, 400, { error: "Bad request." });
    const list = (await L.redis().lrange(ORDERS_KEY, 0, 1999)) || [];
    const i = list.findIndex(o => o && o.id === id);
    if (i < 0) return L.send(res, 404, { error: "Order not found." });
    // Only overwrite the slot if it still holds this order (a new order may have shifted the list meanwhile).
    const cur = await L.redis().lindex(ORDERS_KEY, i);
    if (!cur || cur.id !== id) return L.send(res, 409, { error: "Orders changed, please refresh and try again." });
    await L.redis().lset(ORDERS_KEY, i, { ...list[i], status });
    return L.send(res, 200, { ok: true });
  } catch (e) { L.fail(res, e); }
};
