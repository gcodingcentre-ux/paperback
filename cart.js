/* PaperBack – shopping cart. Customers add several books, apply a coupon, then send the order on WhatsApp.
   The order is also sent to /api/order, which re-checks prices and coupons, saves it, and e-mails each author. */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = x => String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const inr = n => "\u20B9" + Number(n).toLocaleString("en-IN");
  const KEY = "pb_cart";
  const FALLBACK_WA = "919999999999";

  let cart = [], catalog = {}, offers = [], waNum = "", typed = null, ready = false;
  try { const c = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(c)) cart = c.filter(i => i && i.slug && i.qty > 0).slice(0, 20); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };

  /* ---------- prices: same formula as the server (the server's numbers are the final ones) ---------- */
  function discounts(c, lines, subtotal) {
    if (!c || subtotal <= 0) return lines.map(() => 0);
    if (c.type === "percent") return lines.map(l => Math.round(l.price * l.qty * Math.min(100, c.value) / 100));
    const total = Math.min(subtotal, Number(c.value) || 0); let left = total;
    return lines.map((l, i) => { const d = i === lines.length - 1 ? left : Math.min(left, Math.round(total * l.price * l.qty / subtotal)); left -= d; return d; });
  }
  function compute() {
    const lines = cart.filter(i => catalog[i.slug]).map(i => ({ slug: i.slug, qty: i.qty, title: catalog[i.slug].title, author: catalog[i.slug].author, price: catalog[i.slug].price, discount: 0, net: 0 }));
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
    let best = null, bestSave = 0;
    [typed, ...offers].filter(Boolean).forEach(c => { const s = discounts(c, lines, subtotal).reduce((a, x) => a + x, 0); if (s > bestSave) { best = c; bestSave = s; } });
    const d = discounts(best, lines, subtotal);
    lines.forEach((l, i) => { l.discount = d[i]; l.net = l.price * l.qty - d[i]; });
    return { lines, subtotal, discount: lines.reduce((a, l) => a + l.discount, 0), total: subtotal - lines.reduce((a, l) => a + l.discount, 0), coupon: best ? best.code : "" };
  }
  const count = () => cart.reduce((a, i) => a + i.qty, 0);

  /* ---------- UI shell ---------- */
  const fab = document.createElement("button");
  fab.className = "cart-fab"; fab.type = "button"; fab.setAttribute("aria-label", "Open cart");
  fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11h10.6L20.5 8H6.2"/></svg><span class="t">Cart</span><span class="n">0</span>';
  const ov = document.createElement("div"); ov.className = "cart-ov";
  const dr = document.createElement("aside"); dr.className = "cart-drawer"; dr.setAttribute("role", "dialog"); dr.setAttribute("aria-modal", "true"); dr.setAttribute("aria-label", "Your cart"); dr.hidden = true;
  document.body.append(fab, ov, dr);

  let toastT;
  function toast(m) {
    $$(".cart-toast").forEach(t => t.remove());
    const t = document.createElement("div"); t.className = "cart-toast"; t.textContent = m; document.body.append(t);
    clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 1800);
  }
  const onBookPage = !!new URLSearchParams(location.search).get("book");
  function badge() { $(".n", fab).textContent = count(); fab.hidden = !(ready && Object.keys(catalog).length && (onBookPage || count() > 0)); }

  function openCart() { draw(); dr.hidden = false; requestAnimationFrame(() => { ov.classList.add("show"); dr.classList.add("show"); }); const f = $(".cart-x", dr); if (f) f.focus(); }
  function closeCart() { ov.classList.remove("show"); dr.classList.remove("show"); setTimeout(() => { dr.hidden = true; }, 280); fab.focus(); }
  fab.onclick = openCart; ov.onclick = closeCart;
  addEventListener("keydown", e => { if (e.key === "Escape" && !dr.hidden) closeCart(); });

  /* ---------- drawer ---------- */
  function draw(msg) {
    badge();
    if (msg === "done") return;
    const p = compute();
    if (!cart.length || !p.lines.length) {
      dr.innerHTML = `<div class="cart-head"><h2>Your cart</h2><button class="cart-x" aria-label="Close">&times;</button></div><div class="cart-body"><div class="cart-empty">Your cart is empty.<br>Add some books to order them together.</div></div>`;
      $(".cart-x", dr).onclick = closeCart; return;
    }
    const keep = { name: ($("#ct-name", dr) || {}).value || "", addr: ($("#ct-addr", dr) || {}).value || "", note: ($("#ct-note", dr) || {}).value || "", cp: ($("#ct-cp", dr) || {}).value || "" };
    dr.innerHTML = `<div class="cart-head"><h2>Your cart (${count()})</h2><button class="cart-x" aria-label="Close">&times;</button></div>
    <div class="cart-body">
      ${p.lines.map(l => `<div class="ci"><div><b>${esc(l.title)}</b><small>${esc(l.author)} · ${inr(l.price)} each</small>
        <div class="ctl"><button data-q="-1" data-s="${esc(l.slug)}" aria-label="Fewer">&minus;</button><span>${l.qty}</span><button data-q="1" data-s="${esc(l.slug)}" aria-label="More">+</button><button class="rm" data-rm="${esc(l.slug)}">Remove</button></div></div>
        <div class="pr">${l.discount ? `<s>${inr(l.price * l.qty)}</s>` : ""}${inr(l.net)}</div></div>`).join("")}
      <div class="cart-box">
        <label for="ct-cp">Coupon code</label>
        <div class="cp-row"><input id="ct-cp" autocomplete="off" autocapitalize="characters" placeholder="Enter code" value="${esc(keep.cp)}"><button type="button" id="ct-apply">Apply</button></div>
        <p class="cp-msg ${p.coupon ? "ok" : ""}" id="ct-cpm" role="status">${p.coupon ? `Coupon ${esc(p.coupon)} applied: you save ${inr(p.discount)}.` : ""}</p>
        <label>Your name<input id="ct-name" autocomplete="name" value="${esc(keep.name)}"></label>
        <label>Delivery address (optional)<textarea id="ct-addr" rows="2" autocomplete="street-address">${esc(keep.addr)}</textarea></label>
        <label>Note (optional)<input id="ct-note" value="${esc(keep.note)}"></label>
      </div>
    </div>
    <div class="cart-foot">
      <div class="tot"><span>Subtotal</span><span>${inr(p.subtotal)}</span></div>
      ${p.discount ? `<div class="tot save"><span>Coupon ${esc(p.coupon)}</span><span>&minus;${inr(p.discount)}</span></div>` : ""}
      <div class="tot big"><span>Total</span><span>${inr(p.total)}</span></div>
      <div class="cart-err" id="ct-err" aria-live="polite">${esc(msg || "")}</div>
      <button class="cart-go" id="ct-go" type="button"><svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.04 3C9.4 3 4 8.38 4 15.02c0 2.12.55 4.19 1.6 6.01L4 28l7.15-1.87a12 12 0 0 0 4.89 1.04C22.68 27.17 28 21.8 28 15.16 28 8.5 22.68 3 16.04 3zm0 21.9c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-4.24 1.11 1.13-4.13-.2-.32a9.9 9.9 0 0 1-1.52-5.2c0-5.5 4.5-9.97 10-9.97s10.02 4.47 10.02 9.97-4.5 9.88-10.02 9.88zm5.5-7.44c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.24-.58-.5-.5-.68-.5h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.2 5.08 4.48.7.3 1.26.48 1.7.62.72.23 1.37.2 1.88.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35z"/></svg>Order on WhatsApp</button>
      <p class="cart-note">Your order is saved and the authors are notified with the exact price and coupon discount. We confirm payment and delivery with you on WhatsApp.</p>
    </div>`;
    $(".cart-x", dr).onclick = closeCart;
    $("#ct-apply", dr).onclick = applyCoupon;
    $("#ct-cp", dr).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } };
    $("#ct-go", dr).onclick = order;
  }
  dr.addEventListener("click", e => {
    const q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
    if (q) { const it = cart.find(i => i.slug === q.dataset.s); if (it) { it.qty = Math.max(1, Math.min(50, it.qty + Number(q.dataset.q))); save(); draw(); } }
    if (rm) { cart = cart.filter(i => i.slug !== rm.dataset.rm); save(); draw(); }
  });

  async function applyCoupon() {
    const input = $("#ct-cp", dr), msg = $("#ct-cpm", dr), code = input.value.trim().toUpperCase();
    msg.className = "cp-msg";
    if (!code) { typed = null; return draw(); }
    msg.textContent = "Checking…";
    try {
      const r = await fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { typed = null; draw(); const m = $("#ct-cpm", dr); m.className = "cp-msg bad"; m.textContent = j.error || "That code isn't valid."; return; }
      typed = { code: j.code, type: j.type === "flat" ? "flat" : "percent", value: Number(j.value) };
      draw();
      const p = compute(), m = $("#ct-cpm", dr);
      if (p.coupon !== typed.code) { m.className = "cp-msg ok"; m.textContent = `Offer ${p.coupon} gives a better price, so it was kept.`; }
    } catch (e) { msg.className = "cp-msg bad"; msg.textContent = "Could not check the code. Please try again."; }
  }

  /* ---------- placing the order ---------- */
  function openWhatsApp(url) { const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url; }
  async function order() {
    const err = $("#ct-err", dr), name = $("#ct-name", dr).value.trim(), btn = $("#ct-go", dr);
    err.textContent = "";
    if (!name) { err.textContent = "Please enter your name."; $("#ct-name", dr).focus(); return; }
    const p = compute(); if (!p.lines.length) return;
    btn.disabled = true; btn.lastChild.textContent = "";
    const body = { items: cart.map(i => ({ slug: i.slug, qty: i.qty })), coupon: p.coupon || (typed && typed.code) || "", name, address: $("#ct-addr", dr).value, note: $("#ct-note", dr).value };
    let res = null, text, wa = waNum || FALLBACK_WA, recorded = false, id = "";
    try {
      const r = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 || r.status === 429) { btn.disabled = false; draw(j.error || "Could not place the order."); return; }
      if (r.ok && j.text) { res = j; text = j.text; id = j.id; recorded = true; if (j.wa) wa = j.wa; }
    } catch (e) { /* network problem: still let the customer order on WhatsApp below */ }
    if (!res) {   // fallback so a customer is never blocked; this order is not saved on the server
      text = "Hello PaperBack Publishers! I would like to order:\n\n" + p.lines.map(l => `${l.qty} x ${l.title} by ${l.author} = ${inr(l.price * l.qty)}`).join("\n") + `\n\nSubtotal: ${inr(p.subtotal)}` + (p.discount ? `\nCoupon ${p.coupon}: -${inr(p.discount)}` : "") + `\nTotal: ${inr(p.total)}\n\nName: ${name}` + (body.address ? `\nAddress: ${body.address}` : "");
    }
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
    cart = []; typed = null; save(); badge();
    dr.innerHTML = `<div class="cart-head"><h2>Order sent</h2><button class="cart-x" aria-label="Close">&times;</button></div><div class="cart-body"><div class="cart-done"><h3>Thank you, ${esc(name)}!</h3>
      <p>${recorded ? `Your order <b>${esc(id)}</b> is saved and the authors have been notified.` : "Your order details are ready."}<br>Press <b>Send</b> in WhatsApp to finish. We will confirm payment and delivery there.</p>
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open WhatsApp again</a></div></div>`;
    $(".cart-x", dr).onclick = closeCart;
    openWhatsApp(url);
  }

  /* ---------- add-to-cart buttons ---------- */
  function add(s, qty, quiet) {
    if (!catalog[s]) return;
    const it = cart.find(i => i.slug === s); if (it) it.qty = Math.min(50, it.qty + qty); else cart.push({ slug: s, qty });
    save(); badge(); fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump");
    if (!quiet) toast("Added to cart");
  }
  function inject() {
    if (!ready) return;
    const box = $(".order-box");
    if (box && !$(".cart-row", box)) {
      const s = new URLSearchParams(location.search).get("book");
      if (s && catalog[s]) {
        const row = document.createElement("div"); row.className = "cart-row";
        row.innerHTML = '<button type="button" class="cart-add">Add to cart</button><button type="button" class="cart-buy">Buy now</button>';
        box.append(row); box.classList.add("has-cart");
        $(".cart-add", row).onclick = () => add(s, 1);
        $(".cart-buy", row).onclick = () => { add(s, 1, true); openCart(); };
      }
    }
  }
  let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(inject, 60); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- load prices ---------- */
  fab.hidden = true; badge();
  fetch("/api/get-content", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
    const c = d && d.content; if (!c) return;
    (Array.isArray(c.books) ? c.books : []).forEach(b => { const s = slug(b.title), p = Number(b.price); if (s && p > 0) catalog[s] = { title: String(b.title), author: String(b.author || ""), price: p }; });
    const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
    offers = (Array.isArray(c.coupons) ? c.coupons : []).filter(o => o && o.code && Number(o.value) > 0 && (!o.expires || today <= o.expires)).map(o => ({ code: String(o.code), type: o.type === "flat" ? "flat" : "percent", value: Number(o.value) }));
    const w = (Array.isArray(c.settings) ? c.settings : []).find(x => String(x.label).trim().toLowerCase() === "whatsapp number");
    if (w && String(w.value).replace(/\D/g, "").length >= 10) waNum = String(w.value).replace(/\D/g, "");
    cart = cart.filter(i => catalog[i.slug]); save();
    ready = true; badge(); inject();
  }).catch(() => {});
})();
