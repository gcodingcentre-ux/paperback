/* PaperBack – book page: merges the admin's book data, then starts book.js and book-order.js. */
(function () {
  if (typeof BOOK_DETAILS === "undefined") window.BOOK_DETAILS = {};   // book-data.js missing or empty: build everything from the admin data
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/* PaperBack – book page: merges the admin's book data, then starts book.js and book-order.js. */
(function () {
  if (typeof BOOK_DETAILS === "undefined") window.BOOK_DETAILS = {};   // book-data.js missing or empty: build everything from the admin data
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const load = src => new Promise(done => { const s = document.createElement("script"); s.src = src; s.onload = s.onerror = done; document.body.appendChild(s); });
  const get = fetch("/api/get-content", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const wait = new Promise(r => setTimeout(() => r(null), 4000));   // never block the page for long

  Promise.race([get, wait]).then(d => {
    const L = d && d.content && Array.isArray(d.content.books) && d.content.books.length ? d.content.books : null;
    if (L) {
      window.PB_PRICES = {};
      Object.keys(BOOK_DETAILS).forEach(k => { if (!L.some(b => slug(b.title) === k)) delete BOOK_DETAILS[k]; });
      L.forEach(b => {
        const k = slug(b.title); if (!k) return;
        const old = BOOK_DETAILS[k] || {};
        BOOK_DETAILS[k] = { title: b.title, author: b.author || old.author || "", genre: b.genre || old.genre || "", color: b.color || old.color || "blue", summary: b.summary || old.summary || "", bio: b.bio || old.bio || "", image: /^\/api\/image\?id=[a-f0-9]{16}$/.test(String(b.image || "")) ? b.image : "" };
        const p = Number(b.price); if (p > 0) window.PB_PRICES[k] = p;
      });
    }
    return load("book.js").then(() => load("book-order.js"));
  });
})();
/g, "");
  const load = src => new Promise(done => { const s = document.createElement("script"); s.src = src; s.onload = s.onerror = done; document.body.appendChild(s); });
  const get = fetch("/api/get-content", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const wait = new Promise(r => setTimeout(() => r(null), 4000));   // never block the page for long

  Promise.race([get, wait]).then(d => {
    const L = d && d.content && Array.isArray(d.content.books) && d.content.books.length ? d.content.books : null;
    if (L) {
      window.PB_PRICES = {};
      Object.keys(BOOK_DETAILS).forEach(k => { if (!L.some(b => slug(b.title) === k)) delete BOOK_DETAILS[k]; });
      L.forEach(b => {
        const k = slug(b.title); if (!k) return;
        const old = BOOK_DETAILS[k] || {};
        BOOK_DETAILS[k] = { title: b.title, author: b.author || old.author || "", genre: b.genre || old.genre || "", color: b.color || old.color || "blue", summary: b.summary || old.summary || "", bio: b.bio || old.bio || "" };
        const p = Number(b.price); if (p > 0) window.PB_PRICES[k] = p;
      });
    }
    return load("book.js").then(() => load("book-order.js"));
  });
})();
