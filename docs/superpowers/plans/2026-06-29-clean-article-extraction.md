# Czysta ekstrakcja artykułów Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usunąć z importowanych artykułów spis treści, czas czytania, callouty „Przeczytaj też", bibliografię, tagi i bio autora — tak by tekst czytany na głos zawierał tylko treść.

**Architecture:** Hybryda. Etap DOM: nowa `stripBoilerplate(document)` usuwa elementy o znanych selektorach z dokumentu jsdom zanim Readability wyodrębni treść. Etap tekstu: nowa `trimBoilerplateText(text)` obcina ogon (od `Literatura`/`Bibliografia`/`Tagi:` w ostatnich 40% tekstu), linię `Przeczytaj też:` i prefiks `Przewidywany czas`. Oba etapy wpięte w `extractArticle`. Na końcu retrofit 2 istniejących artykułów + regeneracja audio.

**Tech Stack:** TypeScript, jsdom, @mozilla/readability, vitest, tsx, ElevenLabs SDK.

## Global Constraints

- Język UI/treści: polski; tekst wyjściowy musi pozostać poprawnym, czytelnym na głos polskim (bez ucinania w połowie zdania tam, gdzie da się tego uniknąć).
- `extractArticle(html, url)` musi zachować dotychczasowy kontrakt: zwraca `{ title, text }`, rzuca `Error` z komunikatem zawierającym „tre…", gdy brak treści.
- Istniejące testy w `src/lib/article.test.ts` muszą pozostać zielone.
- Komenda testów: `npm test` (vitest run). Środowisko testów dla article: `// @vitest-environment node` na górze pliku.
- Selektory boilerplate trzymane w jednej nazwanej stałej, łatwej do rozszerzenia.
- Markery ogona dopasowywane bez rozróżniania wielkości liter, jako granice słów.
- Guard obcinania ogona: marker brany pod uwagę tylko jeśli jego indeks ≥ 60% długości tekstu (czyli pada w ostatnich ~40%).
- Każdy commit kończy się stopką `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `trimBoilerplateText` — obcinanie ogona i fraz w tekście

**Files:**
- Modify: `src/lib/article.ts` (dodać eksport `trimBoilerplateText`, między `normalizeText` a `slugify`)
- Test: `src/lib/article.test.ts` (nowy blok `describe("trimBoilerplateText", …)`)

**Interfaces:**
- Consumes: nic z wcześniejszych zadań.
- Produces: `export function trimBoilerplateText(text: string): string` — przyjmuje znormalizowany (po `normalizeText`) jednoliniowy tekst, zwraca tekst bez ogona/fraz boilerplate. Używana przez `extractArticle` w Tasku 3.

- [ ] **Step 1: Write the failing tests**

W `src/lib/article.test.ts` dodać import i blok testów. Zmienić linię importu na:

```ts
import {
  extractArticle,
  normalizeText,
  slugify,
  trimBoilerplateText,
  uniqueId,
} from "./article";
```

Dodać blok (np. po `describe("normalizeText", …)`):

```ts
describe("trimBoilerplateText", () => {
  // długi korpus, żeby marker w ostatnich 40% wyzwolił obcięcie
  const body =
    "Sen jest jedną z najważniejszych potrzeb organizmu. " +
    "W trakcie snu mózg porządkuje wspomnienia i utrwala wiedzę. " +
    "Dorosły człowiek powinien spać od siedmiu do dziewięciu godzin. " +
    "Regularny rytm snu pomaga zachować zdrowie przez długie lata.";

  it("cuts the tail from 'Literatura' onward", () => {
    const input = `${body} Literatura Walker M. Dlaczego śpimy. Marginesy 2017.`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("cuts the tail from 'Tagi:' onward", () => {
    const input = `${body} Tagi: sen, mózg, zdrowie`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("cuts the tail from 'Bibliografia' onward", () => {
    const input = `${body} Bibliografia Kalat J.W. Biologiczne podstawy psychologii.`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("removes a 'Przeczytaj też:' sentence", () => {
    const input = `${body} Przeczytaj też: Mózg a emocje. ${body}`;
    expect(trimBoilerplateText(input)).toBe(`${body} ${body}`);
  });

  it("removes a leading 'Przewidywany czas' prefix", () => {
    const input = `Przewidywany czas: 5 min ${body}`;
    expect(trimBoilerplateText(input)).toBe(body);
  });

  it("does NOT cut when the marker word appears early in the text", () => {
    const input = `Literatura piękna bywa tematem snu. ${body}`;
    expect(trimBoilerplateText(input)).toBe(input);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/article.test.ts`
Expected: FAIL — `trimBoilerplateText is not a function` (lub błąd importu).

- [ ] **Step 3: Implement `trimBoilerplateText`**

W `src/lib/article.ts`, po funkcji `normalizeText` (przed `slugify`), dodać:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/article.test.ts`
Expected: PASS — wszystkie testy `trimBoilerplateText` zielone; istniejące również.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article.ts src/lib/article.test.ts
git commit -m "feat(article): trimBoilerplateText strips reading-time, refs, tags tail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `stripBoilerplate` — usuwanie bloków DOM przed Readability

**Files:**
- Modify: `src/lib/article.ts` (dodać `BOILERPLATE_SELECTORS` i `stripBoilerplate`, przed `extractArticle`)
- Test: `src/lib/article.test.ts` (nowy blok `describe("stripBoilerplate", …)`)

**Interfaces:**
- Consumes: nic.
- Produces: `export function stripBoilerplate(document: Document): void` — usuwa (mutuje) z dokumentu elementy pasujące do `BOILERPLATE_SELECTORS`. Wywoływana przez `extractArticle` w Tasku 3. `BOILERPLATE_SELECTORS: string[]`.

- [ ] **Step 1: Write the failing test**

W `src/lib/article.test.ts` dodać import `JSDOM` na górze (po istniejących importach):

```ts
import { JSDOM } from "jsdom";
```

i dodać blok:

```ts
describe("stripBoilerplate", () => {
  it("removes TOC, reading-time and author-box elements, keeps the article", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div class="ntl-reading-time">Przewidywany czas: 5 min</div>
      <div id="ez-toc-container" class="ez-toc-container-direction">
        <p>Spis treści</p><ul><li>Co to jest sen?</li></ul>
      </div>
      <article><p>Treść artykułu o śnie.</p></article>
      <div class="ntl-authorbox">Autor Joanna Śliwowska — biolog.</div>
    </body></html>`);
    stripBoilerplate(dom.window.document);
    const html = dom.window.document.body.innerHTML;
    expect(html).toContain("Treść artykułu o śnie.");
    expect(html).not.toContain("Spis treści");
    expect(html).not.toContain("Przewidywany czas");
    expect(html).not.toContain("Joanna Śliwowska");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/article.test.ts`
Expected: FAIL — `stripBoilerplate is not defined`.

- [ ] **Step 3: Implement `stripBoilerplate`**

W `src/lib/article.ts`, przed `extractArticle`, dodać:

```ts
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
```

Uwaga: `Document` to typ DOM dostępny globalnie w TS (lib.dom). Jsdom-owe `document` jest z nim zgodne strukturalnie.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/article.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article.ts src/lib/article.test.ts
git commit -m "feat(article): stripBoilerplate removes TOC/reading-time/author DOM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wpięcie obu etapów w `extractArticle`

**Files:**
- Modify: `src/lib/article.ts:59-72` (funkcja `extractArticle`)
- Test: `src/lib/article.test.ts` (rozszerzyć blok `describe("extractArticle", …)`)

**Interfaces:**
- Consumes: `stripBoilerplate(document)` (Task 2), `trimBoilerplateText(text)` (Task 1).
- Produces: `extractArticle` o niezmienionej sygnaturze `(html, url) => { title, text }`, ale zwracający tekst już bez boilerplate.

- [ ] **Step 1: Write the failing end-to-end test**

Do bloku `describe("extractArticle", …)` w `src/lib/article.test.ts` dodać nowy fixture i test (obok istniejących):

```ts
  const dirtyHtml = `<!DOCTYPE html><html><head><title>Po co nam sen — Nauka To Lubię</title></head>
  <body>
    <article>
      <div class="ntl-reading-time">Przewidywany czas: 5 min</div>
      <h1>Po co nam sen</h1>
      <div id="ez-toc-container" class="ez-toc-container-direction"><p>Spis treści</p><ul><li>Co to jest sen?</li><li>Po co nam sen?</li></ul></div>
      <p>Sen jest jedną z najważniejszych potrzeb naszego organizmu i pełni wiele kluczowych funkcji. W trakcie snu mózg porządkuje wspomnienia z całego dnia oraz utrwala nowo zdobytą wiedzę i umiejętności.</p>
      <p>Brak odpowiedniej ilości snu prowadzi do problemów z koncentracją oraz osłabienia odporności. Dorosły człowiek powinien spać od siedmiu do dziewięciu godzin na dobę, aby zachować zdrowie fizyczne i psychiczne.</p>
      <p><strong>Literatura</strong> Walker M. Dlaczego śpimy. Marginesy 2017. Kalat J.W. Biologiczne podstawy psychologii. PWN 2020.</p>
      <div class="ntl-authorbox">Autor Joanna Śliwowska — z wykształcenia biolog.</div>
    </article>
  </body></html>`;

  it("strips reading-time, TOC, bibliography and author box", () => {
    const { text } = extractArticle(dirtyHtml, "https://naukatolubie.pl/po-co-nam-sen/");
    expect(text).toContain("Sen jest jedną z najważniejszych potrzeb");
    expect(text).toContain("siedmiu do dziewięciu godzin");
    expect(text).not.toContain("Przewidywany czas");
    expect(text).not.toContain("Spis treści");
    expect(text).not.toContain("Walker M.");
    expect(text).not.toContain("Joanna Śliwowska");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/article.test.ts`
Expected: FAIL — tekst nadal zawiera np. „Walker M." lub „Przewidywany czas" (etapy niewpięte).

- [ ] **Step 3: Wpiąć etapy w `extractArticle`**

Zmodyfikować ciało `extractArticle` w `src/lib/article.ts` tak:

```ts
export function extractArticle(html: string, url: string): ExtractedArticle {
  // A bare VirtualConsole with no listeners swallows jsdom's noisy CSS/resource
  // parse errors that real-world pages routinely trigger.
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  stripBoilerplate(dom.window.document);
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
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — wszystkie pliki, w tym nowy e2e i dotychczasowe testy `extractArticle`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article.ts src/lib/article.test.ts
git commit -m "feat(article): clean boilerplate during extractArticle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Retrofit istniejących artykułów (treść)

**Files:**
- Modify: `content/index.json` (pola `text` dla `art-po-co-nam-sen` i `art-akademia-cyfrowego-rodzica`)
- Create (tymczasowo): `scripts/refetch-existing.ts` (jednorazowy skrypt; usuwany w Kroku 4)

**Interfaces:**
- Consumes: `extractArticle` (Task 3), `content/index.json`.
- Produces: zaktualizowany `text` dla obu artykułów; brak nowych eksportów.

- [ ] **Step 1: Napisać jednorazowy skrypt re-fetch**

Utworzyć `scripts/refetch-existing.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import { extractArticle } from "../src/lib/article";
import type { ContentItem } from "../src/lib/types";

const IDS = ["art-po-co-nam-sen", "art-akademia-cyfrowego-rodzica"];
const FILE = "content/index.json";

async function main() {
  const content = JSON.parse(await readFile(FILE, "utf8")) as { exercises: ContentItem[] };
  for (const item of content.exercises) {
    if (!IDS.includes(item.id) || !item.url) continue;
    const res = await fetch(item.url, {
      headers: { "User-Agent": "Mozilla/5.0 (voice-reading article importer)" },
    });
    const html = await res.text();
    const { text } = extractArticle(html, item.url);
    const before = item.text?.length ?? 0;
    item.text = text;
    console.log(`${item.id}: ${before} → ${text.length} chars`);
  }
  await writeFile(FILE, JSON.stringify(content, null, 2) + "\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Uruchomić skrypt**

Run: `npx tsx scripts/refetch-existing.ts`
Expected: dwie linie `art-…: <stare> → <nowe> chars`, gdzie nowe < stare (śmieci usunięte). `content/index.json` zaktualizowany.

- [ ] **Step 3: Zweryfikować treść ręcznie**

Run: `git diff content/index.json`
Expected: w obu `text` zniknęły: „Przewidywany czas", „Spis treści" + lista, „Przeczytaj też", „Literatura"/bibliografia, „Tagi:", bio autora („Joanna Śliwowska …"). Treść merytoryczna zachowana, zaczyna się od pierwszego zdania artykułu, kończy ostatnim zdaniem treści (nie na „Literatura"/„Tagi"). Jeśli coś istotnego zostało ucięte lub śmieć przetrwał — przerwać i zgłosić użytkownikowi (możliwa korekta selektorów/markerów w Tasku 1/2).

- [ ] **Step 4: Usunąć jednorazowy skrypt**

```bash
rm scripts/refetch-existing.ts
```

- [ ] **Step 5: NIE commitować jeszcze**

Commit treści nastąpi razem z audio w Tasku 5 (treść bez pasującego audio nie powinna trafić osobno). Przejść do Tasku 5.

---

### Task 5: Regeneracja audio i commit (checkpoint użytkownika — ElevenLabs)

**Files:**
- Modify: `public/library/art-po-co-nam-sen.mp3`, `public/library/art-po-co-nam-sen.json`, `public/library/art-akademia-cyfrowego-rodzica.mp3`, `public/library/art-akademia-cyfrowego-rodzica.json`, `public/library/.manifest.json`, `public/library/index.json`
- Modify: `content/index.json` (już zmieniony w Tasku 4 — commit tutaj)

**Interfaces:**
- Consumes: zaktualizowany `text` z Tasku 4; `generateLibrary`/CLI `npm run generate`.
- Produces: zregenerowane audio + alignment dla obu artykułów; commit treści i audio razem.

> **CHECKPOINT — wymaga użytkownika.** Ten krok zużywa kwotę ElevenLabs i potrzebuje `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` w `.env`. Nie automatyzować w tle — poprosić użytkownika o uruchomienie / potwierdzenie środowiska przed generowaniem.

- [ ] **Step 1: Potwierdzić środowisko**

Run: `node -e "require('dotenv').config(); console.log(!!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID)"`
Expected: `true`. Jeśli `false` — zatrzymać i poprosić użytkownika o `.env`.

- [ ] **Step 2: Zregenerować audio dla obu artykułów**

Zmiana `text` zmienia fingerprint, więc `generate` wygeneruje je ponownie (nie pominie).

Run: `npm run generate -- art-po-co-nam-sen art-akademia-cyfrowego-rodzica`
Expected: `2 generated, … 0 failed.` Jeśli `failed > 0` (np. kwota) — zatrzymać, zgłosić użytkownikowi; treść w `index.json` zostaje, audio nie.

- [ ] **Step 3: Szybka weryfikacja alignment**

Run: `node -e "const j=require('./public/library/art-po-co-nam-sen.json'); console.log(j.words.slice(0,4).map(w=>w.word).join(' '))"`
Expected: pierwsze słowa to początek treści artykułu (np. „We śnie spędzamy…"), nie „Przewidywany"/„Spis".

- [ ] **Step 4: Commit treści + audio razem**

```bash
git add content/index.json public/library
git commit -m "content: re-extract sleep & digital-parent articles without boilerplate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: (Opcjonalnie) push**

Zapytać użytkownika, czy wypchnąć. Jeśli tak:

```bash
git push
```

---

## Notes

- Kolejność: Task 1–3 czysto lokalne (testy, bez sieci/kwoty). Task 4 wymaga sieci (fetch stron). Task 5 wymaga kwoty ElevenLabs — checkpoint użytkownika.
- Gdyby retrofit (Task 4) odsłonił śmieć bez czystego kontenera DOM (np. nowy callout), rozszerzyć `BOILERPLATE_SELECTORS` (Task 2) lub `TAIL_MARKERS` (Task 1), dograć test, i powtórzyć Task 4.
