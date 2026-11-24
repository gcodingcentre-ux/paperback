// Shared helpers for the API. Files starting with "_" are NOT exposed as endpoints by Vercel.
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const CONTENT_KEY = "pb:content";            // the whole CMS data (JSON)
const PENDING_KEY = "pb:pending_feedback";   // visitor feedback waiting for approval (list)
const SEGMENTS = ["banners","books","authors","publishing","services","process","events","feedback","about","settings"];

// Works with either pair of variable names that the Upstash integration can create on Vercel.
let _redis;
function redis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis environment variables are missing");
  _redis = new Redis({ url, token });
  return _redis;
}

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SECRET is missing or too short (use 32+ random characters)");
  return s;
}

const b64 = b => Buffer.from(b).toString("base64url");
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + sig;
}
function verify(token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(good);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
function isAdmin(req) {
  const h = req.headers.authorization || "";
  return !!verify(h.startsWith("Bearer ") ? h.slice(7) : "");
}
function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}
// Allow `max` hits per `windowSec` for this key. Returns true if allowed.
async function rateLimit(key, max, windowSec) {
  const k = "pb:rl:" + key;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, windowSec);
  return n <= max;
}
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}
function send(res, status, data, cache) {
  res.setHeader("Cache-Control", cache || "no-store");
  res.status(status).json(data);
}
function fail(res, e) {
  console.error(e);
  send(res, 500, { error: "Server error. Check the Vercel function logs." });
}

module.exports = { redis, sign, verify, isAdmin, safeEqual, ip, rateLimit, body, send, fail, CONTENT_KEY, PENDING_KEY, SEGMENTS };
