// GET /api/get-content            -> public site content (approved feedback only), cached briefly
// GET /api/get-content?admin=1    -> full content + pending feedback (needs Authorization: Bearer <token>)
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") return L.send(res, 405, { error: "Method not allowed" });
  try {
    const content = (await L.redis().get(L.CONTENT_KEY)) || null;

    if (req.query && req.query.admin) {
      if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
      const pending = (await L.redis().lrange(L.PENDING_KEY, 0, 199)) || [];
      return L.send(res, 200, { content, pending });
    }

    if (content && Array.isArray(content.feedback)) {
      content.feedback = content.feedback.filter(f => f.status === "approved");
    }
    return L.send(res, 200, { content }, "public, s-maxage=10, stale-while-revalidate=60");
  } catch (e) { L.fail(res, e); }
};
