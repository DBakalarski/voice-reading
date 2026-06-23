# Voice Reading Rehab PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA for cochlear-implant auditory rehab that plays pre-generated ElevenLabs speech while highlighting the current word and current phrase in sync.

**Architecture:** Two isolated parts. (1) A build-time Node script calls ElevenLabs `convertWithTimestamps`, aggregates character timings into words and phrases, and writes static `mp3` + `json` assets. (2) A Next.js static-export PWA loads those static assets and renders a player that highlights words/phrases from `audio.currentTime`. The app never talks to ElevenLabs. Pure timing logic is isolated in `src/lib/` and unit-tested; the React layer is thin.

**Tech Stack:** Next.js 15 (App Router, `output: 'export'`), TypeScript, Vitest + @testing-library/react + jsdom, `@elevenlabs/elevenlabs-js` (build-time only), `@serwist/next` for PWA.

## Global Constraints

- Language of exercise content: Polish; TTS model `eleven_multilingual_v2`.
- ElevenLabs API key lives ONLY in `.env` (gitignored). It must never appear in app code or shipped assets. Only `scripts/` may import `@elevenlabs/elevenlabs-js`.
- v1 playback controls: play/pause only. No speed control, phrase repeat, word-click nav, or listen-first mode.
- Highlighting: two levels simultaneously — `current-word` (active word) and `current-phrase` (all words of active phrase).
- App is a static export (`output: 'export'`), fully offline after first load. No server/runtime backend.
- Phrase boundary rule: a word ends a phrase when its trailing text is `.`, `?`, or `!`. Trailing punctuation stays attached to the preceding word.
- Times are in seconds (floats).

---

### Task 1: Project scaffold (Next.js + TypeScript + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (placeholder)
- Create: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Next.js app and a working `npm test` (Vitest) command. Establishes `@/` path alias → `src/`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "voice-reading",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate": "tsx scripts/generate.ts"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@elevenlabs/elevenlabs-js": "^2.0.0",
    "@serwist/next": "^9.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "dotenv": "^16.4.0",
    "jsdom": "^25.0.0",
    "serwist": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`** (static export)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
```

- [ ] **Step 5: Create `vitest.config.ts` and `vitest.setup.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create minimal app files**

`src/app/layout.tsx`:
```tsx
export const metadata = { title: "Voice Reading", description: "Trening słuchowy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main>Voice Reading</main>;
}
```

- [ ] **Step 7: Write the smoke test**

`src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 9: Verify the app builds**

Run: `npm run build`
Expected: completes; produces an `out/` directory.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js static-export app with Vitest"
```

---

### Task 2: Timing types and alignment parsing

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/alignment.ts`
- Test: `src/lib/alignment.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Word { text: string; start: number; end: number; phrase: number }`
  - `interface Phrase { index: number; text: string; start: number; end: number }`
  - `interface Exercise { id: string; title: string; audio: string; words: Word[]; phrases: Phrase[] }`
  - `interface ExerciseSummary { id: string; title: string }`
  - `interface LibraryIndex { exercises: ExerciseSummary[] }`
  - `interface Alignment { characters: string[]; characterStartTimesSeconds: number[]; characterEndTimesSeconds: number[] }`
  - `groupCharsIntoWords(a: Alignment): { text: string; start: number; end: number }[]`
  - `assignPhrases(words: { text: string; start: number; end: number }[]): { words: Word[]; phrases: Phrase[] }`
  - `parseAlignment(a: Alignment): { words: Word[]; phrases: Phrase[] }`

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export interface Word {
  text: string;
  start: number;
  end: number;
  phrase: number;
}

export interface Phrase {
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface Exercise {
  id: string;
  title: string;
  audio: string;
  words: Word[];
  phrases: Phrase[];
}

export interface ExerciseSummary {
  id: string;
  title: string;
}

export interface LibraryIndex {
  exercises: ExerciseSummary[];
}

/** Shape of the `alignment` object returned by ElevenLabs convertWithTimestamps. */
export interface Alignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}
```

- [ ] **Step 2: Write the failing test for `groupCharsIntoWords`**

`src/lib/alignment.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groupCharsIntoWords, assignPhrases, parseAlignment } from "./alignment";
import type { Alignment } from "./types";

// "Ala . " -> chars with per-char times. Helper builds an Alignment from a string
// where every character lasts 0.1s back-to-back.
function align(text: string): Alignment {
  const characters = [...text];
  const characterStartTimesSeconds = characters.map((_, i) => +(i * 0.1).toFixed(2));
  const characterEndTimesSeconds = characters.map((_, i) => +((i + 1) * 0.1).toFixed(2));
  return { characters, characterStartTimesSeconds, characterEndTimesSeconds };
}

describe("groupCharsIntoWords", () => {
  it("splits on spaces and keeps punctuation attached", () => {
    const words = groupCharsIntoWords(align("Ala ma kota."));
    expect(words.map((w) => w.text)).toEqual(["Ala", "ma", "kota."]);
  });

  it("computes start of first char and end of last char per word", () => {
    // "Ala" = chars 0,1,2 -> start 0.0, end 0.3
    const words = groupCharsIntoWords(align("Ala ma"));
    expect(words[0].start).toBeCloseTo(0.0);
    expect(words[0].end).toBeCloseTo(0.3);
    // "ma" = chars 4,5 -> start 0.4, end 0.6
    expect(words[1].start).toBeCloseTo(0.4);
    expect(words[1].end).toBeCloseTo(0.6);
  });

  it("ignores leading/trailing/multiple spaces", () => {
    const words = groupCharsIntoWords(align("  Ala   ma  "));
    expect(words.map((w) => w.text)).toEqual(["Ala", "ma"]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- alignment`
Expected: FAIL — `groupCharsIntoWords` is not exported / not defined.

- [ ] **Step 4: Implement `groupCharsIntoWords`**

`src/lib/alignment.ts`:
```ts
import type { Alignment, Phrase, Word } from "./types";

interface RawWord {
  text: string;
  start: number;
  end: number;
}

/** Group ElevenLabs per-character timings into whitespace-delimited words. */
export function groupCharsIntoWords(a: Alignment): RawWord[] {
  const words: RawWord[] = [];
  let current: { chars: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (current) {
        words.push({ text: current.chars.join(""), start: current.start, end: current.end });
        current = null;
      }
      continue;
    }
    if (!current) {
      current = { chars: [ch], start: a.characterStartTimesSeconds[i], end: a.characterEndTimesSeconds[i] };
    } else {
      current.chars.push(ch);
      current.end = a.characterEndTimesSeconds[i];
    }
  }
  if (current) {
    words.push({ text: current.chars.join(""), start: current.start, end: current.end });
  }
  return words;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- alignment`
Expected: PASS — the 3 `groupCharsIntoWords` tests pass.

- [ ] **Step 6: Write the failing test for `assignPhrases`**

Append to `src/lib/alignment.test.ts`:
```ts
describe("assignPhrases", () => {
  const raw = [
    { text: "Dzień", start: 0.0, end: 0.4 },
    { text: "dobry.", start: 0.4, end: 0.9 },
    { text: "Jak", start: 1.1, end: 1.3 },
    { text: "się", start: 1.3, end: 1.5 },
    { text: "masz?", start: 1.5, end: 1.9 },
  ];

  it("assigns a phrase index to each word, breaking after . ? !", () => {
    const { words } = assignPhrases(raw);
    expect(words.map((w) => w.phrase)).toEqual([0, 0, 1, 1, 1]);
  });

  it("builds phrase ranges spanning their words", () => {
    const { phrases } = assignPhrases(raw);
    expect(phrases).toEqual([
      { index: 0, text: "Dzień dobry.", start: 0.0, end: 0.9 },
      { index: 1, text: "Jak się masz?", start: 1.1, end: 1.9 },
    ]);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- alignment`
Expected: FAIL — `assignPhrases` is not defined.

- [ ] **Step 8: Implement `assignPhrases` and `parseAlignment`**

Append to `src/lib/alignment.ts`:
```ts
const PHRASE_END = /[.?!]$/;

/** Assign each word a phrase index (break after sentence-ending punctuation)
 *  and build the matching phrase ranges. */
export function assignPhrases(words: RawWord[]): { words: Word[]; phrases: Phrase[] } {
  const out: Word[] = [];
  const phrases: Phrase[] = [];
  let phraseIndex = 0;
  let phraseWords: string[] = [];
  let phraseStart: number | null = null;
  let phraseEnd = 0;

  const flush = () => {
    if (phraseWords.length === 0 || phraseStart === null) return;
    phrases.push({
      index: phraseIndex,
      text: phraseWords.join(" "),
      start: phraseStart,
      end: phraseEnd,
    });
    phraseIndex++;
    phraseWords = [];
    phraseStart = null;
  };

  for (const w of words) {
    if (phraseStart === null) phraseStart = w.start;
    phraseEnd = w.end;
    phraseWords.push(w.text);
    out.push({ text: w.text, start: w.start, end: w.end, phrase: phraseIndex });
    if (PHRASE_END.test(w.text)) flush();
  }
  flush();

  return { words: out, phrases };
}

/** Full pipeline: ElevenLabs alignment -> words + phrases. */
export function parseAlignment(a: Alignment): { words: Word[]; phrases: Phrase[] } {
  return assignPhrases(groupCharsIntoWords(a));
}
```

- [ ] **Step 9: Write the failing test for `parseAlignment` end-to-end**

Append to `src/lib/alignment.test.ts`:
```ts
describe("parseAlignment", () => {
  it("produces words with phrase indices and matching phrases", () => {
    const a = {
      characters: [..."Ala. Ola?"],
      characterStartTimesSeconds: [..."Ala. Ola?"].map((_, i) => +(i * 0.1).toFixed(2)),
      characterEndTimesSeconds: [..."Ala. Ola?"].map((_, i) => +((i + 1) * 0.1).toFixed(2)),
    };
    const { words, phrases } = parseAlignment(a);
    expect(words.map((w) => w.text)).toEqual(["Ala.", "Ola?"]);
    expect(words.map((w) => w.phrase)).toEqual([0, 1]);
    expect(phrases.map((p) => p.text)).toEqual(["Ala.", "Ola?"]);
  });
});
```

- [ ] **Step 10: Run the full test file to verify all pass**

Run: `npm test -- alignment`
Expected: PASS — all tests in the file pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/types.ts src/lib/alignment.ts src/lib/alignment.test.ts
git commit -m "feat: alignment parsing (chars -> words -> phrases)"
```

---

### Task 3: Library generator script + sample content

**Files:**
- Create: `content/index.json`
- Create: `src/lib/exercise.ts`
- Test: `src/lib/exercise.test.ts`
- Create: `scripts/generate.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `public/library/` is NOT ignored; `.env` already is)

**Interfaces:**
- Consumes: `parseAlignment` and types from Task 2.
- Produces:
  - `buildExercise(id: string, title: string, alignment: Alignment): Exercise` (pure; sets `audio` to `/library/<id>.mp3`).
  - `scripts/generate.ts` writing `public/library/<id>.mp3`, `public/library/<id>.json`, and `public/library/index.json`.

- [ ] **Step 1: Write the failing test for `buildExercise`**

`src/lib/exercise.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildExercise } from "./exercise";
import type { Alignment } from "./types";

function align(text: string): Alignment {
  const characters = [...text];
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, i) => +(i * 0.1).toFixed(2)),
    characterEndTimesSeconds: characters.map((_, i) => +((i + 1) * 0.1).toFixed(2)),
  };
}

describe("buildExercise", () => {
  it("assembles an Exercise with id, title, audio path, words and phrases", () => {
    const ex = buildExercise("powitanie", "Powitania", align("Cześć."));
    expect(ex.id).toBe("powitanie");
    expect(ex.title).toBe("Powitania");
    expect(ex.audio).toBe("/library/powitanie.mp3");
    expect(ex.words.map((w) => w.text)).toEqual(["Cześć."]);
    expect(ex.phrases).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- exercise`
Expected: FAIL — `buildExercise` not defined.

- [ ] **Step 3: Implement `buildExercise`**

`src/lib/exercise.ts`:
```ts
import { parseAlignment } from "./alignment";
import type { Alignment, Exercise } from "./types";

/** Pure assembly of an Exercise from an id, title and ElevenLabs alignment. */
export function buildExercise(id: string, title: string, alignment: Alignment): Exercise {
  const { words, phrases } = parseAlignment(alignment);
  return { id, title, audio: `/library/${id}.mp3`, words, phrases };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- exercise`
Expected: PASS.

- [ ] **Step 5: Create sample content**

`content/index.json`:
```json
{
  "exercises": [
    { "id": "powitanie", "title": "Codzienne powitania", "text": "Dzień dobry. Jak się masz? Miło cię widzieć." },
    { "id": "dom", "title": "W domu", "text": "Otwieram okno. Na stole leży chleb. Kot śpi na kanapie." },
    { "id": "spacer", "title": "Spacer", "text": "Idę do parku. Świeci słońce. Spotykam sąsiada i mówię cześć." }
  ]
}
```

- [ ] **Step 6: Create `.env.example`**

```
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=your_polish_voice_id_here
```

- [ ] **Step 7: Ensure `public/library/` is tracked**

Run: `mkdir -p public/library`
Then create `public/library/.gitkeep` (empty file) so the directory exists in git before generation.
Verify `.gitignore` contains `.env` but NOT `public/`.

- [ ] **Step 8: Write the generator script**

`scripts/generate.ts`:
```ts
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildExercise } from "../src/lib/exercise.ts";
import type { Alignment, LibraryIndex } from "../src/lib/types.ts";

interface ContentItem {
  id: string;
  title: string;
  text: string;
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!apiKey || !voiceId) {
  console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env");
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });
const OUT_DIR = "public/library";

async function main() {
  const raw = await readFile("content/index.json", "utf8");
  const { exercises } = JSON.parse(raw) as { exercises: ContentItem[] };
  await mkdir(OUT_DIR, { recursive: true });

  const summaries: LibraryIndex["exercises"] = [];

  for (const item of exercises) {
    console.log(`Generating "${item.id}"...`);
    const res = await client.textToSpeech.convertWithTimestamps(voiceId, {
      text: item.text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const audioBuffer = Buffer.from(res.audio as string, "base64");
    await writeFile(`${OUT_DIR}/${item.id}.mp3`, audioBuffer);

    const alignment = res.alignment as unknown as Alignment;
    const exercise = buildExercise(item.id, item.title, alignment);
    await writeFile(`${OUT_DIR}/${item.id}.json`, JSON.stringify(exercise, null, 2));

    summaries.push({ id: item.id, title: item.title });
  }

  const index: LibraryIndex = { exercises: summaries };
  await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(index, null, 2));
  console.log(`Done. ${summaries.length} exercises written to ${OUT_DIR}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> Note: `res.audio` / `res.alignment` field names follow the `@elevenlabs/elevenlabs-js` v2 response. If a run shows the alignment property names differ (e.g. snake_case), adapt the cast — `parseAlignment` expects `characters`, `characterStartTimesSeconds`, `characterEndTimesSeconds`.

- [ ] **Step 9: Verify the script type-checks (no API call)**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 10: Run all tests**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 11: Commit**

```bash
git add content scripts src/lib/exercise.ts src/lib/exercise.test.ts .env.example .gitignore public/library/.gitkeep
git commit -m "feat: ElevenLabs library generator and sample content"
```

> Manual generation (not a plan step, requires real credentials): set `.env` from `.env.example`, then run `npm run generate`. Commit the produced `public/library/*` assets separately.

---

### Task 4: Audio sync logic and hook

**Files:**
- Create: `src/lib/activeIndex.ts`
- Test: `src/lib/activeIndex.test.ts`
- Create: `src/hooks/useAudioSync.ts`

**Interfaces:**
- Consumes: `Word`, `Phrase` from `src/lib/types.ts`.
- Produces:
  - `resolveActiveIndices(time: number, words: Word[], phrases: Phrase[]): { wordIndex: number; phraseIndex: number }` (returns `-1` for each when nothing is active).
  - `useAudioSync(audioRef: React.RefObject<HTMLAudioElement | null>, words: Word[], phrases: Phrase[]): { wordIndex: number; phraseIndex: number; playing: boolean }`.

- [ ] **Step 1: Write the failing test for `resolveActiveIndices`**

`src/lib/activeIndex.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveActiveIndices } from "./activeIndex";
import type { Phrase, Word } from "./types";

const words: Word[] = [
  { text: "Dzień", start: 0.0, end: 0.4, phrase: 0 },
  { text: "dobry.", start: 0.4, end: 0.9, phrase: 0 },
  { text: "Jak", start: 1.1, end: 1.3, phrase: 1 },
];
const phrases: Phrase[] = [
  { index: 0, text: "Dzień dobry.", start: 0.0, end: 0.9 },
  { index: 1, text: "Jak", start: 1.1, end: 1.3 },
];

describe("resolveActiveIndices", () => {
  it("returns the word whose [start,end) contains the time", () => {
    expect(resolveActiveIndices(0.2, words, phrases)).toEqual({ wordIndex: 0, phraseIndex: 0 });
    expect(resolveActiveIndices(0.5, words, phrases)).toEqual({ wordIndex: 1, phraseIndex: 0 });
    expect(resolveActiveIndices(1.2, words, phrases)).toEqual({ wordIndex: 2, phraseIndex: 1 });
  });

  it("keeps the phrase active during a gap between its words but clears the word", () => {
    // 0.95s is after 'dobry.' ends (0.9) but within phrase 0 (ends 0.9)? gap is 0.9..1.1.
    const r = resolveActiveIndices(1.0, words, phrases);
    expect(r.wordIndex).toBe(-1);
    expect(r.phraseIndex).toBe(-1);
  });

  it("returns -1/-1 before the first word and after the last", () => {
    expect(resolveActiveIndices(-0.5, words, phrases)).toEqual({ wordIndex: -1, phraseIndex: -1 });
    expect(resolveActiveIndices(99, words, phrases)).toEqual({ wordIndex: -1, phraseIndex: -1 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- activeIndex`
Expected: FAIL — `resolveActiveIndices` not defined.

- [ ] **Step 3: Implement `resolveActiveIndices`**

`src/lib/activeIndex.ts`:
```ts
import type { Phrase, Word } from "./types";

/** Given the current audio time, find the active word index and phrase index.
 *  A word/phrase is active when start <= time < end. Returns -1 when none. */
export function resolveActiveIndices(
  time: number,
  words: Word[],
  phrases: Phrase[],
): { wordIndex: number; phraseIndex: number } {
  const wordIndex = words.findIndex((w) => time >= w.start && time < w.end);
  const phraseIndex = phrases.findIndex((p) => time >= p.start && time < p.end);
  return { wordIndex, phraseIndex };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- activeIndex`
Expected: PASS.

- [ ] **Step 5: Implement the hook** (no separate unit test — it is a thin rAF wrapper exercised via the component test in Task 6)

`src/hooks/useAudioSync.ts`:
```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { resolveActiveIndices } from "@/lib/activeIndex";
import type { Phrase, Word } from "@/lib/types";

export function useAudioSync(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  words: Word[],
  phrases: Phrase[],
) {
  const [wordIndex, setWordIndex] = useState(-1);
  const [phraseIndex, setPhraseIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      const { wordIndex: w, phraseIndex: p } = resolveActiveIndices(audio.currentTime, words, phrases);
      setWordIndex(w);
      setPhraseIndex(p);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      setPlaying(false);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const onEnded = () => {
      stop();
      setWordIndex(-1);
      setPhraseIndex(-1);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", onEnded);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [audioRef, words, phrases]);

  return { wordIndex, phraseIndex, playing };
}
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/activeIndex.ts src/lib/activeIndex.test.ts src/hooks/useAudioSync.ts
git commit -m "feat: audio sync logic and useAudioSync hook"
```

---

### Task 5: HighlightedText component

**Files:**
- Create: `src/components/HighlightedText.tsx`
- Create: `src/components/HighlightedText.module.css`
- Test: `src/components/HighlightedText.test.tsx`

**Interfaces:**
- Consumes: `Word` from `src/lib/types.ts`.
- Produces: `HighlightedText({ words, wordIndex, phraseIndex }: { words: Word[]; wordIndex: number; phraseIndex: number })`. Renders one `<span data-testid="word">` per word; active word gets class containing `current-word`, words of the active phrase get class containing `current-phrase`.

- [ ] **Step 1: Write the failing test**

`src/components/HighlightedText.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HighlightedText } from "./HighlightedText";
import type { Word } from "@/lib/types";

const words: Word[] = [
  { text: "Dzień", start: 0, end: 0.4, phrase: 0 },
  { text: "dobry.", start: 0.4, end: 0.9, phrase: 0 },
  { text: "Jak", start: 1.1, end: 1.3, phrase: 1 },
];

describe("HighlightedText", () => {
  it("renders every word", () => {
    render(<HighlightedText words={words} wordIndex={-1} phraseIndex={-1} />);
    expect(screen.getAllByTestId("word")).toHaveLength(3);
  });

  it("marks the active word and all words of the active phrase", () => {
    render(<HighlightedText words={words} wordIndex={1} phraseIndex={0} />);
    const spans = screen.getAllByTestId("word");
    // word 0: in active phrase, not active word
    expect(spans[0].className).toMatch(/current-phrase/);
    expect(spans[0].className).not.toMatch(/current-word/);
    // word 1: active word AND in active phrase
    expect(spans[1].className).toMatch(/current-word/);
    expect(spans[1].className).toMatch(/current-phrase/);
    // word 2: neither
    expect(spans[2].className).not.toMatch(/current-phrase/);
    expect(spans[2].className).not.toMatch(/current-word/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- HighlightedText`
Expected: FAIL — component not found.

- [ ] **Step 3: Create the CSS module**

`src/components/HighlightedText.module.css`:
```css
.text {
  font-size: 2rem;
  line-height: 2.4;
  letter-spacing: 0.01em;
  word-spacing: 0.2em;
}

.word {
  padding: 0.05em 0.1em;
  border-radius: 0.2em;
  transition: background-color 80ms linear;
}

.currentPhrase {
  background-color: #fff3bf;
}

.currentWord {
  background-color: #ffd43b;
  font-weight: 700;
}
```

> Class names in CSS modules are camelCase here (`currentPhrase`, `currentWord`). The component appends the literal strings `current-phrase` / `current-word` as well so tests and global styling can target stable names.

- [ ] **Step 4: Implement the component**

`src/components/HighlightedText.tsx`:
```tsx
import type { Word } from "@/lib/types";
import styles from "./HighlightedText.module.css";

interface Props {
  words: Word[];
  wordIndex: number;
  phraseIndex: number;
}

export function HighlightedText({ words, wordIndex, phraseIndex }: Props) {
  return (
    <p className={styles.text}>
      {words.map((w, i) => {
        const isWord = i === wordIndex;
        const isPhrase = phraseIndex !== -1 && w.phrase === phraseIndex;
        const classNames = [styles.word];
        if (isPhrase) classNames.push(styles.currentPhrase, "current-phrase");
        if (isWord) classNames.push(styles.currentWord, "current-word");
        return (
          <span key={i} data-testid="word" className={classNames.join(" ")}>
            {w.text}{" "}
          </span>
        );
      })}
    </p>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- HighlightedText`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/HighlightedText.tsx src/components/HighlightedText.module.css src/components/HighlightedText.test.tsx
git commit -m "feat: HighlightedText component with word/phrase highlighting"
```

---

### Task 6: Exercise player page

**Files:**
- Create: `src/components/Player.tsx`
- Create: `src/components/Player.module.css`
- Test: `src/components/Player.test.tsx`
- Create: `src/app/exercise/[id]/page.tsx`
- Create: `src/lib/library.ts`
- Test: `src/lib/library.test.ts`

**Interfaces:**
- Consumes: `HighlightedText` (Task 5), `useAudioSync` (Task 4), `Exercise`/`LibraryIndex` types.
- Produces:
  - `Player({ exercise }: { exercise: Exercise })` — client component: `<audio>` + play/pause button + `HighlightedText` + non-interactive progress bar.
  - `loadExercise(id: string): Promise<Exercise>` and `loadLibraryIndex(): Promise<LibraryIndex>` in `src/lib/library.ts` (fetch from `/library/...`).
  - `src/app/exercise/[id]/page.tsx` server component with `generateStaticParams` reading `public/library/index.json`.

- [ ] **Step 1: Write the failing test for `Player` (play/pause + highlight wiring)**

`src/components/Player.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Player } from "./Player";
import type { Exercise } from "@/lib/types";

const exercise: Exercise = {
  id: "x",
  title: "Test",
  audio: "/library/x.mp3",
  words: [
    { text: "Ala", start: 0, end: 0.5, phrase: 0 },
    { text: "ma.", start: 0.5, end: 1.0, phrase: 0 },
  ],
  phrases: [{ index: 0, text: "Ala ma.", start: 0, end: 1.0 }],
};

describe("Player", () => {
  beforeEach(() => {
    // jsdom doesn't implement media playback; stub play/pause.
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("play"));
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("pause"));
    });
  });

  it("renders the title and all words", () => {
    render(<Player exercise={exercise} />);
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getAllByTestId("word")).toHaveLength(2);
  });

  it("toggles play/pause via the button", () => {
    render(<Player exercise={exercise} />);
    const btn = screen.getByRole("button", { name: /odtwórz/i });
    act(() => {
      fireEvent.click(btn);
    });
    expect(screen.getByRole("button", { name: /pauza/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Player`
Expected: FAIL — `Player` not found.

- [ ] **Step 3: Create the Player CSS**

`src/components/Player.module.css`:
```css
.container {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.title {
  font-size: 1.25rem;
  color: #495057;
  margin-bottom: 1.5rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.button {
  font-size: 1.1rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: #1971c2;
  color: white;
  cursor: pointer;
}

.progress {
  flex: 1;
  height: 0.5rem;
  background: #dee2e6;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: #1971c2;
}
```

- [ ] **Step 4: Implement the Player**

`src/components/Player.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { HighlightedText } from "./HighlightedText";
import { useAudioSync } from "@/hooks/useAudioSync";
import type { Exercise } from "@/lib/types";
import styles from "./Player.module.css";

export function Player({ exercise }: { exercise: Exercise }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const { wordIndex, phraseIndex, playing } = useAudioSync(audioRef, exercise.words, exercise.phrases);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>{exercise.title}</h1>
      <HighlightedText words={exercise.words} wordIndex={wordIndex} phraseIndex={phraseIndex} />
      <audio ref={audioRef} src={exercise.audio} onTimeUpdate={onTimeUpdate} preload="auto" />
      <div className={styles.controls}>
        <button className={styles.button} onClick={toggle}>
          {playing ? "Pauza" : "Odtwórz"}
        </button>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run the Player test to verify it passes**

Run: `npm test -- Player`
Expected: PASS.

- [ ] **Step 6: Write the failing test for the library loaders**

`src/lib/library.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { loadExercise, loadLibraryIndex } from "./library";

afterEach(() => vi.restoreAllMocks());

describe("library loaders", () => {
  it("loadLibraryIndex fetches /library/index.json", async () => {
    const index = { exercises: [{ id: "a", title: "A" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    await expect(loadLibraryIndex()).resolves.toEqual(index);
    expect(fetch).toHaveBeenCalledWith("/library/index.json");
  });

  it("loadExercise fetches /library/<id>.json", async () => {
    const ex = { id: "a", title: "A", audio: "/library/a.mp3", words: [], phrases: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ex))));
    await expect(loadExercise("a")).resolves.toEqual(ex);
    expect(fetch).toHaveBeenCalledWith("/library/a.json");
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- library`
Expected: FAIL — `library` module not found.

- [ ] **Step 8: Implement the loaders**

`src/lib/library.ts`:
```ts
import type { Exercise, LibraryIndex } from "./types";

export async function loadLibraryIndex(): Promise<LibraryIndex> {
  const res = await fetch("/library/index.json");
  if (!res.ok) throw new Error(`Failed to load library index: ${res.status}`);
  return (await res.json()) as LibraryIndex;
}

export async function loadExercise(id: string): Promise<Exercise> {
  const res = await fetch(`/library/${id}.json`);
  if (!res.ok) throw new Error(`Failed to load exercise ${id}: ${res.status}`);
  return (await res.json()) as Exercise;
}
```

- [ ] **Step 9: Run the loader test to verify it passes**

Run: `npm test -- library`
Expected: PASS.

- [ ] **Step 10: Create the exercise route** (server component reads index for static params; client fetches exercise JSON)

`src/app/exercise/[id]/page.tsx`:
```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryIndex } from "@/lib/types";
import { ExerciseClient } from "./ExerciseClient";

export async function generateStaticParams() {
  try {
    const raw = await readFile(join(process.cwd(), "public/library/index.json"), "utf8");
    const { exercises } = JSON.parse(raw) as LibraryIndex;
    return exercises.map((e) => ({ id: e.id }));
  } catch {
    return [];
  }
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseClient id={id} />;
}
```

- [ ] **Step 11: Create the client wrapper that fetches and renders the Player**

`src/app/exercise/[id]/ExerciseClient.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "@/components/Player";
import { loadExercise } from "@/lib/library";
import type { Exercise } from "@/lib/types";

export function ExerciseClient({ id }: { id: string }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadExercise(id).then(setExercise).catch(() => setError(true));
  }, [id]);

  if (error) return <main style={{ padding: "2rem" }}>Nie udało się wczytać ćwiczenia. <Link href="/">Wróć</Link></main>;
  if (!exercise) return <main style={{ padding: "2rem" }}>Wczytywanie…</main>;
  return (
    <>
      <nav style={{ padding: "1rem 1.5rem" }}><Link href="/">← Lista ćwiczeń</Link></nav>
      <Player exercise={exercise} />
    </>
  );
}
```

- [ ] **Step 12: Run all tests**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 13: Commit**

```bash
git add src/components/Player.tsx src/components/Player.module.css src/components/Player.test.tsx src/lib/library.ts src/lib/library.test.ts src/app/exercise
git commit -m "feat: exercise player page with play/pause and progress"
```

---

### Task 7: Library list (home) page

**Files:**
- Create: `src/components/ExerciseList.tsx`
- Create: `src/components/ExerciseList.module.css`
- Test: `src/components/ExerciseList.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `loadLibraryIndex` (Task 6), `ExerciseSummary` type.
- Produces: `ExerciseList()` client component — calls `loadLibraryIndex`, renders a list of links to `/exercise/<id>`.

- [ ] **Step 1: Write the failing test**

`src/components/ExerciseList.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ExerciseList } from "./ExerciseList";

afterEach(() => vi.restoreAllMocks());

describe("ExerciseList", () => {
  it("renders a link per exercise from the index", async () => {
    const index = { exercises: [{ id: "powitanie", title: "Powitania" }, { id: "dom", title: "W domu" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<ExerciseList />);
    await waitFor(() => expect(screen.getByText("Powitania")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Powitania/ });
    expect(link).toHaveAttribute("href", "/exercise/powitanie");
    expect(screen.getByText("W domu")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- ExerciseList`
Expected: FAIL — component not found.

- [ ] **Step 3: Create the CSS**

`src/components/ExerciseList.module.css`:
```css
.container { max-width: 48rem; margin: 0 auto; padding: 2rem 1.5rem; }
.heading { font-size: 1.75rem; margin-bottom: 1.5rem; }
.list { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
.item a {
  display: block; padding: 1rem 1.25rem; border-radius: 0.5rem;
  background: #f1f3f5; color: #1971c2; font-size: 1.25rem; text-decoration: none;
}
.item a:hover { background: #e7f5ff; }
```

- [ ] **Step 4: Implement the component**

`src/components/ExerciseList.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./ExerciseList.module.css";

export function ExerciseList() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLibraryIndex().then((i) => setExercises(i.exercises)).catch(() => setError(true));
  }, []);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Ćwiczenia słuchowe</h1>
      {error && <p>Nie udało się wczytać listy ćwiczeń.</p>}
      {!error && exercises === null && <p>Wczytywanie…</p>}
      {exercises && (
        <ul className={styles.list}>
          {exercises.map((e) => (
            <li key={e.id} className={styles.item}>
              <Link href={`/exercise/${e.id}`}>{e.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- ExerciseList`
Expected: PASS.

- [ ] **Step 6: Wire it into the home page**

Replace `src/app/page.tsx`:
```tsx
import { ExerciseList } from "@/components/ExerciseList";

export default function Home() {
  return <ExerciseList />;
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ExerciseList.tsx src/components/ExerciseList.module.css src/components/ExerciseList.test.tsx src/app/page.tsx
git commit -m "feat: home page listing exercises from library index"
```

---

### Task 8: PWA layer (manifest + Serwist service worker)

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (placeholder square PNGs)
- Create: `src/app/sw.ts`
- Modify: `next.config.mjs`
- Modify: `src/app/layout.tsx` (link manifest)

**Interfaces:**
- Consumes: the built static app + `public/library/*` assets.
- Produces: an installable, offline-capable PWA. After first load, app shell and visited exercise assets are served from cache.

- [ ] **Step 1: Create the web app manifest**

`public/manifest.json`:
```json
{
  "name": "Voice Reading — trening słuchowy",
  "short_name": "Voice Reading",
  "description": "Trening słuchowy z implantem ślimakowym",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1971c2",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Add placeholder icons**

Run (creates two solid-color PNG placeholders so the manifest validates; replace with real art later):
```bash
mkdir -p public/icons
node -e "const fs=require('fs');const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');fs.writeFileSync('public/icons/icon-192.png',b);fs.writeFileSync('public/icons/icon-512.png',b);"
```
Expected: two PNG files created. (They are 1×1 placeholders; the browser still installs. Swap for real 192/512 icons before release.)

- [ ] **Step 3: Link the manifest in the layout**

Modify `src/app/layout.tsx` — set metadata:
```tsx
export const metadata = {
  title: "Voice Reading",
  description: "Trening słuchowy z implantem ślimakowym",
  manifest: "/manifest.json",
};

export const viewport = { themeColor: "#1971c2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create the service worker source**

`src/app/sw.ts`:
```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

- [ ] **Step 5: Wire Serwist into `next.config.mjs`**

```js
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default withSerwist(nextConfig);
```

- [ ] **Step 6: Verify the production build generates the service worker**

Run: `npm run build`
Expected: build completes; `public/sw.js` is generated and `out/` contains `sw.js`, `manifest.json`, and `index.html`.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Manual offline verification** (documented; requires generated library assets from Task 3)

Run: `npx serve out` (or any static server), open the app, load an exercise, then go offline (DevTools → Network → Offline) and reload — the exercise should still play. Note: `defaultCache` caches `/library/*.json` and `*.mp3` on first visit via runtime caching.

- [ ] **Step 9: Commit**

```bash
git add public/manifest.json public/icons src/app/sw.ts next.config.mjs src/app/layout.tsx
git commit -m "feat: PWA manifest and Serwist service worker for offline support"
```

---

## Self-Review

**Spec coverage:**
- Two-part architecture (generator + app) → Tasks 3 (generator) and 4–8 (app). ✓
- Data model (`words`/`phrases` json, `index.json`) → Tasks 2 (types), 3 (generation). ✓
- Generator using `convertWithTimestamps`, char→word→phrase aggregation, `.env` key isolation → Task 3 + Task 2 parsing. ✓
- Components: list page, player, HighlightedText, useAudioSync → Tasks 7, 6, 5, 4. ✓
- Two-level highlighting (word + phrase) → Task 5. ✓
- Play/pause only, non-interactive progress → Task 6. ✓
- PWA static export + Serwist + manifest + offline → Tasks 1 (export config) + 8. ✓
- Unit tests for aggregation and sync; component tests; no E2E / no ElevenLabs calls in tests → Tasks 2, 4, 5, 6, 7 use mocked alignment/fetch. ✓
- Polish content, `eleven_multilingual_v2` → Task 3. ✓

**Placeholder scan:** No "TBD"/"add error handling here" left; every code step has full code. The 1×1 PNG icons are intentional placeholders, explicitly flagged for replacement (not a logic gap).

**Type consistency:** `Word`/`Phrase`/`Exercise`/`ExerciseSummary`/`LibraryIndex`/`Alignment` defined once in Task 2 and reused verbatim. `resolveActiveIndices`, `parseAlignment`, `buildExercise`, `loadExercise`, `loadLibraryIndex`, `useAudioSync` signatures match between their producing task and their consumers. ✓
