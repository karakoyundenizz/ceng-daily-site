"use strict";

const TRACKS = {
  ALGO: "Algorithms",
  DS: "Data Structures",
  ARCH: "Computer Organization",
  OS: "Operating Systems",
};
const QUESTION_KINDS = ["conceptual", "quantitative", "design / analysis"];
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
const fmtDate = (iso, opts) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
const slug = (s, i) => `s${i}-` + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

function renderCard(card, index) {
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
    card.complexity?.length ? ["complexity", "Complexity"] : null,
    card.code?.source ? ["code", "Code"] : null,
    ["example", "Worked example"],
    card.exam_focus?.length ? ["at-metu", "At METU"] : null,
    ["self-check", "Self-check"],
  ].filter(Boolean);

  const coveredById = new Map(entries.map((c) => [c.id, c.date]));
  const related = (card.related_topics || []).map((r) => {
    const d = coveredById.get(r.id);
    const inner = `<span class="dot"></span>${escapeHtml(r.title)}`;
    return d
      ? `<a class="chip ${trackClass(r.track)}" href="?d=${d}">${inner}</a>`
      : `<span class="chip ${trackClass(r.track)}" title="Not covered yet">${inner}</span>`;
  });

  const lang = (card.code?.language || "plaintext").toLowerCase();

  app.innerHTML = `
    <article class="${trackClass(card.track)}">
      <header class="card-head">
        <div class="meta">
          <span class="badge">${escapeHtml(card.track)}</span>
          <span>${escapeHtml(card.course)} · ${escapeHtml(card.track_name || TRACKS[card.track] || "")}</span>
          <span>${fmtDate(card.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          <span>${minutes} min read</span>
        </div>
        <h1>${escapeHtml(card.title)}</h1>
        <p class="tagline">${escapeHtml(card.tagline)}</p>
        <ul class="toc">${toc.map(([id, label]) => `<li><a href="#${id}">${escapeHtml(label)}</a></li>`).join("")}</ul>
      </header>

      <section class="block tldr"><h2>TL;DR</h2><div class="md">${md(card.tldr)}</div></section>

      <section class="block keypoints"><h2>Key points</h2>
        <ul>${card.key_points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </section>

      ${card.sections.map((s, i) => `
        <section class="block prose" id="${sectionIds[i]}">
          <h2>${escapeHtml(s.heading)}</h2>
          <div class="md">${md(s.body)}</div>
        </section>`).join("")}

      ${card.complexity?.length ? `
        <section class="block" id="complexity"><h2>Complexity & costs</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Operation</th><th>Time</th><th>Space</th><th>Notes</th></tr></thead>
            <tbody>${card.complexity.map((r) => `
              <tr><td>${mdInline(r.operation)}</td><td>${mdInline(r.time)}</td><td>${mdInline(r.space)}</td><td>${mdInline(r.notes)}</td></tr>`).join("")}
            </tbody>
          </table></div>
        </section>` : ""}

      ${card.code?.source ? `
        <section class="block" id="code"><h2>Code · ${escapeHtml(lang)}</h2>
          <figure class="code">
            <pre><code class="language-${escapeHtml(lang)}">${escapeHtml(card.code.source)}</code></pre>
            <figcaption class="md">${mdInline(card.code.caption)}</figcaption>
          </figure>
        </section>` : ""}

      <section class="block" id="example"><h2>Worked example</h2>
        <div class="md">${md(card.worked_example.problem)}</div>
        <details><summary>Show solution</summary><div class="md answer">${md(card.worked_example.solution)}</div></details>
      </section>

      <section class="block"><h2>Pitfalls</h2>
        <ul class="md">${card.pitfalls.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
      </section>

      <section class="block"><h2>Where it's used</h2>
        <ul class="md">${card.applications.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
      </section>

      ${card.exam_focus?.length ? `
        <section class="block metu" id="at-metu"><h2>At METU</h2>
          <p class="hint">Drawn from the course slides, past exams and lab handouts in the corpus.</p>
          <ul class="md">${card.exam_focus.map((p) => `<li>${mdInline(p)}</li>`).join("")}</ul>
        </section>` : ""}

      <section class="block" id="self-check"><h2>Self-check</h2>
        ${card.self_check.map((q, i) => `
          <details>
            <summary><span class="md">${mdInline(q.question)}</span><span class="q-kind">${QUESTION_KINDS[i] || ""}</span></summary>
            <div class="md answer">${md(q.answer)}</div>
          </details>`).join("")}
      </section>

      ${related.length ? `<section class="block"><h2>Related topics</h2><div class="chips">${related.join("")}</div></section>` : ""}

      <section class="block"><h2>References</h2>
        <ul class="refs">${card.references.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </section>

      ${card.sources?.length ? `
        <section class="block"><h2>Course material used</h2>
          <ul class="refs sources">${card.sources.map((s) => `
            <li><span class="kind">${escapeHtml((s.kind || "").replace(/_/g, " "))}</span>${escapeHtml(s.citation)}</li>`).join("")}</ul>
        </section>` : ""}

      <nav class="pager">
        ${older ? `<a href="?d=${older.date}">← ${fmtDate(older.date, { day: "numeric", month: "short" })}</a>` : "<span>← Older</span>"}
        ${newer ? `<a class="next" href="?d=${newer.date}">${fmtDate(newer.date, { day: "numeric", month: "short" })} →</a>` : `<span class="next">Newer →</span>`}
      </nav>
      <p class="gen">Generated ${escapeHtml(card.generated?.at?.slice(0, 10) || "")} · ${escapeHtml(card.generated?.model || "")}${card.generated?.pass > 1 ? ` · pass ${card.generated.pass}` : ""}</p>
    </article>`;

  postProcess(app);
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// ---------------------------------------------------------------------------
// Archive view
// ---------------------------------------------------------------------------

function renderArchive(index) {
  document.title = "Archive · CENG Daily";
  const cards = index.cards;
  const counts = Object.fromEntries(Object.keys(TRACKS).map((t) => [t, cards.filter((c) => c.track === t).length]));
  let filter = params.get("track") || "ALL";
  let query = "";

  app.innerHTML = `
    <div class="archive-head">
      <h1>Archive</h1>
      <p>${cards.length} card${cards.length === 1 ? "" : "s"} ·${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(" · ")}</p>
    </div>
    <div class="filters">
      ${["ALL", ...Object.keys(TRACKS)].map((t) => `<button type="button" class="${t === "ALL" ? "" : trackClass(t)}" data-track="${t}">${t === "ALL" ? "All" : t}</button>`).join("")}
      <input type="search" placeholder="Search titles…" aria-label="Search titles">
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
    }).join("") || `<p class="status">No cards match.</p>`;
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

async function main() {
  setupMarkdown();
  let index = { cards: [] };
  try {
    index = await getJSON("data/index.json");
  } catch (e) {
    return showError("No cards yet. Run the GitHub Action once to generate the first card.");
  }

  document.getElementById("random-link").addEventListener("click", (e) => {
    e.preventDefault();
    const pick = index.cards[Math.floor(Math.random() * index.cards.length)];
    if (pick) location.href = `?d=${pick.date}`;
  });

  try {
    if (params.get("view") === "archive") return renderArchive(index);
    const d = params.get("d");
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return showError("Invalid date.");
    const card = await getJSON(d ? `data/days/${d}.json` : "data/latest.json");
    renderCard(card, index);
  } catch (e) {
    console.error(e);
    showError(`Could not load card: ${e.message}`);
  }
}

document.addEventListener("DOMContentLoaded", main);
