# Multi-part articles — design

**Date:** 2026-07-05
**Status:** Approved, ready for implementation plan

## Problem

`generate.ts` produces audio + character-level alignment via ElevenLabs
`convertWithTimestamps`, which the app uses to highlight words as they play. That
endpoint has a **hard 10,000-character-per-request limit**. Real articles imported
by `npm run fetch` routinely exceed it (the triggering case: a 50,394-char article),
so generation fails outright:

```
Request text length (50394) exceeds the maximum text length of 10000 characters.
```

This is a length limit, not a quota issue. Trimming to 10k would discard ~80% of a
long article. We need to read the whole article while staying under the per-request
cap on every call.

## Decision

When an article exceeds the limit, **split it into multiple ordered "part"
exercises** ("… (część 1)", "… (część 2)", …). Each part is an independent
generate call, so no MP3 stitching or timestamp-offset math is required. In the
reader, a **"Następna część →"** link chains parts so the user isn't sent back to
the library between them.

### Approach: chunk at fetch time (not generate time)

Chunking happens in `fetch.ts`, which emits N `ContentItem` parts each carrying its
own ≤9k-char text. `generate.ts` then runs essentially unchanged — every item it
sees is already under the limit, and the existing per-item manifest/fingerprint/
incremental-skip logic works per-part for free.

Rejected alternative: keep one `ContentItem` with the full text and split inside
`generate`. This breaks the clean "one content entry → one audio + one json"
mapping and complicates the manifest keying. Chunking at fetch keeps `generate`
minimal.

### Splitting granularity: sentence boundaries

`normalizeText` / `trimBoilerplateText` collapse all whitespace (`\s+` → " "), so
stored article text has **no paragraph markers**. Splitting therefore happens at
**sentence boundaries** and never mid-sentence. A pathologically long single
sentence (> target) falls back to word-boundary splitting, still capped at the hard
limit.

## Components

### 1. `chunkText(text, maxChars = 9000)` — `src/lib/article.ts` (pure, new)

- Returns `[text]` unchanged when `text.length <= maxChars` → single-article path
  (no part suffix, no part metadata).
- Otherwise computes balanced parts: `parts = ceil(len / maxChars)`,
  `target = ceil(len / parts)`, then greedily packs whole sentences up to `target`.
  For the 50,394-char case: **6 parts of ~8.4k chars (~8 min each)**.
- Sentence segmentation reuses the project's existing convention (`[.?!]`
  terminators, mirroring `PHRASE_END` in `alignment.ts`).

**Invariants (tested):**
- Every returned chunk has `length <= 10000` (hard cap, with margin from the 9000
  target).
- No sentence is broken across chunks (except the long-sentence word-split
  fallback).
- Chunks rejoin (space-joined) to the original normalized text.
- Part sizes are roughly balanced.

### 2. Data model — `src/lib/types.ts`

```ts
interface PartInfo {
  index: number;   // 1-based position within the article
  total: number;   // number of parts
  nextId?: string; // id of the next part; absent on the last part
}

interface ContentItem {
  // …existing fields…
  part?: PartInfo; // present only for split articles
}

interface Exercise {
  // …existing fields…
  next?: string;   // next part id, drives the "Następna część →" link
}
```

- Part ids are deterministic: `art-<slug>-cz-1 … art-<slug>-cz-N`. The whole family
  is run through `uniqueId` so a re-import cannot collide with existing ids.
- Part titles: `"<Title> (część N)"`.
- `ExerciseSummary` is unchanged; parts list in content order, so ordering needs no
  extra field.

### 3. `fetch.ts`

After extraction, call `chunkText(text)`:
- **1 chunk** → today's behavior exactly: a single `ContentItem`, no part metadata,
  no title suffix.
- **N chunks** → build N part `ContentItem`s with `part` (`index`, `total`,
  `nextId` for all but the last), push them in order, then
  `generateLibrary({ onlyIds: [...allPartIds] })`.

The existing failure messaging and `git add public/library` / commit flow already
cover multiple new files with no change.

### 4. `generate.ts` (minimal change)

Thread `item.part?.nextId` into `buildExercise(...)`, which sets `Exercise.next`
when present. Manifest, fingerprint, and incremental-skip logic are untouched and
operate per-part.

`buildExercise(id, title, alignment, next?)` gains an optional `next` argument.

### 5. Reader — `src/app/exercise/ExerciseClient.tsx`

After the `<Player>`, when `exercise.next` is set, render:

```tsx
<Link href={`/exercise?id=${exercise.next}`}>Następna część →</Link>
```

`Player`, `HighlightedText`, `TopicList`, and `levels.ts` need **no change** — each
part is an ordinary `Exercise`, and parts appear as ordered cards in the Artykuły
list.

## Testing (TDD)

- `chunkText` (`src/lib/article.test.ts`):
  - under-limit text → single-element passthrough, unchanged.
  - over-limit text → all chunks ≤ 10,000, no sentence split, chunks rejoin to
    original, sizes roughly balanced.
  - a single sentence longer than the target → word-split fallback, all chunks ≤
    limit.
- `buildExercise` (`src/lib/exercise.test.ts`): `next` passed through to
  `Exercise.next`; omitted when not provided.

## Re-importing the stuck article

The 50,394-char single entry is currently **uncommitted** in `content/index.json`.
To reprocess it under the new logic:

1. `git checkout content/index.json` — drop the stale single entry.
2. `npm run fetch -- <url>` — now splits into 6 parts and generates cleanly.

## Notes / tradeoffs

- Reading the full article still spends ElevenLabs quota on ~50k chars total (across
  6 calls) — unavoidable for complete audio.
- Adds 6 mp3+json pairs to `public/library`, precached by the service worker like
  today's single-file articles.
- No change to the Serwist precache config, the manifest format, or the library
  index shape.
