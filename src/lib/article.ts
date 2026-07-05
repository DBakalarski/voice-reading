import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { PartInfo } from "./types";

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

/** Pick a base id whose derived `-cz-N` part family does not collide with any
 *  existing id. `uniqueId` only protects the base string itself, which is never
 *  an id in the multi-part case, so the family must be checked as a whole. */
export function uniquePartBase(base: string, partCount: number, existing: string[]): string {
  const taken = new Set(existing);
  const familyFree = (b: string): boolean =>
    Array.from({ length: partCount }, (_, i) => `${b}-cz-${i + 1}`).every((id) => !taken.has(id));
  if (familyFree(base)) return base;
  let n = 2;
  while (!familyFree(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Split normalized text into sentences, keeping the terminator attached.
 *  Text is already single-spaced, so we break on whitespace that follows
 *  a sentence-ending mark. */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).filter((s) => s.length > 0);
}

/** Last-resort split for a single sentence longer than maxChars: pack whole
 *  words up to the cap. (Real article prose has no word this long.) */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const pieces: string[] = [];
  let current = "";
  for (const word of sentence.split(" ")) {
    if (current === "") current = word;
    else if (current.length + 1 + word.length <= maxChars) current += " " + word;
    else {
      pieces.push(current);
      current = word;
    }
  }
  if (current !== "") pieces.push(current);
  return pieces;
}

/**
 * Split text into chunks no larger than `maxChars`, breaking only at sentence
 * boundaries. Returns `[text]` unchanged when it already fits. Parts are
 * balanced: the part count is minimized, then sentences are packed toward an
 * even target size.
 */
export function chunkText(text: string, maxChars = 9000): string[] {
  if (text.length <= maxChars) return [text];

  const parts = Math.ceil(text.length / maxChars);
  const target = Math.ceil(text.length / parts);

  const chunks: string[] = [];
  let current = "";
  for (const sentence of splitSentences(text)) {
    for (const piece of splitLongSentence(sentence, maxChars)) {
      if (current === "") current = piece;
      else if (current.length + 1 + piece.length <= target) current += " " + piece;
      else {
        chunks.push(current);
        current = piece;
      }
    }
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

/**
 * Boilerplate containers to delete before Readability runs. Covers
 * naukatolubie.pl (`.ntl-*`, the WordPress ez-toc plugin) and zero.pl
 * (lead-image caption + photo credit, ad slots, source line). Extend as new
 * sources appear.
 */
export const BOILERPLATE_SELECTORS = [
  "#ez-toc-container", // spis treści (plugin ez-toc)
  ".ntl-reading-time", // "Przewidywany czas: N min"
  ".ntl-authorbox", // bio autora
  "figure.post-thumbnail", // zero.pl zdjęcie wiodące (podtytuł + podpis "Fot. …")
  "figcaption", // podpisy pod zdjęciami (podpis + źródło fotografii)
  ".sources", // zero.pl "Źródło: …"
  ".ad-slot-wrapper", // zero.pl sloty reklamowe ("Reklama")
];

/** Leading text of a callout/attribution paragraph to drop wholesale. */
const CALLOUT_PREFIXES = ["przeczytaj też", "przeczytaj także", "tekst ukazał się"];

/** Remove known boilerplate blocks from the document in place. */
export function stripBoilerplate(document: Document): void {
  for (const selector of BOILERPLATE_SELECTORS) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      el.remove();
    }
  }

  // Remove "Przeczytaj też/także: …" callouts and "Tekst ukazał się w …"
  // self-promo attributions (including multi-sentence ones whose link text
  // contains additional periods) before Readability runs. We restrict the
  // query to leaf-ish containers so we never accidentally remove a large
  // ancestor.
  for (const el of Array.from(document.querySelectorAll("p, li, aside, blockquote"))) {
    const text = el.textContent?.trim().toLowerCase() ?? "";
    if (CALLOUT_PREFIXES.some((prefix) => text.startsWith(prefix))) {
      el.remove();
    }
  }
}

/** Block-level tags whose text must not run into the next block's text.
 *  `textContent` concatenates blocks with no separator, fusing e.g. a heading
 *  into the following paragraph ("…Polaków.Kult banderowski…"). */
const BLOCK_TAGS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, figure, figcaption";

/** Append a space after every block element so `textContent` keeps word
 *  boundaries at block edges. Run before Readability; the trailing spaces are
 *  collapsed away later by `normalizeText`. */
export function separateBlocks(document: Document): void {
  for (const el of Array.from(document.querySelectorAll(BLOCK_TAGS))) {
    el.appendChild(document.createTextNode(" "));
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
  stripBoilerplate(dom.window.document);
  separateBlocks(dom.window.document);
  const parsed = new Readability(dom.window.document).parse();
  const text = parsed ? trimBoilerplateText(normalizeText(parsed.textContent ?? "")) : "";
  if (!text) {
    throw new Error(
      "Nie udało się wyodrębnić treści artykułu z tej strony. Sprawdź link.",
    );
  }
  const title = normalizeText(parsed?.title ?? "") || dom.window.document.title || url;
  return { title, text };
}

/** Turn chunked article text into content items. One chunk stays a plain,
 *  unnumbered item; multiple chunks become numbered parts that chain via
 *  `nextId`. */
export function buildArticleParts(
  baseId: string,
  title: string,
  chunks: string[],
): Array<{ id: string; title: string; text: string; part?: PartInfo }> {
  if (chunks.length === 1) {
    return [{ id: baseId, title, text: chunks[0] }];
  }
  const total = chunks.length;
  const ids = chunks.map((_, i) => `${baseId}-cz-${i + 1}`);
  return chunks.map((text, i) => ({
    id: ids[i],
    title: `${title} (część ${i + 1})`,
    text,
    part: { index: i + 1, total, nextId: i + 1 < total ? ids[i + 1] : undefined },
  }));
}
