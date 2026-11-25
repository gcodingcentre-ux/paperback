// PaperBack – book landing page. cms-book.js loads this after BOOK_DETAILS is ready, then loads book-order.js.
(function () {
  const esc = x => String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const text = x => esc(x).replace(/\n/g, "<br>");
  const IMG = /^\/api\/image\?id=[a-f0-9]{16}$/;
  const COLORS = ["blue", "green", "navy", "moss"];

  const slug = new URLSearchParams(location.search).get("book");
  const book = (window.BOOK_DETAILS || {})[slug];
  const page = document.getElementById("book-page");

  if (page) {
    if (book) {
      document.title = book.title + " – PaperBack Publishers";
      const color = COLORS.includes(book.color) ? book.color : "blue";
      const cover = IMG.test(String(book.image || ""))
        ? `<div class="cover has-img big-cover"><img src="${esc(book.image)}" alt="Cover of ${esc(book.title)}" width="400" height="600"></div>`
        : `<div class="cover c-${color} big-cover" role="img" aria-label="Cover of ${esc(book.title)}"><strong>${esc(book.title)}</strong><span>${esc(book.author)}</span></div>`;
      page.innerHTML = `
        ${cover}
        <div class="book-info">
          ${book.genre ? `<p class="genre">${esc(book.genre)}</p>` : ""}
          <h1>${esc(book.title)}</h1>
          <p class="by">by ${esc(book.author)}</p>
          ${book.summary ? `<h2>Summary</h2><p>${text(book.summary)}</p>` : ""}
          ${book.bio ? `<h2>About the author</h2><p>${text(book.bio)}</p>` : ""}
          <a class="btn" href="index.html#catalogue">Browse more titles</a>
        </div>`;
    } else {
      page.innerHTML = `<div class="book-info"><h1>Book not found</h1>
        <p>We could not find that title.</p>
        <a class="btn" href="index.html#catalogue">Back to the catalogue</a></div>`;
    }
  }

  const toggle = document.querySelector(".nav-toggle"), nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
  }
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
