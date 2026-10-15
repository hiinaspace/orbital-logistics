import { readFileSync } from "node:fs";

type Exchange = {
  id: string;
  owner: string[];
  summary: string;
  omission?: string;
};
type Chapter = { id: string; title: string; exchanges: Exchange[] };
type Transcript = { title: string; chapters: Chapter[] };
export const transcriptPath = new URL(
  "../docs/build-log/transcript.json",
  import.meta.url,
);
const read = () =>
  JSON.parse(readFileSync(transcriptPath, "utf8")) as Transcript;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// Only HTTP(S) links are interpreted; quoted prompts can never inject HTML.
function inline(text: string) {
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"`]+)/g;
  let html = "",
    offset = 0;
  for (const match of text.matchAll(pattern)) {
    html += escape(text.slice(offset, match.index));
    const url = (match[2] ?? match[3]).replace(/[.,;]+$/, "");
    html += `<a href="${escape(url)}">${escape(match[1] ?? url)}</a>`;
    if (!match[2]) html += escape(match[3].slice(url.length));
    offset = match.index! + match[0].length;
  }
  return html + escape(text.slice(offset));
}

export function transcriptHTML() {
  const { chapters } = read();
  const ids = new Set<string>();
  for (const chapter of chapters)
    for (const e of chapter.exchanges) {
      if (
        !/^prompt-\d{3}$/.test(e.id) ||
        ids.has(e.id) ||
        !e.owner.length ||
        !e.summary.trim()
      )
        throw Error("Invalid transcript exchange: " + e.id);
      ids.add(e.id);
    }
  return (
    `<nav class="chapter-index" aria-label="Transcript chapters"><h2>Contents</h2><ol>${chapters.map((c) => `<li><a href="#${escape(c.id)}">${escape(c.title)}</a> <span>${c.exchanges.length} exchanges</span></li>`).join("")}</ol></nav>` +
    chapters
      .map(
        (c) =>
          `<section id="${escape(c.id)}" aria-labelledby="${escape(c.id)}-heading"><h2 id="${escape(c.id)}-heading">${escape(c.title)}</h2>${c.exchanges
            .map(
              (e) =>
                `<article class="exchange" id="${escape(e.id)}"><h3><a href="#${escape(e.id)}" aria-label="Link to exchange ${Number(e.id.slice(7))}">#${e.id.slice(7)}</a> Hiina</h3><blockquote>${e.owner
                  .map((text) =>
                    text
                      .split(/\n\s*\n/)
                      .map((p) => `<p>${inline(p)}</p>`)
                      .join(""),
                  )
                  .join(
                    "",
                  )}</blockquote>${e.omission ? `<p class="editorial-note">${escape(e.omission)}</p>` : ""}<p class="summary-label">Codex · condensed</p><p>${escape(e.summary)}</p></article>`,
            )
            .join("")}</section>`,
      )
      .join("")
  );
}

export function transcriptMarkdown() {
  const { title, chapters } = read();
  return (
    `# ${title}\n\nOrbital Logistics — implementation conversation, October 2026.\n\nOwner messages are quoted, including typos. Codex implementation summaries are retrospective condensations. Environment troubleshooting and personal operational passages are omitted; partial-message omissions are noted.\n\n` +
    chapters
      .map(
        (c) =>
          `## ${c.title}\n\n` +
          c.exchanges
            .map(
              (e) =>
                `### #${e.id.slice(7)} — Hiina\n\n${e.owner
                  .map((t) =>
                    t
                      .split("\n")
                      .map((line) => "> " + line)
                      .join("\n"),
                  )
                  .join(
                    "\n>\n",
                  )}\n\n${e.omission ? `*${e.omission}*\n\n` : ""}**Codex · condensed**\n\n${e.summary}\n\n`,
            )
            .join(""),
      )
      .join("\n")
  );
}
