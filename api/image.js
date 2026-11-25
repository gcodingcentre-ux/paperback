// GET /api/image?id=<16 hex chars>  -> the stored cover image (cached for a year; every upload gets a new id)
const L = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") return L.send(res, 405, { error: "Method not allowed" });
  try {
    const id = String((req.query && req.query.id) || "");
    if (!/^[a-f0-9]{16}$/.test(id)) return L.send(res, 400, { error: "Bad image id." });
    const img = await L.redis().get(L.IMG_PREFIX + id);
    if (!img || !img.d) return L.send(res, 404, { error: "Image not found." }, "public, max-age=60");
    res.setHeader("Content-Type", img.t === "jpeg" ? "image/jpeg" : "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.status(200).end(Buffer.from(img.d, "base64"));
  } catch (e) { L.fail(res, e); }
};
