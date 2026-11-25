// Sample catalogue – replace with your real titles
const books = [
  { title: "The Salt Road", author: "Meera Sengupta", genre: "Fiction", color: "blue" },
  { title: "Monsoon Ledger", author: "Arjun Dutta", genre: "Fiction", color: "green" },
  { title: "Quiet Algorithms", author: "Ritika Bose", genre: "Non-fiction", color: "navy" },
  { title: "Rivers of Kolkata", author: "Sourav Mitra", genre: "Non-fiction", color: "moss" },
  { title: "Little Lantern", author: "Ananya Roy", genre: "Children", color: "green" },
  { title: "Counting Stars at Noon", author: "Tanmoy Paul", genre: "Children", color: "blue" },
  { title: "Notes from a Tea Garden", author: "Isha Banerjee", genre: "Poetry", color: "navy" },
  { title: "Ink & Alum", author: "Kabir Chanda", genre: "Poetry", color: "moss" }
];

const esc = x => String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const grid = document.getElementById("books");

const coverHTML = b => b.image
  ? `<div class="cover has-img"><img src="${esc(b.image)}" alt="Cover of ${esc(b.title)}" loading="lazy" decoding="async" width="400" height="600"></div>`
  : `<div class="cover c-${esc(b.color)}">
          <strong>${esc(b.title)}</strong>
          <span>${esc(b.author)}</span>
        </div>`;

function renderBooks(genre) {
  const list = genre === "All" ? books : books.filter(b => b.genre === genre);
  grid.scrollLeft = 0;
  grid.innerHTML = list.map(b => `
    <figure class="book">
      <a class="book-link" href="book.html?book=${slug(b.title)}">
        ${coverHTML(b)}
        <figcaption><b>${esc(b.title)}</b><span class="author">${esc(b.author)}</span> · ${esc(b.genre)}</figcaption>
      </a>
    </figure>`).join("");
}

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    renderBooks(chip.dataset.genre);
  });
});
renderBooks("All");

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
nav.addEventListener("click", e => {
  if (e.target.tagName === "A") {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", false);
  }
});

// Manuscript form validation
const form = document.getElementById("form");
const status = document.getElementById("status");
const messages = {
  name: "Enter your full name.",
  email: "Enter a valid email address.",
  genre: "Choose a genre.",
  message: "Tell us a little about your book."
};

form.addEventListener("submit", e => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("label").forEach(label => {
    const field = label.querySelector("input,select,textarea");
    const error = label.querySelector(".error");
    const ok = field.value.trim() !== "" && field.checkValidity();
    label.classList.toggle("invalid", !ok);
    error.textContent = ok ? "" : messages[field.name];
    if (!ok) valid = false;
  });
  if (!valid) {
    status.textContent = "";
    form.querySelector(".invalid input, .invalid select, .invalid textarea").focus();
    return;
  }
  // Connect this to your backend or a form service here.
  status.textContent = "Thank you. We have your details and will reply within two weeks.";
  form.reset();
});

document.getElementById("year").textContent = new Date().getFullYear();
