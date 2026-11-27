// POST { items:[{slug,qty}], coupon?, name, address?, note? }   (public)
// Prices and coupons are re-checked here from the saved content, so the browser cannot change them.
// Saves the order, e-mails every author involved (publisher in copy) and returns the numbers + the WhatsApp text.
const L = require("./_lib");
const M = require("./_mail");
const ORDERS_KEY = "pb:orders";
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Percent: taken off every line. Flat: taken off the order once, shared between lines by value.
function discountFor(c, lines, subtotal) {
  if (!c || subtotal <= 0) return lines.map(() => 0);
  if (c.type === "percent") return lines.map(l => Math.round(l.price * l.qty * Math.min(100, c.value) / 100));
  const total = Math.min(subtotal, Number(c.value) || 0);
  let left = total;
  return lines.map((l, i) => { const d = i === lines.length - 1 ? left : Math.min(left, Math.round(total * (l.price * l.qty) / subtotal)); left -= d; return d; });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "Method not allowed" });
  try {
    if (!(await L.rateLimit("order:" + L.ip(req), 10, 3600))) return L.send(res, 429, { error: "Too many orders. Please try again later." });
    const b = L.body(req);
    const name = String(b.name || "").trim().slice(0, 80), address = String(b.address || "").trim().slice(0, 300), note = String(b.note || "").trim().slice(0, 300);
    if (!name) return L.send(res, 400, { error: "Please enter your name." });
    const items = Array.isArray(b.items) ? b.items.slice(0, 20) : [];
    if (!items.length) return L.send(res, 400, { error: "Your cart is empty." });

    const content = (await L.redis().get(L.CONTENT_KEY)) || {};
    const books = Array.isArray(content.books) ? content.books : [];
    const authors = Array.isArray(content.authors) ? content.authors : [];

    const merged = new Map();
    for (const it of items) { const s = String(it && it.slug || ""), q = Math.round(Number(it && it.qty)); if (s && q >= 1) merged.set(s, Math.min(50, (merged.get(s) || 0) + q)); }
    const lines = [];
    for (const [s, qty] of merged) {
      const bk = books.find(x => slug(x.title) === s);
      const price = bk ? Number(bk.price) : 0;
      if (!bk || !(price > 0)) return L.send(res, 400, { error: "A book in your cart is no longer available for ordering. Please refresh the page." });
      lines.push({ slug: s, title: String(bk.title), author: String(bk.author || ""), qty, price, discount: 0, net: 0 });
    }
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);

    // Candidate offers: the coupon the customer typed, and any live offer marked "Show on website". The bigger saving wins.
    const all = (Array.isArray(content.coupons) ? content.coupons : []).filter(L.couponLive);
    const typed = String(b.coupon || "").trim().toUpperCase();
    const cands = all.filter(c => c.show === "Yes" || (typed && c.code === typed));
    if (typed && !all.some(c => c.code === typed)) return L.send(res, 400, { error: "That coupon isn't valid or has expired." });
    let best = null, bestSave = 0;
    for (const c of cands) { const s = discountFor(c, lines, subtotal).reduce((a, x) => a + x, 0); if (s > bestSave) { best = c; bestSave = s; } }
    const disc = discountFor(best, lines, subtotal);
    lines.forEach((l, i) => { l.discount = disc[i]; l.net = l.price * l.qty - disc[i]; });
    const discount = lines.reduce((a, l) => a + l.discount, 0);

    const order = {
      id: "PB" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 4).toUpperCase(),
      ts: Date.now(), name, address, note, coupon: best ? best.code : "", lines, subtotal, discount, total: subtotal - discount, status: "new", emails: []
    };

    // E-mail each author about their own books (publisher in copy), then the publisher a full summary.
    const pubEmail = process.env.PUBLISHER_EMAIL || (((Array.isArray(content.settings) ? content.settings : []).find(x => String(x.label).trim().toLowerCase() === "email") || {}).value || "");
    const cc = EMAIL.test(pubEmail) ? [pubEmail] : [];
    const byAuthor = new Map();
    lines.forEach(l => { const k = l.author.trim().toLowerCase(); if (k) byAuthor.set(k, (byAuthor.get(k) || []).concat(l)); });
    for (const [k, ls] of byAuthor) {
      const a = authors.find(x => String(x.name || "").trim().toLowerCase() === k);
      const display = a ? a.name : ls[0].author;
      if (!a || !EMAIL.test(String(a.email || "").trim())) { order.emails.push({ author: display, sent: false, error: "No email saved for this author" }); continue; }
      const m = M.authorMail(order, display, ls), r = await M.sendMail({ to: a.email.trim(), cc, subject: m.subject, html: m.html });
      order.emails.push({ author: display, sent: r.ok, error: r.ok ? "" : r.error });
    }
    if (cc.length) { const m = M.publisherMail(order); await M.sendMail({ to: cc, subject: m.subject, html: m.html }); }

    await L.redis().lpush(ORDERS_KEY, order);
    await L.redis().ltrim(ORDERS_KEY, 0, 1999);

    let text = `Hello PaperBack Publishers! I would like to place order ${order.id}:\n\n` +
      lines.map(l => `${l.qty} x ${l.title} by ${l.author} = ${M.inr(l.price * l.qty)}`).join("\n") + `\n\nSubtotal: ${M.inr(subtotal)}`;
    if (discount) text += `\nCoupon ${order.coupon}: -${M.inr(discount)}`;
    text += `\nTotal: ${M.inr(order.total)}\n\nName: ${name}` + (address ? `\nAddress: ${address}` : "") + (note ? `\nNote: ${note}` : "");
    const waRow = (Array.isArray(content.settings) ? content.settings : []).find(x => String(x.label).trim().toLowerCase() === "whatsapp number");
    const wa = waRow ? String(waRow.value || "").replace(/\D/g, "") : "";
    return L.send(res, 200, { id: order.id, lines, subtotal, discount, total: order.total, coupon: order.coupon, text, wa: wa.length >= 10 ? wa : "" });
  } catch (e) { L.fail(res, e); }
};
