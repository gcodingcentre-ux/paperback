// Sends email through Resend (https://resend.com) with a plain fetch call, so no new package is needed.
// Vercel environment variables:  RESEND_API_KEY  (required to send)   MAIL_FROM  e.g. "PaperBack Orders <orders@yourdomain.com>"
//                                PUBLISHER_EMAIL (optional; falls back to the Email in Contact & social)
// If RESEND_API_KEY is missing, orders are still saved and WhatsApp still works; the order just shows "email not configured".
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sendMail({ to, cc, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email is not configured (RESEND_API_KEY missing)" };
  const from = process.env.MAIL_FROM || "PaperBack Publishers <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ from, to: [].concat(to), cc: cc && cc.length ? [].concat(cc) : undefined, subject, html })
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); return { ok: false, error: "Mail service said " + r.status + " " + t.slice(0, 160) }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 160) }; }
}

const inr = n => "\u20B9" + Number(n).toLocaleString("en-IN");

// lines: [{title, qty, price, discount, net}]   Shows the list price, the coupon discount and the net amount per book.
function linesTable(lines) {
  const th = "padding:8px 10px;text-align:left;background:#EAF0FB;color:#1E3A6E;font-size:12px;text-transform:uppercase";
  const td = "padding:8px 10px;border-bottom:1px solid #e3e9f3";
  return `<table style="border-collapse:collapse;width:100%;font:14px Arial,sans-serif"><tr><th style="${th}">Book</th><th style="${th}">Copies</th><th style="${th}">List price</th><th style="${th}">Coupon discount</th><th style="${th}">Net amount</th></tr>` +
    lines.map(l => `<tr><td style="${td}">${esc(l.title)}</td><td style="${td}">${l.qty}</td><td style="${td}">${l.price > 0 ? inr(l.price * l.qty) : "Price on request"}</td><td style="${td}">${l.discount ? "\u2212" + inr(l.discount) : "\u2014"}</td><td style="${td}"><b>${l.price > 0 ? inr(l.net) : "To be confirmed"}</b></td></tr>`).join("") + "</table>";
}

function authorMail(o, authorName, lines) {
  const copies = lines.reduce((a, l) => a + l.qty, 0), net = lines.reduce((a, l) => a + l.net, 0), disc = lines.reduce((a, l) => a + l.discount, 0);
  return {
    subject: `New order ${o.id}: ${copies} cop${copies === 1 ? "y" : "ies"} of your book${lines.length > 1 ? "s" : ""}`,
    html: `<div style="font:15px Arial,sans-serif;color:#16233F;max-width:640px"><h2 style="color:#1E3A6E;margin:0 0 8px">New order for your book${lines.length > 1 ? "s" : ""}</h2>
      <p>Hello ${esc(authorName)}, a customer has just placed an order on the PaperBack website (order <b>${esc(o.id)}</b>). It is confirmed with the customer on WhatsApp. Your part of the order:</p>
      ${linesTable(lines)}
      <p style="margin-top:12px">Copies: <b>${copies}</b> &nbsp;|&nbsp; Coupon${o.coupon ? " <b>" + esc(o.coupon) + "</b>" : ""}: <b>${disc ? "\u2212" + inr(disc) : "none"}</b> &nbsp;|&nbsp; Net sale value: <b>${inr(net)}</b></p>
      <p style="color:#51607D;font-size:13px">The discount on each book is shown above, so you can see exactly what the customer paid. The publisher has a copy of this email.</p></div>`
  };
}
function publisherMail(o) {
  return {
    subject: `Order ${o.id}: ${o.lines.reduce((a, l) => a + l.qty, 0)} cop(ies), ${inr(o.total)}`,
    html: `<div style="font:15px Arial,sans-serif;color:#16233F;max-width:680px"><h2 style="color:#1E3A6E;margin:0 0 8px">New website order ${esc(o.id)}</h2>
      <p>Customer: <b>${esc(o.name)}</b>${o.address ? "<br>Address: " + esc(o.address) : ""}${o.note ? "<br>Note: " + esc(o.note) : ""}</p>
      ${linesTable(o.lines)}
      <p style="margin-top:12px">Subtotal: <b>${inr(o.subtotal)}</b> &nbsp;|&nbsp; Coupon${o.coupon ? " <b>" + esc(o.coupon) + "</b>" : ""}: <b>${o.discount ? "\u2212" + inr(o.discount) : "none"}</b> &nbsp;|&nbsp; Total: <b>${inr(o.total)}</b></p>
      <p style="color:#51607D;font-size:13px">Authors notified: ${o.emails && o.emails.length ? esc(o.emails.map(e => e.author + " (" + (e.sent ? "sent" : "not sent") + ")").join(", ")) : "none"}. Mark the order Confirmed in the admin Orders page once payment is received.</p></div>`
  };
}
module.exports = { sendMail, authorMail, publisherMail, inr };
