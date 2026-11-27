// GET  /api/orders                 (admin) -> { orders }   newest first
// POST /api/orders { id, status }  (admin) -> change an order's status: new | confirmed | delivered | cancelled
const L = require("./_lib");
const ORDERS_KEY = "pb:orders";
const STATUSES = ["new", "confirmed", "delivered", "cancelled"];

module.exports = async (req, res) => {
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
  try {
    if (req.method === "GET") return L.send(res, 200, { orders: (await L.redis().lrange(ORDERS_KEY, 0, 1999)) || [] });
    if (req.method === "POST") {
      const { id, status } = L.body(req);
      if (!STATUSES.includes(status)) return L.send(res, 400, { error: "Unknown status." });
      const list = (await L.redis().lrange(ORDERS_KEY, 0, 1999)) || [];
      const i = list.findIndex(o => o && o.id === id);
      if (i < 0) return L.send(res, 404, { error: "Order not found." });
      await L.redis().lset(ORDERS_KEY, i, { ...list[i], status });
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 405, { error: "Method not allowed" });
  } catch (e) { L.fail(res, e); }
};
