import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

const POLISH: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&#39;": "'", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
};

/** Decode the handful of HTML entities that survive in titles of real pages. */
function decodeEntities(s: string): string {
  return s
    .replace(
      /&nbsp;|&amp;|&lt;|&gt;|&quot;|&apos;|&#39;|&hellip;|&mdash;|&ndash;/g,
      (m) => NAMED_ENTITIES[m] ?? m,
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Decode entities, collapse whitespace, drop spaces before punctuation, and trim. */
export function normalizeText(raw: string): string {
  return decodeEntities(raw)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

/** Markers whose appearance in the LAST ~40% of the text starts the tail to drop. */
const TAIL_MARKERS = ["Literatura", "Bibliografia", "Przypisy", "Tagi:"];

/**
 * Strip boilerplate that survives in the plain text: a leading reading-time
 * prefix, inline "Przeczytaj też:" callouts, and the bibliography/tags tail.
 * The tail cut only fires when the marker sits in the back of the text, so an
 * early mention of e.g. "literatura" in prose is left untouched.
 */
export function trimBoilerplateText(text: string): string {
  let out = text;

  // Leading "Przewidywany czas: N min".
  out = out.replace(/^\s*Przewidywany czas:\s*\d+\s*min\s*/i, "");

  // Inline "Przeczytaj też: …" up to (and including) the end of that sentence.
  out = out.replace(/\s*Przeczytaj też:[^.!?]*[.!?]?/gi, " ");

  // Tail cut: earliest tail marker that lands in the last 40% of the text.
  const threshold = out.length * 0.6;
  let cut = -1;
  for (const marker of TAIL_MARKERS) {
    const re = new RegExp(`\\b${marker.replace(/[:]/g, "\\$&")}`, "i");
    const m = re.exec(out);
    if (m && m.index >= threshold && (cut === -1 || m.index < cut)) {
      cut = m.index;
    }
  }
  if (cut !== -1) out = out.slice(0, cut);

  return out.replace(/\s+/g, " ").trim();
}

/** Build a URL-safe ascii slug from a (possibly Polish) title. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => POLISH[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug || "artykul";
}

/** Return `base`, or `base-2`, `base-3`… until it does not clash with `existing`. */
export function uniqueId(base: string, existing: string[]): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Boilerplate containers to delete before Readability runs. Mostly specific to
 * naukatolubie.pl (the primary source); `#ez-toc-container` is the generic
 * WordPress "Easy Table of Contents" plugin. Extend as new sources appear.
 */
export const BOILERPLATE_SELECTORS = [
  "#ez-toc-container", // spis treści (plugin ez-toc)
  ".ntl-reading-time", // "Przewidywany czas: N min"
  ".ntl-authorbox", // bio autora
];

/** Remove known boilerplate blocks from the document in place. */
export function stripBoilerplate(document: Document): void {
  for (const selector of BOILERPLATE_SELECTORS) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      el.remove();
    }
  }
}

export interface ExtractedArticle {
  title: string;
  text: string;
}

/** Extract the main article title and body text from a full HTML page. */
export function extractArticle(html: string, url: string): ExtractedArticle {
  // A bare VirtualConsole with no listeners swallows jsdom's noisy CSS/resource
  // parse errors that real-world pages routinely trigger.
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  const parsed = new Readability(dom.window.document).parse();
  const text = parsed ? normalizeText(parsed.textContent ?? "") : "";
  if (!text) {
    throw new Error(
      "Nie udało się wyodrębnić treści artykułu z tej strony. Sprawdź link.",
    );
  }
  const title = normalizeText(parsed?.title ?? "") || dom.window.document.title || url;
  return { title, text };
}
