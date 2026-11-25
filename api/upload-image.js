// POST   { data: "data:image/webp;base64,..." }  (admin only) -> stores a cover image in Redis, returns { url }
// DELETE ?id=<16 hex chars>                      (admin only) -> removes a stored image
// The browser already converts the picture to a small WebP file; this only validates and stores it.
const crypto = require("crypto");
const L = require("./_lib");

const MAX_BYTES = 200 * 1024; // a converted cover is normally 30-80 KB

function kind(buf) {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "DELETE") return L.send(res, 405, { error: "Method not allowed" });
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "Please log in again." });
  try {
    if (req.method === "DELETE") {
      const id = String((req.query && req.query.id) || "");
      if (!/^[a-f0-9]{16}$/.test(id)) return L.send(res, 400, { error: "Bad image id." });
      await L.redis().del(L.IMG_PREFIX + id);
      return L.send(res, 200, { ok: true });
    }

    if (!(await L.rateLimit("img:" + L.ip(req), 60, 3600))) return L.send(res, 429, { error: "Too many uploads. Try again later." });

    const m = /^data:image\/(?:webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(L.body(req).data || ""));
    if (!m) return L.send(res, 400, { error: "Send a WebP or JPEG image." });
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX_BYTES) return L.send(res, 413, { error: "Image is still too large after compression." });
    const type = kind(buf);
    if (!type) return L.send(res, 400, { error: "That file is not a valid image." });

    const id = crypto.randomBytes(8).toString("hex");
    await L.redis().set(L.IMG_PREFIX + id, { t: type, d: m[1] });
    return L.send(res, 200, { url: "/api/image?id=" + id, bytes: buf.length });
  } catch (e) { L.fail(res, e); }
};
