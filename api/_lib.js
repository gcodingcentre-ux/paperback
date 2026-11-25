// Shared helpers for the API. Files starting with "_" are NOT exposed as endpoints by Vercel.
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const CONTENT_KEY = "pb:content";            // the whole CMS data (JSON)
const IMG_PREFIX = "pb:img:";               // one key per uploaded cover image
const PENDING_KEY = "pb:pending_feedback";   // visitor feedback waiting for approval (list)
const PASS_KEY = "pb:admin_pw";             // password saved by "Change / Forgot password" (overrides ADMIN_PASSWORD)
const SEGMENTS = ["banners","books","authors","publishing","services","process","events","feedback","about","settings","coupons"];

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
  if (n === 1 || (await redis().ttl(k)) < 0) await redis().expire(k, windowSec);   // also repairs a counter that lost its expiry
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

// Password: a saved (scrypt-hashed) password wins; until one is saved, the ADMIN_PASSWORD env variable is used.
async function checkPassword(pw) {
  const rec = await redis().get(PASS_KEY);
  if (rec && rec.salt && rec.hash) {
    const h = crypto.scryptSync(String(pw), Buffer.from(rec.salt, "hex"), 32);
    const good = Buffer.from(rec.hash, "hex");
    return h.length === good.length && crypto.timingSafeEqual(h, good);
  }
  const env = process.env.ADMIN_PASSWORD;
  return !!env && safeEqual(pw, env);
}
async function setPassword(pw) {
  const salt = crypto.randomBytes(16);
  await redis().set(PASS_KEY, { salt: salt.toString("hex"), hash: crypto.scryptSync(String(pw), salt, 32).toString("hex") });
}

// A coupon works when it is switched on and its last day (India time) has not passed.
function couponLive(c) {
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  return !!c && c.active !== "No" && (!c.expires || today <= c.expires);
}
module.exports = { checkPassword, setPassword, couponLive, redis, sign, verify, isAdmin, safeEqual, ip, rateLimit, body, send, fail, CONTENT_KEY, PENDING_KEY, IMG_PREFIX, SEGMENTS };
