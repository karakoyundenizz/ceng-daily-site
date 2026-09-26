"use strict";

const TRACKS = {
  ALGO: "Algorithms",
  DS: "Data Structures",
  ARCH: "Computer Organization",
  OS: "Operating Systems",
};
// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

const STR = {
  en: {
    tracks: TRACKS,
    today: "Today", archive: "Archive", random: "Random",
    tldr: "TL;DR", keyPoints: "Key points", complexity: "Complexity & costs",
    cols: ["Operation", "Time", "Space", "Notes"],
    code: "Code", workedExample: "Worked example", showSolution: "Show solution",
    pitfalls: "Pitfalls", applications: "Where it's used",
    atMetu: "At METU",
    atMetuHint: "Drawn from the course slides, past exams and lab handouts in the corpus.",
    selfCheck: "Self-check", related: "Related topics", references: "References",
    sources: "Course material used",
    kinds: ["conceptual", "quantitative", "design / analysis"],
    minRead: (n) => `${n} min read`, generated: "Generated", pass: "pass",
    older: "Older", newer: "Newer", notCovered: "Not covered yet",
    archiveTitle: "Archive", count: (n) => `${n} card${n === 1 ? "" : "s"}`,
    all: "All", search: "Search titles…", noMatch: "No cards match.",
    loading: "Loading…", noCards: "No cards yet.", badDate: "Invalid date.",
    onlyEnglish: "This card has no Turkish version yet.",
  },
  tr: {
    tracks: { ALGO: "Algoritmalar", DS: "Veri Yapıları",
              ARCH: "Bilgisayar Organizasyonu", OS: "İşletim Sistemleri" },
    today: "Bugün", archive: "Arşiv", random: "Rastgele",
    tldr: "Özet", keyPoints: "Anahtar noktalar", complexity: "Karmaşıklık ve maliyetler",
    cols: ["İşlem", "Zaman", "Alan", "Notlar"],
    code: "Kod", workedExample: "Çözümlü örnek", showSolution: "Çözümü göster",
    pitfalls: "Sık yapılan hatalar", applications: "Nerede kullanılıyor",
    atMetu: "ODTÜ'de",
    atMetuHint: "Korpustaki ders slaytlarından, geçmiş sınavlardan ve lab dokümanlarından çıkarıldı.",
    selfCheck: "Kendini sına", related: "İlgili konular", references: "Kaynakça",
    sources: "Kullanılan ders materyali",
    kinds: ["kavramsal", "sayısal", "tasarım / analiz"],
    minRead: (n) => `${n} dk okuma`, generated: "Üretildi", pass: "tur",
    older: "Önceki", newer: "Sonraki", notCovered: "Henüz işlenmedi",
    archiveTitle: "Arşiv", count: (n) => `${n} kart`,
    all: "Hepsi", search: "Başlıklarda ara…", noMatch: "Eşleşen kart yok.",
    loading: "Yükleniyor…", noCards: "Henüz kart yok.", badDate: "Geçersiz tarih.",
    onlyEnglish: "Bu kartın henüz Türkçesi yok.",
  },
};

function readLang() {
  try {
    const saved = localStorage.getItem("ceng-daily-lang");
    if (saved === "tr" || saved === "en") return saved;
  } catch { /* private mode */ }
  return "tr";
}

let lang = readLang();
let T = STR[lang];

function setLang(next) {
  try { localStorage.setItem("ceng-daily-lang", next); } catch { /* private mode */ }
  location.reload();
}

/* The Turkish layer mirrors the card field for field; merge it over the English one
   so every renderer below can stay language-agnostic. */
function localized(card) {
  const tr = card.tr;
  if (lang !== "tr" || !tr) return card;
  return {
    ...card,
    title: tr.title,
    tagline: tr.tagline,
    tldr: tr.tldr,
    sections: tr.sections,
    complexity: (card.complexity || []).map((row, i) => ({
      ...row, notes: tr.complexity_notes?.[i] ?? row.notes })),
    code: card.code ? { ...card.code, caption: tr.code_caption ?? card.code.caption } : card.code,
    worked_example: tr.worked_example,
    pitfalls: tr.pitfalls,
    applications: tr.applications,
    exam_focus: tr.exam_focus,
    self_check: tr.self_check,
    key_points: tr.key_points,
  };
}
const LANG_ALIASES = { asm: "x86asm", assembly: "x86asm", "x86-64": "x86asm", gas: "x86asm", text: "plaintext", hcl: "plaintext", pseudocode: "plaintext" };

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------
// Markdown + KaTeX
// ---------------------------------------------------------------------------

function katexRender(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

function setupMarkdown() {
  marked.use({
    gfm: true,
    extensions: [
      {
        name: "blockMath",
        level: "block",
        start: (src) => src.match(/^\$\$/m)?.index,
        tokenizer(src) {
          const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
          if (m) return { type: "blockMath", raw: m[0], text: m[1].trim() };
        },
        renderer: (t) => katexRender(t.text, true),
      },
      {
        name: "inlineMath",
        level: "inline",
        start: (src) => src.indexOf("$") >= 0 ? src.indexOf("$") : undefined,
        tokenizer(src) {
          let m = /^\$\$([\s\S]+?)\$\$/.exec(src);
          if (m) return { type: "inlineMath", raw: m[0], text: m[1].trim(), display: true };
          m = /^\$((?:\\.|[^\\$\n])+?)\$/.exec(src);
          if (m) return { type: "inlineMath", raw: m[0], text: m[1].trim(), display: false };
        },
        renderer: (t) => katexRender(t.text, t.display),
      },
    ],
  });
}

const sanitize = (html) => DOMPurify.sanitize(html);
const md = (src) => sanitize(marked.parse(src || ""));
const mdInline = (src) => sanitize(marked.parseInline(src || ""));

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function postProcess(root) {
  root.querySelectorAll(".md table").forEach((table) => {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
  root.querySelectorAll("pre code").forEach((el) => {
    const lang = [...el.classList].find((c) => c.startsWith("language-"))?.slice(9);
    if (lang && LANG_ALIASES[lang]) el.className = `language-${LANG_ALIASES[lang]}`;
    const resolved = el.className.replace("language-", "");
    if (resolved && !hljs.getLanguage(resolved)) el.className = "language-plaintext";
    hljs.highlightElement(el);
  });
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const trackClass = (t) => `track-${String(t || "").toLowerCase()}`;
const fmtDate = (iso, opts) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", ...opts });
const slug = (s, i) => `s${i}-` + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

function renderCard(rawCard, index) {
  const card = localized(rawCard);
  const entries = index?.cards ?? [];
  const pos = entries.findIndex((c) => c.date === card.date);
  const newer = pos > 0 ? entries[pos - 1] : null;
  const older = pos >= 0 && pos < entries.length - 1 ? entries[pos + 1] : null;
  const words = card.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0);
  const minutes = Math.max(1, Math.round(words / 200));
  const sectionIds = card.sections.map((s, i) => slug(s.heading, i));

  document.title = `${card.title} · CENG Daily`;

  const toc = [
    ...card.sections.map((s, i) => [sectionIds[i], s.heading]),
    card.complexity?.length ? ["complexity", T.complexity] : null,
    card.code?.source ? ["code", T.code] : null,
    ["example", T.workedExample],
    card.exam_focus?.length ? ["at-metu", T.atMetu] : null,
    ["self-check", T.selfCheck],
  ].filter(Boolean);

  const coveredById = new Map(entries.map((c) => [c.id, c.date]));
  const related = (card.related_topics || []).map((r) => {
    const d = coveredById.get(r.id);
    const inner = `<span class="dot"></span>${escapeHtml(r.title)}`;
    return d
      ? `<a class="chip ${trackClass(r.track)}" href="?d=${d}">${inner}</a>`
      : `<span class="chip ${trackClass(r.track)}" title="${T.notCovered}">${inner}</span>`;
  });

  const codeLang = (card.code?.language || "plaintext").toLowerCase();

  app.innerHTML = `
    <article class="${trackClass(card.track)}">
      <header class="card-head">
        <div class="meta">
          <span class="badge">${escapeHtml(card.track)}</span>
          <span>${escapeHtml(card.course)} · ${escapeHtml(T.tracks[card.track] || card.track_name || "")}</span>
          <span>${fmtDate(card.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          <span>${T.minRead(minutes)}</span>
        </div>
        <h1>${escapeHtml(card.title)}</h1>
        <p class="tagline">${escapeHtml(card.tagline)}</p>
        <ul class="toc">${toc.map(([id, label]) => `<li><a href="#${id}">${escapeHtml(label)}</a></li>`).join("")}</ul>
      </header>

      <section class="block tldr"><h2>${T.tldr}</h2><div class="md">${md(card.tldr)}</div></section>

      <section class="block keypoints"><h2>${T.keyPoints}</h2>
        <ul>${card.key_points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </section>

      ${card.sections.map((s, i) => `
        <section class="block prose" id="${sectionIds[i]}">
          <h2>${escapeHtml(s.heading)}</h2>
          <div class="md">${md(s.body)}</div>
        </section>`).join("")}

      ${card.complexity?.length ? `
        <section class="block" id="complexity"><h2>${T.complexity}</h2>
          <div class="table-wrap"><table>
            <thead><tr>${T.cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
            <tbody>${card.complexity.map((r) => `
              <tr><td>${mdInline(r.operation)}</td><td>${mdInline(r.time)}</td><td>${mdInline(r.space)}</td><td>${mdInline(r.notes)}</td></tr>`).join("")}
            </tbody>
          </table></div>
        </section>` : ""}

      ${card.code?.source ? `
        <section class="block" id="code"><h2>${T.code} · ${escapeHtml(codeLang)}</h2>
          <figure class="code">
            <pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(card.code.source)}</code></pre>
            <figcaption class="md">${mdInline(card.code.caption)}</figcaption>
          </figure>
        </section>` : ""}

      <section class="block" id="example"><h2>${T.workedExample}</h2>
        <div class="md">${md(card.worked_example.problem)}</div>
        <details><summary>${T.showSolution}</summary><div class="md answer">${md(card.worked_example.solution)}</div></details>
      </section>

      <section class="block"><h2>${T.pitfalls}</h2>
        <ul class="md">${card.pitfalls.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
      </section>

      <section class="block"><h2>${T.applications}</h2>
        <ul class="md">${card.applications.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
      </section>

      ${card.exam_focus?.length ? `
        <section class="block metu" id="at-metu"><h2>${T.atMetu}</h2>
          <p class="hint">${T.atMetuHint}</p>
          <ul class="md">${card.exam_focus.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
        </section>` : ""}

      <section class="block" id="self-check"><h2>${T.selfCheck}</h2>
        ${card.self_check.map((q, i) => `
          <details>
            <summary><span class="md">${mdInline(q.question)}</span><span class="q-kind">${T.kinds[i] || ""}</span></summary>
            <div class="md answer">${md(q.answer)}</div>
          </details>`).join("")}
      </section>

      ${related.length ? `<section class="block"><h2>${T.related}</h2><div class="chips">${related.join("")}</div></section>` : ""}

      <section class="block"><h2>${T.references}</h2>
        <ul class="refs">${card.references.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </section>

      ${card.sources?.length ? `
        <section class="block"><h2>${T.sources}</h2>
          <ul class="refs sources">${card.sources.map((s) => `
            <li><span class="kind">${escapeHtml((s.kind || "").replace(/_/g, " "))}</span>${escapeHtml(s.citation)}</li>`).join("")}</ul>
        </section>` : ""}

      <nav class="pager">
        ${older ? `<a href="?d=${older.date}">← ${fmtDate(older.date, { day: "numeric", month: "short" })}</a>` : `<span>← ${T.older}</span>`}
        ${newer ? `<a class="next" href="?d=${newer.date}">${fmtDate(newer.date, { day: "numeric", month: "short" })} →</a>` : `<span class="next">${T.newer} →</span>`}
      </nav>
      <p class="gen">${T.generated} ${escapeHtml(card.generated?.at?.slice(0, 10) || "")} · ${escapeHtml(card.generated?.model || "")}${card.generated?.pass > 1 ? ` · ${T.pass} ${card.generated.pass}` : ""}${lang === "tr" && !rawCard.tr ? ` · ${escapeHtml(T.onlyEnglish)}` : ""}</p>
    </article>`;

  postProcess(app);
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// ---------------------------------------------------------------------------
// Archive view
// ---------------------------------------------------------------------------

function renderArchive(index) {
  document.title = `${T.archiveTitle} · CENG Daily`;
  const cards = index.cards;
  const counts = Object.fromEntries(Object.keys(TRACKS).map((t) => [t, cards.filter((c) => c.track === t).length]));
  let filter = params.get("track") || "ALL";
  let query = "";

  app.innerHTML = `
    <div class="archive-head">
      <h1>${T.archiveTitle}</h1>
      <p>${T.count(cards.length)} ·${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(" · ")}</p>
    </div>
    <div class="filters">
      ${["ALL", ...Object.keys(TRACKS)].map((t) => `<button type="button" class="${t === "ALL" ? "" : trackClass(t)}" data-track="${t}">${t === "ALL" ? T.all : t}</button>`).join("")}
      <input type="search" placeholder="${escapeHtml(T.search)}" aria-label="${escapeHtml(T.search)}">
    </div>
    <div id="list"></div>`;

  const list = app.querySelector("#list");
  const draw = () => {
    app.querySelectorAll(".filters button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.track === filter)));
    const q = query.toLowerCase();
    const shown = cards.filter((c) => (filter === "ALL" || c.track === filter) &&
      (!q || `${c.title} ${c.tagline} ${c.id}`.toLowerCase().includes(q)));
    let month = "";
    list.innerHTML = shown.map((c) => {
      const m = fmtDate(c.date, { month: "long", year: "numeric" });
      const head = m !== month ? `<div class="month">${m}</div>` : "";
      month = m;
      return `${head}
        <a class="entry ${trackClass(c.track)}" href="?d=${c.date}">
          <div class="day">${fmtDate(c.date, { day: "numeric" })}<small>${fmtDate(c.date, { weekday: "short" })}</small></div>
          <div><div class="t"><span class="badge">${c.track}</span> ${escapeHtml(c.title)}</div><div class="s">${escapeHtml(c.tagline)}</div></div>
        </a>`;
    }).join("") || `<p class="status">${T.noMatch}</p>`;
  };

  app.querySelector(".filters").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { filter = b.dataset.track; draw(); }
  });
  app.querySelector("input").addEventListener("input", (e) => { query = e.target.value; draw(); });
  draw();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function showError(msg) {
  app.innerHTML = `<p class="status">${escapeHtml(msg)}</p>`;
}

function setupChrome() {
  document.documentElement.lang = lang;
  const nav = document.querySelector(".topbar nav");
  if (nav) {
    const [today, archive, random] = nav.querySelectorAll("a");
    if (today) today.textContent = T.today;
    if (archive) archive.textContent = T.archive;
    if (random) random.textContent = T.random;
  }
  const toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.textContent = lang === "tr" ? "EN" : "TR";
    toggle.title = lang === "tr" ? "Read in English" : "Türkçe oku";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      setLang(lang === "tr" ? "en" : "tr");
    });
  }
}

async function main() {
  setupMarkdown();
  setupChrome();
  let index = { cards: [] };
  try {
    index = await getJSON("data/index.json");
  } catch (e) {
    return showError(T.noCards);
  }

  document.getElementById("random-link").addEventListener("click", (e) => {
    e.preventDefault();
    const pick = index.cards[Math.floor(Math.random() * index.cards.length)];
    if (pick) location.href = `?d=${pick.date}`;
  });

  try {
    if (params.get("view") === "archive") return renderArchive(index);
    const d = params.get("d");
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return showError(T.badDate);
    const card = await getJSON(d ? `data/days/${d}.json` : "data/latest.json");
    renderCard(card, index);
  } catch (e) {
    console.error(e);
    showError(`Could not load card: ${e.message}`);
  }
}

document.addEventListener("DOMContentLoaded", main);
