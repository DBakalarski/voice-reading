# Multi-part Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import articles that exceed ElevenLabs' 10k-char/request limit by splitting them into ordered "part" exercises the reader can chain through.

**Architecture:** Chunk long text at fetch time into N `ContentItem` parts, each ≤9k chars, so `generate.ts` runs unchanged per-item. Parts carry `part` metadata (index/total/nextId); each generated `Exercise` gets a `next` id that the reader turns into a "Następna część →" link. Splitting is at sentence boundaries only (stored text has no paragraph markers).

**Tech Stack:** TypeScript, Node, tsx scripts, Vitest, Next.js (App Router), `@elevenlabs/elevenlabs-js`.

## Global Constraints

- Every audio call must stay ≤ 10,000 chars; chunker default target is **9,000** (margin below the cap).
- UI copy is **Polish**: part titles `"<Title> (część N)"`, reader link `"Następna część →"`.
- Part ids follow the scheme `art-<slug>-cz-<N>` (1-based).
- Tests use Vitest (`describe/it/expect`); `article.test.ts` runs under `// @vitest-environment node`.
- Single-chunk articles must keep today's exact behavior: one entry, no `(część …)` suffix, no `part` metadata.
- DRY, YAGNI, TDD, commit after each task.

---

### Task 1: `chunkText` — split long text at sentence boundaries

**Files:**
- Modify: `src/lib/article.ts` (add `chunkText` + two private helpers)
- Test: `src/lib/article.test.ts` (add a `describe("chunkText", …)` block)

**Interfaces:**
- Consumes: nothing.
- Produces: `chunkText(text: string, maxChars?: number): string[]` — returns `[text]` when it already fits; otherwise ≥2 chunks, each `length <= maxChars`, split only at sentence boundaries (word-boundary fallback for a single over-long sentence).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/article.test.ts` (and add `chunkText` to the existing import from `./article`):

```ts
describe("chunkText", () => {
  it("returns the text unchanged when it fits", () => {
    expect(chunkText("Krótkie zdanie.", 9000)).toEqual(["Krótkie zdanie."]);
  });

  it("splits at sentence boundaries and never exceeds the cap", () => {
    const text = Array.from({ length: 20 }, (_, i) => `To jest zdanie numer ${i + 1}.`).join(" ");
    const chunks = chunkText(text, 60);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(60);
    // No content lost: rejoining reproduces the original (single-spaced) text.
    expect(chunks.join(" ")).toBe(text);
    // No sentence broken: every chunk ends on a sentence terminator.
    for (const c of chunks) expect(c).toMatch(/[.?!]$/);
  });

  it("word-splits a single sentence longer than the cap", () => {
    const longSentence = Array.from({ length: 40 }, () => "slowo").join(" ") + ".";
    const chunks = chunkText(longSentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
    expect(chunks.join(" ")).toBe(longSentence);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/article.test.ts`
Expected: FAIL — `chunkText is not a function` / `chunkText is not defined`.

- [ ] **Step 3: Implement `chunkText` and its helpers**

Add to `src/lib/article.ts` (after `uniqueId`, before `BOILERPLATE_SELECTORS` is fine):

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/article.test.ts`
Expected: PASS (all `chunkText` tests green, existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/article.ts src/lib/article.test.ts
git commit -m "feat(article): chunkText splits long text at sentence boundaries"
```

---

### Task 2: `buildArticleParts` + part types

**Files:**
- Modify: `src/lib/types.ts` (add `PartInfo`, `ContentItem.part`)
- Modify: `src/lib/article.ts` (add `buildArticleParts`)
- Test: `src/lib/article.test.ts` (add a `describe("buildArticleParts", …)` block)

**Interfaces:**
- Consumes: `chunkText` output (an array of chunk strings).
- Produces:
  - `interface PartInfo { index: number; total: number; nextId?: string; }`
  - `ContentItem.part?: PartInfo`
  - `buildArticleParts(baseId: string, title: string, chunks: string[]): Array<{ id: string; title: string; text: string; part?: PartInfo }>` — one chunk → a single item with no `part`; N chunks → items `art-<base>-cz-1..N` titled `"<Title> (część N)"` with `part` metadata (`nextId` set on all but the last).

- [ ] **Step 1: Add the types**

In `src/lib/types.ts`, add `PartInfo` and extend `ContentItem`:

```ts
/** Position of one part within a split (multi-part) article. */
export interface PartInfo {
  index: number; // 1-based
  total: number;
  nextId?: string; // id of the next part; absent on the last part
}
```

And add the field to `ContentItem` (keep other fields as-is):

```ts
export interface ContentItem {
  id: string;
  title: string;
  level?: number;
  category?: Category;
  url?: string;
  text?: string;
  /** Set only for split articles; absent for single-chunk articles and exercises. */
  part?: PartInfo;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/lib/article.test.ts` (add `buildArticleParts` to the `./article` import; add `import type { PartInfo } from "./types";` if you assert on it — not required below):

```ts
describe("buildArticleParts", () => {
  it("returns a single unnumbered item when there is one chunk", () => {
    const parts = buildArticleParts("art-sen", "Sen", ["Cały tekst."]);
    expect(parts).toEqual([{ id: "art-sen", title: "Sen", text: "Cały tekst." }]);
  });

  it("numbers parts, adds Polish suffix and chains nextId", () => {
    const parts = buildArticleParts("art-sen", "Sen", ["Jeden.", "Dwa.", "Trzy."]);
    expect(parts.map((p) => p.id)).toEqual(["art-sen-cz-1", "art-sen-cz-2", "art-sen-cz-3"]);
    expect(parts.map((p) => p.title)).toEqual([
      "Sen (część 1)",
      "Sen (część 2)",
      "Sen (część 3)",
    ]);
    expect(parts[0].part).toEqual({ index: 1, total: 3, nextId: "art-sen-cz-2" });
    expect(parts[1].part).toEqual({ index: 2, total: 3, nextId: "art-sen-cz-3" });
    expect(parts[2].part).toEqual({ index: 3, total: 3, nextId: undefined });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/article.test.ts`
Expected: FAIL — `buildArticleParts is not a function`.

- [ ] **Step 4: Implement `buildArticleParts`**

Add to `src/lib/article.ts` (import the type at the top: `import type { PartInfo } from "./types";`):

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/article.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/article.ts src/lib/article.test.ts
git commit -m "feat(article): buildArticleParts numbers and chains long-article parts"
```

---

### Task 3: `Exercise.next` + thread it through generation

**Files:**
- Modify: `src/lib/types.ts` (add `Exercise.next`)
- Modify: `src/lib/exercise.ts` (`buildExercise` gains optional `next`)
- Modify: `scripts/generate.ts` (pass `item.part?.nextId`)
- Test: `src/lib/exercise.test.ts` (add two cases)

**Interfaces:**
- Consumes: `PartInfo` (Task 2) via `ContentItem.part?.nextId`.
- Produces: `Exercise.next?: string`; `buildExercise(id: string, title: string, alignment: Alignment, next?: string): Exercise` (sets `next` only when a truthy id is passed).

- [ ] **Step 1: Add the type**

In `src/lib/types.ts`, add `next` to `Exercise`:

```ts
export interface Exercise {
  id: string;
  title: string;
  audio: string;
  words: Word[];
  phrases: Phrase[];
  /** Id of the next part, for multi-part articles; drives the reader link. */
  next?: string;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/lib/exercise.test.ts`:

```ts
it("sets next when a following part id is given", () => {
  const ex = buildExercise("art-x-cz-1", "X (część 1)", align("A."), "art-x-cz-2");
  expect(ex.next).toBe("art-x-cz-2");
});

it("omits next when no following part id is given", () => {
  const ex = buildExercise("powitanie", "Powitania", align("Cześć."));
  expect(ex.next).toBeUndefined();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/exercise.test.ts`
Expected: FAIL — `next` is `undefined` in the first case (arg ignored) or a type/compile error.

- [ ] **Step 4: Implement**

Replace the body of `src/lib/exercise.ts`:

```ts
import { parseAlignment } from "./alignment";
import type { Alignment, Exercise } from "./types";

/** Pure assembly of an Exercise from an id, title and ElevenLabs alignment.
 *  `next` links to the following part of a multi-part article. */
export function buildExercise(
  id: string,
  title: string,
  alignment: Alignment,
  next?: string,
): Exercise {
  const { words, phrases } = parseAlignment(alignment);
  const exercise: Exercise = { id, title, audio: `/library/${id}.mp3`, words, phrases };
  if (next) exercise.next = next;
  return exercise;
}
```

In `scripts/generate.ts`, pass the next id (around line 106):

```ts
        const alignment = res.alignment as unknown as Alignment;
        const exercise = buildExercise(item.id, item.title, alignment, item.part?.nextId);
        await writeFile(jsonPath, JSON.stringify(exercise, null, 2));
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/lib/exercise.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/exercise.ts scripts/generate.ts src/lib/exercise.test.ts
git commit -m "feat(exercise): thread part nextId into Exercise.next"
```

---

### Task 4: Wire chunking into `fetch.ts`

**Files:**
- Modify: `scripts/fetch.ts`

**Interfaces:**
- Consumes: `chunkText` (Task 1), `buildArticleParts` (Task 2), existing `slugify`/`uniqueId`, `generateLibrary`.
- Produces: `fetch` writes 1 or N `ContentItem`s and generates all of them.

- [ ] **Step 1: Update imports**

In `scripts/fetch.ts`, extend the `../src/lib/article` import:

```ts
import {
  buildArticleParts,
  chunkText,
  extractArticle,
  slugify,
  uniqueId,
} from "../src/lib/article";
```

- [ ] **Step 2: Replace the single-entry build with chunked parts**

Replace the current block (from `const id = uniqueId(...)` through the `generateLibrary` call, roughly lines 57–72) with:

```ts
  const baseId = uniqueId(`art-${slugify(title)}`, content.exercises.map((e) => e.id));
  const parts = buildArticleParts(baseId, title, chunkText(text));

  for (const p of parts) {
    content.exercises.push({ ...p, category: "article", url });
  }
  await writeFile(CONTENT_FILE, JSON.stringify(content, null, 2) + "\n");
  if (parts.length === 1) {
    console.log(`Added "${title}" (id: ${baseId}, ${text.length} chars).`);
  } else {
    console.log(
      `Added "${title}" as ${parts.length} parts (${text.length} chars total).`,
    );
  }

  console.log(`\nGenerating audio…`);
  const partIds = parts.map((p) => p.id);
  const result = await generateLibrary({ onlyIds: partIds });
  if (result.failed > 0) {
    fail(
      `Audio generation failed for "${title}" (likely ElevenLabs quota).\n` +
        `  The entr${parts.length === 1 ? "y stays" : "ies stay"} in ${CONTENT_FILE}. ` +
        `Wait for quota, then run:\n` +
        `    npm run generate -- ${partIds.join(" ")}\n` +
        `  Nothing was committed.`,
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`fetch.ts` is a script, so this is the verification; the real run is Task 6.)

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch.ts
git commit -m "feat(fetch): split long articles into numbered parts before generating"
```

---

### Task 5: Reader "Następna część →" link

**Files:**
- Modify: `src/app/exercise/ExerciseClient.tsx`

**Interfaces:**
- Consumes: `Exercise.next` (Task 3).
- Produces: a next-part link rendered after `<Player>` when `exercise.next` is set.

- [ ] **Step 1: Add the conditional link**

In `src/app/exercise/ExerciseClient.tsx`, replace the final `return (…)` (the success branch rendering `<Player>`) with:

```tsx
  return (
    <>
      <nav style={{ padding: "1rem 1.5rem" }}>
        <Link href="/">← Lista ćwiczeń</Link>
      </nav>
      <Player exercise={exercise} />
      {exercise.next && (
        <nav style={{ padding: "1rem 1.5rem" }}>
          <Link href={`/exercise?id=${exercise.next}`}>Następna część →</Link>
        </nav>
      )}
    </>
  );
```

- [ ] **Step 2: Typecheck + run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all existing tests pass (no test regressions).

- [ ] **Step 3: Commit**

```bash
git add src/app/exercise/ExerciseClient.tsx
git commit -m "feat(reader): link to the next part of a multi-part article"
```

---

### Task 6: Re-import the Wołyń article and verify end-to-end

**Files:**
- Modify (generated): `content/index.json`, `public/library/*` (new part files)

**Interfaces:**
- Consumes: the full pipeline (Tasks 1–5).
- Produces: 6 part entries in `content/index.json`, 6 `*.mp3` + 6 `*.json` in `public/library`, and a working next-part chain in the reader.

- [ ] **Step 1: Drop the stale single entry**

The 50k-char single entry is uncommitted. Reset it:

Run: `git checkout content/index.json`
Expected: `content/index.json` no longer contains `art-niewygodna-prawda-o-wolyniu-jak-historia-stala-sie`.

- [ ] **Step 2: Re-import (no auto-commit, so we can verify first)**

Run:
```bash
npm run fetch -- "https://zero.pl/news/wolyn-1943-anatomia-zbrodni-i-prawda-o-upa-obalamy-najwieksze-mity" --no-commit
```
Expected: `Added "…" as 6 parts (50394 chars total)` (part count may be 6 ±1), then `Done. 6 generated, … 0 failed.` and no commit.

- [ ] **Step 3: Verify the generated artifacts**

Run:
```bash
node -e "const c=require('./content/index.json').exercises.filter(e=>e.part); console.log('parts:', c.length); console.log(c.map(e=>({id:e.id,title:e.title,next:e.part.nextId})));"
ls -1 public/library | grep -E 'cz-[0-9]+\.(mp3|json)$'
node -e "const p=require('./public/library/'+require('./content/index.json').exercises.find(e=>e.part&&e.part.index===1).id+'.json'); console.log('next of part 1:', p.next)"
```
Expected: `parts: 6`; each part's `title` ends with `(część N)`; every part except the last has a `next`/`nextId`; 12 matching files listed (6 mp3 + 6 json); "next of part 1" prints the part-2 id.

- [ ] **Step 4: Verify in the running app**

Use the `run` skill (or `npm run dev`) to open the app, go to **Artykuły**, confirm the 6 ordered "… (część N)" cards, open część 1, and confirm the **"Następna część →"** link navigates to część 2 and highlights words as audio plays. The last part must NOT show the link.

- [ ] **Step 5: Commit the imported content**

```bash
git add content/index.json public/library
git commit -m 'content: import "Niewygodna prawda o Wołyniu" as 6 parts'
```

(No push — leave that to the user, matching the stuck-import situation.)

---

## Self-Review

**Spec coverage:**
- Chunker (`chunkText`, sentence boundaries, balanced, fallback) → Task 1. ✅
- Data model (`PartInfo`, `ContentItem.part`, `Exercise.next`, id/title scheme) → Tasks 2 (part types + ids/titles) and 3 (`Exercise.next`). ✅
- `fetch.ts` chunk-and-generate → Task 4. ✅
- `generate.ts` threads `nextId` → Task 3. ✅
- Reader "Następna część →" → Task 5. ✅
- Tests for `chunkText` and `buildExercise` → Tasks 1 and 3; plus `buildArticleParts` in Task 2. ✅
- Re-import runbook (`git checkout` + re-fetch) → Task 6. ✅
- No change to `Player`/`HighlightedText`/`TopicList`/`levels.ts` → honored (not touched). ✅

**Placeholder scan:** No TBD/TODO; every code and test step shows complete code; commands have expected output. The only `<…>`-style token is the live article URL, given verbatim in Task 6. ✅

**Type consistency:** `PartInfo { index, total, nextId? }` defined in Task 2, consumed as `item.part?.nextId` in Task 3 and produced by `buildArticleParts` in Task 2. `buildExercise(id, title, alignment, next?)` defined in Task 3, called with that arity in `generate.ts` (Task 3). `Exercise.next` defined in Task 3, consumed in Task 5. `chunkText(text, maxChars?)` defined in Task 1, used in Task 4. All consistent. ✅
