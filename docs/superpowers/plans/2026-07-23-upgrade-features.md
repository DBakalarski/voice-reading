# Upgrade Features (Kroki 1–5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement steps 1–5 from `upgrade.md`: playback tempo control, listen-first mode, phrase repeat/seek, progress tracking, and a comprehension quiz — all frontend/localStorage, no backend.

**Architecture:** All features extend the existing client components (`Player`, `HighlightedText`, `TopicList`, `LevelMenu`) plus two small pure modules (`src/lib/progress.ts` new, `src/lib/activeIndex.ts` extended). The quiz additionally threads an optional `questions` field from `content/index.json` through `scripts/generate.ts` into the exercise JSON files — with a sync path that never spends ElevenLabs quota.

**Tech Stack:** Next.js 15 (static export), React 19, TypeScript, CSS Modules, Vitest + Testing Library (jsdom), localStorage.

**Out of scope:** Krok 6 (own texts via backend proxy) is a separate subsystem with unresolved decisions (storage location, character limits). It needs its own spec + plan. Do NOT start it from this document.

## Global Constraints

- App is a **static export** (`output: "export"`): no server code, no dynamic routes; all pages are client components reading query params.
- Run tests with `npm test` (full suite) or `npx vitest run <path>` (one file). Build check: `npm run build`.
- All UI copy is **Polish** — use the exact strings given in each task (they are part of the spec and asserted by tests).
- All localStorage keys are prefixed `voice-reading:` (existing example: `voice-reading:font-size`).
- Every localStorage **restore** happens inside `useEffect` (never in the initial `useState`) so the first client render matches server HTML — this is the existing pattern in `Player.tsx` for font size; copy it.
- Design tokens live in `src/app/globals.css` (`--paper`, `--ink`, `--muted`, `--accent`, `--accent-deep`, `--accent-tint`, `--word`, `--phrase`, `--line`). Never hard-code colors that a token covers.
- Component tests never touch real media playback: `play()`/`pause()` are stubbed on `HTMLMediaElement.prototype` (see existing `src/components/Player.test.tsx`). For `currentTime`/`duration`, always use `Object.defineProperty` in tests (jsdom support is unreliable).
- Commit after every task. Do not push.
- After the last task of each feature, run the FULL suite (`npm test`) and `npm run build`; both must pass before moving to the next feature.

---

## Feature A — Zmiana tempa czytania (Krok 1)

### Task 1: Playback-rate control in Player

**Files:**
- Modify: `src/components/Player.tsx`
- Modify: `src/components/Player.module.css`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: existing `Player` component; existing `FONT_SIZE_*` localStorage pattern.
- Produces: localStorage key `voice-reading:rate` storing `"0.75" | "0.9" | "1"`; controls bar restructured into two `.controlsRow` divs (later tasks insert buttons into these rows).

- [x] **Step 1: Write the failing tests**

Append to the `describe("Player", ...)` block in `src/components/Player.test.tsx`:

```tsx
  it("changes playback rate and persists it", () => {
    render(<Player exercise={exercise} />);
    const btn = screen.getByRole("button", { name: "0,9×" });
    fireEvent.click(btn);
    const audio = document.querySelector("audio")!;
    expect(audio.playbackRate).toBe(0.9);
    expect(localStorage.getItem("voice-reading:rate")).toBe("0.9");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the saved playback rate on mount", () => {
    localStorage.setItem("voice-reading:rate", "0.75");
    render(<Player exercise={exercise} />);
    expect(screen.getByRole("button", { name: "0,75×" })).toHaveAttribute("aria-pressed", "true");
  });
```

Also add `localStorage.clear();` as the FIRST line inside the existing `beforeEach(() => { ... })` (before the media stubs) so saved font size/rate never leaks between tests.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: 2 new tests FAIL with "Unable to find an accessible element with the role button and name 0,9×". The 2 existing tests still pass.

- [x] **Step 3: Implement**

In `src/components/Player.tsx`, add below the `FONT_SIZE_STEP` constant:

```tsx
const RATE_KEY = "voice-reading:rate";
const RATES = [0.75, 0.9, 1];
/** "0,75×" — Polish decimal comma. */
const formatRate = (r: number) => `${String(r).replace(".", ",")}×`;
```

Inside the `Player` function, below the `fontSize` state + its restore effect, add:

```tsx
  // Reader-chosen playback tempo, persisted like the font size.
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const saved = window.localStorage.getItem(RATE_KEY);
    const parsed = saved === null ? NaN : Number(saved);
    if (RATES.includes(parsed)) setRate(parsed);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const apply = () => {
      // Slower voice at the same pitch. Modern browsers default to true;
      // set it explicitly so older Safari behaves the same.
      audio.preservesPitch = true;
      audio.playbackRate = rate;
    };
    apply();
    // Loading a new src resets playbackRate — re-apply once metadata arrives.
    audio.addEventListener("loadedmetadata", apply);
    return () => audio.removeEventListener("loadedmetadata", apply);
  }, [rate, exercise.audio]);

  const changeRate = (r: number) => {
    setRate(r);
    window.localStorage.setItem(RATE_KEY, String(r));
  };
```

Replace the whole `<div className={styles.controls}>...</div>` JSX block with this two-row layout (play button + progress unchanged, just re-nested; rate group is new):

```tsx
      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          <button
            className={styles.button}
            onClick={toggle}
            aria-label={playing ? "Pauza" : "Odtwórz"}
            title={playing ? "Pauza" : "Odtwórz"}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
              </svg>
            )}
          </button>
          <div className={styles.progress}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className={styles.controlsRow}>
          <div className={styles.rateControls} role="group" aria-label="Tempo odtwarzania">
            {RATES.map((r) => (
              <button
                key={r}
                className={styles.rateButton}
                onClick={() => changeRate(r)}
                aria-pressed={rate === r}
              >
                {formatRate(r)}
              </button>
            ))}
          </div>
          <div className={styles.fontControls} role="group" aria-label="Rozmiar tekstu">
            {/* keep the existing A− / A+ buttons exactly as they are */}
          </div>
        </div>
      </div>
```

(Keep the existing A−/A+ button JSX inside `fontControls` — only the wrapper structure changes.)

In `src/components/Player.module.css`, replace the `.controls` rule and add row/rate rules:

```css
.controls {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 0;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}

.controlsRow {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.rateControls {
  display: flex;
  gap: 0.4rem;
}

.rateButton {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1;
  min-width: 3.1rem;
  min-height: 2.75rem;
  padding: 0.5rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  transition: border-color 120ms ease;
}

.rateButton:hover[aria-pressed="false"] {
  border-color: var(--accent);
}

.rateButton[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
```

And add `margin-left: auto;` to the existing `.fontControls` rule (pushes it to the right edge of row 2).

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: ALL tests PASS (4 total).

- [x] **Step 5: Full suite + build, then commit**

Run: `npm test` → all pass. Run: `npm run build` → succeeds.

```bash
git add src/components/Player.tsx src/components/Player.module.css src/components/Player.test.tsx
git commit -m "feat(player): playback tempo control 0.75/0.9/1 with persistence"
```

---

## Feature B — Tryb „Najpierw słuchaj" (Krok 2)

### Task 2: Listen-first mode in Player

**Files:**
- Modify: `src/components/Player.tsx`
- Modify: `src/components/Player.module.css`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: Task 1's Player layout (mode toggle goes BELOW the `.controls` div).
- Produces: localStorage key `voice-reading:mode` storing `"read" | "listen"`; Player state `revealed: boolean` (Task 13's quiz does not depend on it).

- [x] **Step 1: Write the failing tests**

Append to `src/components/Player.test.tsx`:

```tsx
  it("hides the text in listen-first mode until revealed", () => {
    render(<Player exercise={exercise} />);
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
    expect(localStorage.getItem("voice-reading:mode")).toBe("listen");

    fireEvent.click(screen.getByRole("button", { name: "Pokaż tekst" }));
    expect(screen.getAllByTestId("word")).toHaveLength(2);
  });

  it("restores listen-first mode from localStorage", () => {
    localStorage.setItem("voice-reading:mode", "listen");
    render(<Player exercise={exercise} />);
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Najpierw słuchaj" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("re-covers the text when switching back to listen-first", () => {
    render(<Player exercise={exercise} />);
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokaż tekst" }));
    fireEvent.click(screen.getByRole("button", { name: "Słuchaj i czytaj" }));
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: 3 new tests FAIL ("Unable to find ... name Najpierw słuchaj").

- [x] **Step 3: Implement**

In `src/components/Player.tsx`, add below the `formatRate` constant:

```tsx
const MODE_KEY = "voice-reading:mode";
type Mode = "read" | "listen";
```

Inside `Player`, below the rate state/effects, add:

```tsx
  // "read" shows the text immediately; "listen" covers it until revealed.
  const [mode, setMode] = useState<Mode>("read");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(MODE_KEY);
    if (saved === "read" || saved === "listen") setMode(saved);
  }, []);

  // A new exercise always starts covered again.
  useEffect(() => setRevealed(false), [exercise.id]);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === "listen") setRevealed(false);
    window.localStorage.setItem(MODE_KEY, m);
  };
```

In the JSX, directly AFTER the closing `</div>` of `styles.controls` and BEFORE the `<h1 className={styles.title}>`, add:

```tsx
      <div className={styles.modeControls} role="group" aria-label="Tryb ćwiczenia">
        <button
          className={styles.modeButton}
          onClick={() => switchMode("read")}
          aria-pressed={mode === "read"}
        >
          Słuchaj i czytaj
        </button>
        <button
          className={styles.modeButton}
          onClick={() => switchMode("listen")}
          aria-pressed={mode === "listen"}
        >
          Najpierw słuchaj
        </button>
      </div>
```

Replace the `<HighlightedText ... />` element with:

```tsx
      {mode === "listen" && !revealed ? (
        <div className={styles.cover}>
          <p className={styles.coverText}>
            Posłuchaj nagrania i spróbuj zrozumieć, o czym jest. Możesz odtworzyć je
            wiele razy.
          </p>
          <button className={styles.coverButton} onClick={() => setRevealed(true)}>
            Pokaż tekst
          </button>
        </div>
      ) : (
        <HighlightedText
          words={exercise.words}
          wordIndex={wordIndex}
          phraseIndex={phraseIndex}
          fontSize={fontSize}
        />
      )}
```

Append to `src/components/Player.module.css`:

```css
.modeControls {
  display: inline-flex;
  margin-top: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  overflow: hidden;
}

.modeButton {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.6rem 1rem;
  min-height: 2.75rem;
  border: none;
  background: #fff;
  color: var(--muted);
  cursor: pointer;
}

.modeButton[aria-pressed="true"] {
  background: var(--accent);
  color: #fff;
}

.cover {
  margin-top: 1rem;
  padding: 2.5rem 1.5rem;
  border: 1px dashed var(--line);
  border-radius: 0.9rem;
  background: var(--surface);
  text-align: center;
}

.coverText {
  color: var(--muted);
  font-size: 1.1rem;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.coverButton {
  font-size: 1.05rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.6rem;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.coverButton:hover {
  background: var(--accent-deep);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: ALL PASS (7 total).

- [x] **Step 5: Full suite + build, then commit**

Run: `npm test` and `npm run build` → both pass.

```bash
git add src/components/Player.tsx src/components/Player.module.css src/components/Player.test.tsx
git commit -m "feat(player): listen-first mode with covered text and reveal"
```

---

## Feature C — Powtórka zdania i nawigacja frazami (Krok 3)

### Task 3: `phraseToRepeat` helper

**Files:**
- Modify: `src/lib/activeIndex.ts`
- Test: `src/lib/activeIndex.test.ts`

**Interfaces:**
- Produces: `phraseToRepeat(time: number, phrases: Phrase[]): number` — index of the phrase containing `time`, else the last phrase started before `time`, else `-1`. Used by Task 4.

- [x] **Step 1: Write the failing tests**

Append to `src/lib/activeIndex.test.ts` (add `phraseToRepeat` to the existing import from `./activeIndex`, and `Phrase` to the type import from `./types` if not already there):

```ts
describe("phraseToRepeat", () => {
  const phrases: Phrase[] = [
    { index: 0, text: "Pierwsze zdanie.", start: 0.5, end: 2 },
    { index: 1, text: "Drugie zdanie.", start: 2.5, end: 4 },
  ];

  it("returns -1 before the first phrase", () => {
    expect(phraseToRepeat(0.2, phrases)).toBe(-1);
  });

  it("returns the phrase containing the time", () => {
    expect(phraseToRepeat(3, phrases)).toBe(1);
  });

  it("returns the previous phrase inside a gap between phrases", () => {
    expect(phraseToRepeat(2.2, phrases)).toBe(0);
  });

  it("returns the last phrase after the audio end", () => {
    expect(phraseToRepeat(99, phrases)).toBe(1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/activeIndex.test.ts`
Expected: FAIL — `phraseToRepeat` is not exported.

- [x] **Step 3: Implement**

Append to `src/lib/activeIndex.ts`:

```ts
/** Phrase to jump back to when repeating: the phrase containing `time`,
 *  otherwise the last phrase that started before it. -1 before the first. */
export function phraseToRepeat(time: number, phrases: Phrase[]): number {
  for (let i = phrases.length - 1; i >= 0; i--) {
    if (time >= phrases[i].start) return i;
  }
  return -1;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/activeIndex.test.ts` → ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/activeIndex.ts src/lib/activeIndex.test.ts
git commit -m "feat(lib): phraseToRepeat resolves the phrase to jump back to"
```

### Task 4: „Powtórz zdanie" button

**Files:**
- Modify: `src/components/Player.tsx`
- Modify: `src/components/Player.module.css`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: `phraseToRepeat` from `@/lib/activeIndex` (Task 3); Task 1's `.controlsRow` layout.
- Produces: `.secondaryButton` CSS class (reused nowhere else yet).

- [x] **Step 1: Write the failing test**

Append to `src/components/Player.test.tsx`. It needs a 2-phrase exercise, defined locally in the test:

```tsx
  it("repeats the current phrase from its start and plays", () => {
    const twoPhrases: Exercise = {
      id: "y",
      title: "Dwa zdania",
      audio: "/library/y.mp3",
      words: [
        { text: "Raz.", start: 0, end: 1, phrase: 0 },
        { text: "Dwa.", start: 1.5, end: 2.5, phrase: 1 },
      ],
      phrases: [
        { index: 0, text: "Raz.", start: 0, end: 1 },
        { index: 1, text: "Dwa.", start: 1.5, end: 2.5 },
      ],
    };
    render(<Player exercise={twoPhrases} />);
    const audio = document.querySelector("audio")!;
    let time = 2.0; // inside phrase 1
    Object.defineProperty(audio, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
      configurable: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Powtórz zdanie" }));
    expect(time).toBe(1.5);
    expect(screen.getByRole("button", { name: /pauza/i })).toBeInTheDocument();
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: new test FAILS ("Unable to find ... Powtórz zdanie").

- [x] **Step 3: Implement**

In `src/components/Player.tsx`:

Add to the imports: `import { phraseToRepeat } from "@/lib/activeIndex";`

Inside `Player`, below the `toggle` function, add:

```tsx
  const repeatPhrase = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const i = phraseToRepeat(audio.currentTime, exercise.phrases);
    audio.currentTime = i === -1 ? 0 : exercise.phrases[i].start;
    void audio.play();
  };
```

In the JSX, inside the FIRST `.controlsRow`, between the play `<button>` and the progress `<div>`, add:

```tsx
          <button
            className={styles.secondaryButton}
            onClick={repeatPhrase}
            aria-label="Powtórz zdanie"
            title="Powtórz zdanie"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
              <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
```

Append to `src/components/Player.module.css`:

```css
.secondaryButton {
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  transition: border-color 120ms ease;
}

.secondaryButton:hover {
  border-color: var(--accent);
}

.secondaryButton svg {
  width: 1.2rem;
  height: 1.2rem;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx` → ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/Player.tsx src/components/Player.module.css src/components/Player.test.tsx
git commit -m "feat(player): repeat-current-phrase button"
```

### Task 5: Click a phrase to seek

**Files:**
- Modify: `src/components/HighlightedText.tsx`
- Modify: `src/components/HighlightedText.module.css`
- Modify: `src/components/Player.tsx`
- Test: `src/components/HighlightedText.test.tsx`, `src/components/Player.test.tsx`

**Interfaces:**
- Produces: `HighlightedText` prop `onPhraseClick?: (phrase: number) => void` (word click reports its `phrase` number).
- Consumes: nothing new in Player beyond `audioRef` and `exercise.phrases`.

- [x] **Step 1: Write the failing tests**

In `src/components/HighlightedText.test.tsx`, extend the vitest import to `import { describe, it, expect, vi } from "vitest";` and the testing-library import to include `fireEvent`. Append:

```tsx
  it("reports the clicked word's phrase index", () => {
    const onPhraseClick = vi.fn();
    render(
      <HighlightedText
        words={words}
        wordIndex={-1}
        phraseIndex={-1}
        onPhraseClick={onPhraseClick}
      />,
    );
    fireEvent.click(screen.getAllByTestId("word")[2]); // "Jak" belongs to phrase 1
    expect(onPhraseClick).toHaveBeenCalledWith(1);
  });
```

In `src/components/Player.test.tsx`, append:

```tsx
  it("seeks to the start of a clicked phrase", () => {
    render(<Player exercise={exercise} />);
    const audio = document.querySelector("audio")!;
    let time = 0.9;
    Object.defineProperty(audio, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
      configurable: true,
    });
    fireEvent.click(screen.getAllByTestId("word")[0]); // phrase 0 starts at 0
    expect(time).toBe(0);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/HighlightedText.test.tsx src/components/Player.test.tsx`
Expected: HighlightedText test fails (`onPhraseClick` never called); Player test fails (time stays 0.9).

- [x] **Step 3: Implement**

In `src/components/HighlightedText.tsx`:

1. Extend `Props`:

```tsx
interface Props {
  words: Word[];
  wordIndex: number;
  phraseIndex: number;
  /** Text size in rem; overrides the CSS default when provided. */
  fontSize?: number;
  /** Called with the phrase number of a clicked word (tap-to-seek). */
  onPhraseClick?: (phrase: number) => void;
}
```

2. Update the function signature to destructure `onPhraseClick`.

3. Change the `<p>` opening tag so clickability is styleable:

```tsx
    <p
      className={onPhraseClick ? `${styles.text} ${styles.clickable}` : styles.text}
      style={fontSize ? { fontSize: `${fontSize}rem` } : undefined}
    >
```

4. Add an `onClick` to the word `<span>` (keep every existing attribute):

```tsx
          <span
            key={i}
            ref={isWord ? activeWordRef : undefined}
            data-testid="word"
            className={classNames.join(" ")}
            onClick={onPhraseClick ? () => onPhraseClick(w.phrase) : undefined}
          >
```

Append to `src/components/HighlightedText.module.css`:

```css
.clickable .word {
  cursor: pointer;
}
```

In `src/components/Player.tsx`, below `repeatPhrase`, add:

```tsx
  const seekToPhrase = (phrase: number) => {
    const audio = audioRef.current;
    const p = exercise.phrases[phrase];
    if (!audio || !p) return;
    audio.currentTime = p.start;
    void audio.play();
  };
```

and pass it to the text (only the non-covered branch renders it):

```tsx
        <HighlightedText
          words={exercise.words}
          wordIndex={wordIndex}
          phraseIndex={phraseIndex}
          fontSize={fontSize}
          onPhraseClick={seekToPhrase}
        />
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/HighlightedText.test.tsx src/components/Player.test.tsx` → ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/HighlightedText.tsx src/components/HighlightedText.module.css src/components/HighlightedText.test.tsx src/components/Player.tsx src/components/Player.test.tsx
git commit -m "feat(reader): tap a phrase to seek playback to its start"
```

### Task 6: Interactive progress slider

**Files:**
- Modify: `src/components/Player.tsx`
- Modify: `src/components/Player.module.css`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: Task 1's row layout (`.progress` sits in row 1).
- Produces: the progress bar becomes `<input type="range">` with `aria-label="Postęp odtwarzania"`; `.progressFill` is deleted.

- [x] **Step 1: Write the failing test**

Append to `src/components/Player.test.tsx`:

```tsx
  it("seeks when the progress slider changes", () => {
    render(<Player exercise={exercise} />);
    const audio = document.querySelector("audio")!;
    let time = 0;
    Object.defineProperty(audio, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
      configurable: true,
    });
    Object.defineProperty(audio, "duration", { value: 10, configurable: true });
    const slider = screen.getByRole("slider", { name: "Postęp odtwarzania" });
    fireEvent.change(slider, { target: { value: "50" } });
    expect(time).toBe(5);
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: FAIL — no element with role `slider`.

- [x] **Step 3: Implement**

In `src/components/Player.tsx`, below `seekToPhrase`, add:

```tsx
  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const pct = Number(e.target.value);
    audio.currentTime = (pct / 100) * audio.duration;
    setProgress(pct);
  };
```

Replace the progress `<div>` (both lines, including `progressFill`) with:

```tsx
          <input
            type="range"
            className={styles.progress}
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={onSeek}
            aria-label="Postęp odtwarzania"
            style={{ "--pct": `${progress}%` } as React.CSSProperties}
          />
```

In `src/components/Player.module.css`, DELETE the `.progressFill` rule and replace the `.progress` rule with:

```css
.progress {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 0.375rem;
  border-radius: 0.25rem;
  background: linear-gradient(
    to right,
    var(--accent) var(--pct, 0%),
    var(--line) var(--pct, 0%)
  );
  cursor: pointer;
  margin: 0;
}

.progress::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(42, 39, 34, 0.3);
}

.progress::-moz-range-thumb {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(42, 39, 34, 0.3);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx` → ALL PASS.

- [x] **Step 5: Full suite + build, then commit**

Run: `npm test` and `npm run build` → both pass.

```bash
git add src/components/Player.tsx src/components/Player.module.css src/components/Player.test.tsx
git commit -m "feat(player): draggable progress slider for seeking"
```

---

## Feature D — Śledzenie postępów i „Kontynuuj" (Krok 4)

### Task 7: `progress` storage module

**Files:**
- Create: `src/lib/progress.ts`
- Test: `src/lib/progress.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 8–10 and 13):

```ts
interface LastPosition { id: string; seconds: number }
interface ProgressData {
  completed: string[];
  last?: LastPosition;
  days: string[]; // "YYYY-MM-DD", sorted ascending, unique
  quiz?: Record<string, { correct: number; total: number }>;
}
loadProgress(): ProgressData
markCompleted(id: string): void
isCompleted(id: string): boolean
saveLastPosition(id: string, seconds: number): void
lastPosition(): LastPosition | undefined
recordPracticeDay(day: string): void
todayKey(now?: Date): string          // local date as "YYYY-MM-DD"
streakFrom(days: string[], today: string): number  // pure
streak(today: string): number
saveQuizResult(id: string, correct: number, total: number): void
```

- [x] **Step 1: Write the failing tests**

Create `src/lib/progress.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadProgress,
  markCompleted,
  isCompleted,
  saveLastPosition,
  lastPosition,
  recordPracticeDay,
  todayKey,
  streakFrom,
  streak,
  saveQuizResult,
} from "./progress";

beforeEach(() => localStorage.clear());

describe("progress storage", () => {
  it("returns empty defaults when nothing is stored", () => {
    expect(loadProgress()).toEqual({ completed: [], days: [] });
    expect(lastPosition()).toBeUndefined();
    expect(isCompleted("x")).toBe(false);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("voice-reading:progress", "not json{");
    expect(loadProgress()).toEqual({ completed: [], days: [] });
  });

  it("marks completed exactly once", () => {
    markCompleted("a");
    markCompleted("a");
    markCompleted("b");
    expect(loadProgress().completed).toEqual(["a", "b"]);
    expect(isCompleted("a")).toBe(true);
  });

  it("stores and overwrites the last position", () => {
    saveLastPosition("a", 12.5);
    saveLastPosition("b", 3);
    expect(lastPosition()).toEqual({ id: "b", seconds: 3 });
  });

  it("records practice days uniquely and sorted", () => {
    recordPracticeDay("2026-07-23");
    recordPracticeDay("2026-07-21");
    recordPracticeDay("2026-07-23");
    expect(loadProgress().days).toEqual(["2026-07-21", "2026-07-23"]);
  });

  it("stores quiz results per exercise", () => {
    saveQuizResult("a", 2, 3);
    saveQuizResult("a", 3, 3);
    expect(loadProgress().quiz).toEqual({ a: { correct: 3, total: 3 } });
  });
});

describe("todayKey", () => {
  it("formats a local date with zero padding", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("streakFrom", () => {
  it("is 0 with no days", () => {
    expect(streakFrom([], "2026-07-23")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(streakFrom(["2026-07-21", "2026-07-22", "2026-07-23"], "2026-07-23")).toBe(3);
  });

  it("keeps yesterday's streak alive (today not yet practiced)", () => {
    expect(streakFrom(["2026-07-21", "2026-07-22"], "2026-07-23")).toBe(2);
  });

  it("breaks on a gap", () => {
    expect(streakFrom(["2026-07-19", "2026-07-20", "2026-07-23"], "2026-07-23")).toBe(1);
  });

  it("is 0 when the last practice was before yesterday", () => {
    expect(streakFrom(["2026-07-19"], "2026-07-23")).toBe(0);
  });

  it("crosses month boundaries", () => {
    expect(streakFrom(["2026-06-30", "2026-07-01"], "2026-07-01")).toBe(2);
  });
});

describe("streak (reads storage)", () => {
  it("uses the stored practice days", () => {
    recordPracticeDay("2026-07-22");
    recordPracticeDay("2026-07-23");
    expect(streak("2026-07-23")).toBe(2);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: FAIL — module `./progress` does not exist.

- [x] **Step 3: Implement**

Create `src/lib/progress.ts`:

```ts
/** Local, offline progress tracking. Everything lives under one localStorage
 *  key; every accessor degrades to safe defaults when storage is missing,
 *  corrupt, or blocked (private mode). */

export interface LastPosition {
  id: string;
  seconds: number;
}

export interface ProgressData {
  /** Ids of exercises listened to the end. */
  completed: string[];
  /** Most recently played exercise and position, for "Kontynuuj". */
  last?: LastPosition;
  /** Practice days as local "YYYY-MM-DD", sorted ascending, unique. */
  days: string[];
  /** Latest quiz score per exercise id. */
  quiz?: Record<string, { correct: number; total: number }>;
}

const KEY = "voice-reading:progress";

export function loadProgress(): ProgressData {
  if (typeof window === "undefined") return { completed: [], days: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { completed: [], days: [] };
    const data = JSON.parse(raw) as ProgressData;
    const result: ProgressData = {
      completed: Array.isArray(data.completed) ? data.completed : [],
      days: Array.isArray(data.days) ? data.days : [],
    };
    if (data.last && typeof data.last.id === "string") result.last = data.last;
    if (data.quiz && typeof data.quiz === "object") result.quiz = data.quiz;
    return result;
  } catch {
    return { completed: [], days: [] };
  }
}

function save(data: ProgressData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked — progress is a nice-to-have, never crash */
  }
}

export function markCompleted(id: string): void {
  const p = loadProgress();
  if (!p.completed.includes(id)) {
    p.completed.push(id);
    save(p);
  }
}

export function isCompleted(id: string): boolean {
  return loadProgress().completed.includes(id);
}

export function saveLastPosition(id: string, seconds: number): void {
  const p = loadProgress();
  p.last = { id, seconds };
  save(p);
}

export function lastPosition(): LastPosition | undefined {
  return loadProgress().last;
}

export function recordPracticeDay(day: string): void {
  const p = loadProgress();
  if (!p.days.includes(day)) {
    p.days.push(day);
    p.days.sort();
    save(p);
  }
}

export function saveQuizResult(id: string, correct: number, total: number): void {
  const p = loadProgress();
  p.quiz = { ...(p.quiz ?? {}), [id]: { correct, total } };
  save(p);
}

/** Local date as "YYYY-MM-DD" (NOT toISOString, which is UTC). */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day count since epoch; rounding absorbs DST/timezone offsets (<12h). */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / 86_400_000);
}

/** Consecutive practice days ending today — or ending yesterday, so the
 *  streak survives until today's session actually happens. */
export function streakFrom(days: string[], today: string): number {
  const set = new Set(days.map(dayNumber));
  let cur = dayNumber(today);
  if (!set.has(cur)) cur -= 1;
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur--;
  }
  return n;
}

export function streak(today: string): number {
  return streakFrom(loadProgress().days, today);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/progress.test.ts` → ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat(lib): localStorage progress module (completed, last position, streak, quiz)"
```

### Task 8: Player records progress and resumes

**Files:**
- Modify: `src/components/Player.tsx`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: `markCompleted`, `saveLastPosition`, `lastPosition`, `recordPracticeDay`, `todayKey` from `@/lib/progress` (Task 7).
- Produces: audio `ended` → exercise completed + practice day recorded + position reset; `pause` → position saved; `loadedmetadata` → resume if this exercise was the last one. Task 13 extends the same `ended` handler with `setFinished(true)`.

- [x] **Step 1: Write the failing tests**

Append to `src/components/Player.test.tsx`:

```tsx
  it("marks the exercise completed when audio ends", () => {
    render(<Player exercise={exercise} />);
    const audio = document.querySelector("audio")!;
    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });
    const stored = JSON.parse(localStorage.getItem("voice-reading:progress")!);
    expect(stored.completed).toContain("x");
    expect(stored.days).toHaveLength(1);
  });

  it("saves the position on pause", () => {
    render(<Player exercise={exercise} />);
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "currentTime", { value: 0.7, configurable: true });
    act(() => {
      audio.dispatchEvent(new Event("pause"));
    });
    const stored = JSON.parse(localStorage.getItem("voice-reading:progress")!);
    expect(stored.last).toEqual({ id: "x", seconds: 0.7 });
  });

  it("resumes from the saved position of the same exercise", () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: [], days: [], last: { id: "x", seconds: 0.5 } }),
    );
    render(<Player exercise={exercise} />);
    const audio = document.querySelector("audio")!;
    let time = 0;
    Object.defineProperty(audio, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
      configurable: true,
    });
    Object.defineProperty(audio, "duration", { value: 10, configurable: true });
    act(() => {
      audio.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(time).toBe(0.5);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: 3 new tests FAIL (nothing writes `voice-reading:progress`).

- [x] **Step 3: Implement**

In `src/components/Player.tsx` add the import:

```tsx
import {
  lastPosition,
  markCompleted,
  recordPracticeDay,
  saveLastPosition,
  todayKey,
} from "@/lib/progress";
```

Inside `Player`, below the mode effects, add ONE effect wiring all progress events:

```tsx
  // Progress bookkeeping: what was played, how far, and on which days.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => recordPracticeDay(todayKey());
    const onPause = () => saveLastPosition(exercise.id, audio.currentTime);
    const onEnded = () => {
      markCompleted(exercise.id);
      recordPracticeDay(todayKey());
      saveLastPosition(exercise.id, 0);
    };
    const onLoaded = () => {
      const last = lastPosition();
      if (!last || last.id !== exercise.id || last.seconds <= 0) return;
      // Don't resume within the final second — treat as finished.
      if (Number.isFinite(audio.duration) && last.seconds >= audio.duration - 1) return;
      audio.currentTime = last.seconds;
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoaded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [exercise.id]);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx` → ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/Player.tsx src/components/Player.test.tsx
git commit -m "feat(player): record completion, practice days and resume position"
```

### Task 9: Completed badge on topic lists

**Files:**
- Modify: `src/components/TopicList.tsx`
- Modify: `src/components/Library.module.css`
- Test: `src/components/TopicList.test.tsx`

**Interfaces:**
- Consumes: `loadProgress` from `@/lib/progress`.
- Produces: completed topics show a ✓ badge (`role="img"`, `aria-label="Ukończone"`); topic titles are wrapped in `.itemTitle`.

- [x] **Step 1: Write the failing test**

In `src/components/TopicList.test.tsx`, add `localStorage.clear();` at the top of the existing `beforeEach`/setup (if the file has no `beforeEach`, add `beforeEach(() => localStorage.clear());` below the imports, importing `beforeEach` from vitest). Then append inside the describe block (mirror the file's existing fetch-stub + history pattern — copy the setup lines from the first test in the file, they stub `fetch` and set `window.history.replaceState` to select the level):

```tsx
  it("shows a completed badge for finished exercises", async () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: ["l1-poranek"], days: [] }),
    );
    const index = {
      exercises: [
        { id: "l1-poranek", title: "Poranek", level: 1 },
        { id: "l1-liczby", title: "Liczby", level: 1 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    window.history.replaceState(null, "", "/level?level=1");
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Poranek")).toBeInTheDocument());
    expect(screen.getByRole("img", { name: "Ukończone" })).toBeInTheDocument();
    // Only one badge — "Liczby" is not completed.
    expect(screen.getAllByRole("img", { name: "Ukończone" })).toHaveLength(1);
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TopicList.test.tsx`
Expected: new test FAILS (no `img` role element).

- [x] **Step 3: Implement**

In `src/components/TopicList.tsx`:

1. Add import: `import { loadProgress } from "@/lib/progress";`
2. Add state below the existing ones:

```tsx
  const [completed, setCompleted] = useState<Set<string>>(new Set());
```

3. Inside the existing `useEffect`, after the `loadLibraryIndex()` call chain, add:

```tsx
    setCompleted(new Set(loadProgress().completed));
```

4. Replace the topic `<li>` rendering with:

```tsx
            <li key={e.id} className={styles.item}>
              <Link href={`/exercise?id=${e.id}`}>
                <span className={styles.itemTitle}>{e.title}</span>
                {completed.has(e.id) && (
                  <span className={styles.done} role="img" aria-label="Ukończone">
                    ✓
                  </span>
                )}
              </Link>
            </li>
```

Append to `src/components/Library.module.css`:

```css
.itemTitle {
  flex: 1;
}

.done {
  color: var(--accent);
  font-weight: 700;
  font-size: 1.1rem;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/TopicList.test.tsx` → ALL PASS (including the two pre-existing tests — the badge renders only for completed ids, so their accessible link names are unchanged).

- [x] **Step 5: Commit**

```bash
git add src/components/TopicList.tsx src/components/Library.module.css src/components/TopicList.test.tsx
git commit -m "feat(library): completed checkmark on topic lists"
```

### Task 10: „Kontynuuj" card and streak on the home screen

**Files:**
- Modify: `src/components/LevelMenu.tsx`
- Modify: `src/components/Library.module.css`
- Test: `src/components/LevelMenu.test.tsx`

**Interfaces:**
- Consumes: `lastPosition`, `streak`, `todayKey` from `@/lib/progress`; existing `loadLibraryIndex`.
- Produces: home shows a "Kontynuuj" card (top of list) when the last-played exercise still exists in the index, and a streak line when `streak >= 2`.

- [x] **Step 1: Write the failing tests**

In `src/components/LevelMenu.test.tsx`, add `beforeEach` to the vitest import and below the `afterEach` line add:

```tsx
beforeEach(() => localStorage.clear());
```

Append inside the describe block:

```tsx
  it("shows a continue card for the last played exercise", async () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: [], days: [], last: { id: "a", seconds: 10 } }),
    );
    const index = { exercises: [{ id: "a", title: "Poranek", level: 1 }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() => expect(screen.getByText("Kontynuuj")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Kontynuuj/ });
    expect(link).toHaveAttribute("href", "/exercise?id=a");
  });

  it("shows the practice streak when it is at least 2 days", async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: [], days: [key(yesterday), key(today)] }),
    );
    const index = { exercises: [{ id: "a", title: "A", level: 1 }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() =>
      expect(screen.getByText("Ćwiczysz 2 dni z rzędu — tak trzymaj!")).toBeInTheDocument(),
    );
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/LevelMenu.test.tsx`
Expected: 2 new tests FAIL.

- [x] **Step 3: Implement**

In `src/components/LevelMenu.tsx`:

1. Add import: `import { lastPosition, streak, todayKey, type LastPosition } from "@/lib/progress";`
2. Add state below the existing ones:

```tsx
  const [last, setLast] = useState<LastPosition | undefined>(undefined);
  const [streakDays, setStreakDays] = useState(0);
```

3. Inside the existing `useEffect`, after the `loadLibraryIndex()` chain, add:

```tsx
    setLast(lastPosition());
    setStreakDays(streak(todayKey()));
```

4. Directly below the `<p className={styles.subheading}>` line, add:

```tsx
      {streakDays >= 2 && (
        <p className={styles.streak}>Ćwiczysz {streakDays} dni z rzędu — tak trzymaj!</p>
      )}
```

5. Inside the `<ul className={styles.list}>`, BEFORE the `LEVELS.map`, add:

```tsx
          {(() => {
            const lastEx = last && exercises.find((e) => e.id === last.id);
            if (!lastEx) return null;
            return (
              <li key="continue">
                <Link href={`/exercise?id=${lastEx.id}`} className={styles.continueCard}>
                  <span className={styles.cardMeta}>Kontynuuj</span>
                  <span className={styles.cardTitle}>{lastEx.title}</span>
                </Link>
              </li>
            );
          })()}
```

Append to `src/components/Library.module.css`:

```css
.streak {
  color: var(--accent);
  font-weight: 600;
  font-size: 0.95rem;
  margin: -1.25rem 0 2rem;
}

.continueCard {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.1rem 1.4rem;
  border: 1px solid var(--accent);
  border-radius: 0.9rem;
  background: var(--accent-tint);
  text-decoration: none;
  transition: box-shadow 120ms ease;
}

.continueCard:hover {
  box-shadow: 0 2px 10px rgba(42, 39, 34, 0.07);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/LevelMenu.test.tsx` → ALL PASS.

- [x] **Step 5: Full suite + build, then commit**

Run: `npm test` and `npm run build` → both pass.

```bash
git add src/components/LevelMenu.tsx src/components/Library.module.css src/components/LevelMenu.test.tsx
git commit -m "feat(home): continue card and practice streak"
```

---

## Feature E — Sprawdzenie zrozumienia (Krok 5)

### Task 11: `Question` data model through the generate pipeline

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/exercise.ts`
- Modify: `scripts/generate.ts`
- Test: `src/lib/exercise.test.ts`

**Interfaces:**
- Produces:

```ts
interface Question { question: string; answers: string[]; correct: number }
// ContentItem.questions?: Question[]  and  Exercise.questions?: Question[]
buildExercise(id, title, alignment, next?, questions?: Question[]): Exercise
```

  plus: `npm run generate` copies `questions` from `content/index.json` into already-generated `public/library/<id>.json` files WITHOUT calling the ElevenLabs API.

- [ ] **Step 1: Write the failing test**

Append inside the `describe("buildExercise", ...)` block of `src/lib/exercise.test.ts` (the file already defines an `align(text: string): Alignment` helper at the top — use it):

```ts
  it("passes questions through to the exercise when provided", () => {
    const questions = [
      { question: "Co piję?", answers: ["Herbatę", "Kawę", "Sok"], correct: 0 },
    ];
    const withQ = buildExercise("id1", "T", align("Piję herbatę."), undefined, questions);
    expect(withQ.questions).toEqual(questions);

    const withoutQ = buildExercise("id1", "T", align("Piję herbatę."));
    expect(withoutQ.questions).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/exercise.test.ts`
Expected: FAIL — TypeScript error (too many arguments) or `questions` undefined mismatch.

- [ ] **Step 3: Implement**

In `src/lib/types.ts`, add above `Exercise`:

```ts
/** One comprehension question shown after listening. */
export interface Question {
  question: string;
  /** Exactly 3 answer options. */
  answers: string[];
  /** Index into `answers` of the correct option. */
  correct: number;
}
```

Add to the `Exercise` interface:

```ts
  /** Comprehension quiz shown after playback ends; absent = no quiz. */
  questions?: Question[];
```

Add the same optional field to `ContentItem`:

```ts
  /** Hand-authored comprehension questions (copied into the library JSON). */
  questions?: Question[];
```

In `src/lib/exercise.ts`, change `buildExercise` to:

```ts
import { parseAlignment } from "./alignment";
import type { Alignment, Exercise, Question } from "./types";

/** Pure assembly of an Exercise from an id, title and ElevenLabs alignment.
 *  `next` links to the following part of a multi-part article. */
export function buildExercise(
  id: string,
  title: string,
  alignment: Alignment,
  next?: string,
  questions?: Question[],
): Exercise {
  const { words, phrases } = parseAlignment(alignment);
  const exercise: Exercise = { id, title, audio: `/library/${id}.mp3`, words, phrases };
  if (next) exercise.next = next;
  if (questions && questions.length > 0) exercise.questions = questions;
  return exercise;
}
```

In `scripts/generate.ts`:

1. Extend the type import: `import type { Alignment, ContentItem, LibraryIndex } from "../src/lib/types";` → add `Exercise` to that list.
2. Change the `buildExercise` call to:

```ts
        const exercise = buildExercise(
          item.id,
          item.title,
          alignment,
          item.part?.nextId,
          item.questions,
        );
```

3. In the `else` branch (the one that does `skipped++`), after the `if (selected) { ... }` block, add the quota-free sync:

```ts
      // Sync questions into an already-generated file without spending quota.
      if (filesExist) {
        const exercise = JSON.parse(await readFile(jsonPath, "utf8")) as Exercise;
        const want = item.questions ?? [];
        const have = exercise.questions ?? [];
        if (JSON.stringify(want) !== JSON.stringify(have)) {
          if (want.length > 0) exercise.questions = want;
          else delete exercise.questions;
          await writeFile(jsonPath, JSON.stringify(exercise, null, 2));
          console.log(`Updated questions for "${item.id}".`);
        }
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/exercise.test.ts` → ALL PASS. Also run `npm run build` (type-checks the app; scripts are type-checked by tsx at runtime).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/exercise.ts src/lib/exercise.test.ts scripts/generate.ts
git commit -m "feat(content): comprehension questions flow through the generate pipeline"
```

### Task 12: Quiz component

**Files:**
- Create: `src/components/Quiz.tsx`
- Create: `src/components/Quiz.module.css`
- Test: `src/components/Quiz.test.tsx`

**Interfaces:**
- Consumes: `Question` from `@/lib/types` (Task 11).
- Produces: `<Quiz questions={Question[]} onFinish={(correct: number, total: number) => void} />` — `onFinish` fires exactly once, on submit.

- [ ] **Step 1: Write the failing tests**

Create `src/components/Quiz.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Quiz } from "./Quiz";
import type { Question } from "@/lib/types";

const questions: Question[] = [
  { question: "Co piję?", answers: ["Herbatę", "Kawę", "Sok"], correct: 0 },
  { question: "Co jem?", answers: ["Zupę", "Chleb", "Ser"], correct: 1 },
];

describe("Quiz", () => {
  it("disables submit until every question is answered", () => {
    render(<Quiz questions={questions} onFinish={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Sprawdź odpowiedzi" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Herbatę"));
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Chleb"));
    expect(submit).toBeEnabled();
  });

  it("scores answers and reports the result once", () => {
    const onFinish = vi.fn();
    render(<Quiz questions={questions} onFinish={onFinish} />);
    fireEvent.click(screen.getByLabelText("Herbatę")); // correct
    fireEvent.click(screen.getByLabelText("Ser")); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(1, 2);
    expect(screen.getByText("Poprawne odpowiedzi: 1 z 2.")).toBeInTheDocument();
  });

  it("locks the answers after submitting", () => {
    render(<Quiz questions={questions} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Herbatę"));
    fireEvent.click(screen.getByLabelText("Chleb"));
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    expect(screen.getByLabelText("Kawę")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Quiz.test.tsx`
Expected: FAIL — `./Quiz` does not exist.

- [ ] **Step 3: Implement**

Create `src/components/Quiz.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Question } from "@/lib/types";
import styles from "./Quiz.module.css";

interface Props {
  questions: Question[];
  /** Called exactly once, when the answers are submitted. */
  onFinish: (correct: number, total: number) => void;
}

export function Quiz({ questions, onFinish }: Props) {
  const [chosen, setChosen] = useState<(number | null)[]>(questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = chosen.every((c) => c !== null);
  const correctCount = chosen.filter((c, i) => c === questions[i].correct).length;

  const choose = (q: number, a: number) => {
    if (submitted) return;
    setChosen((prev) => prev.map((c, i) => (i === q ? a : c)));
  };

  const submit = () => {
    setSubmitted(true);
    onFinish(correctCount, questions.length);
  };

  return (
    <section className={styles.quiz} aria-label="Sprawdź zrozumienie">
      <h2 className={styles.heading}>Sprawdź zrozumienie</h2>
      {questions.map((q, qi) => (
        <fieldset key={qi} className={styles.question}>
          <legend className={styles.legend}>{q.question}</legend>
          {q.answers.map((a, ai) => {
            const cls = [styles.answer];
            if (submitted && ai === q.correct) cls.push(styles.correct);
            if (submitted && chosen[qi] === ai && ai !== q.correct) cls.push(styles.wrong);
            return (
              <label key={ai} className={cls.join(" ")}>
                <input
                  type="radio"
                  name={`question-${qi}`}
                  checked={chosen[qi] === ai}
                  onChange={() => choose(qi, ai)}
                  disabled={submitted}
                />
                {a}
              </label>
            );
          })}
        </fieldset>
      ))}
      {!submitted ? (
        <button className={styles.submit} onClick={submit} disabled={!allAnswered}>
          Sprawdź odpowiedzi
        </button>
      ) : (
        <p className={styles.score}>
          Poprawne odpowiedzi: {correctCount} z {questions.length}.
        </p>
      )}
    </section>
  );
}
```

Create `src/components/Quiz.module.css`:

```css
.quiz {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--line);
}

.heading {
  font-size: 1.4rem;
  margin-bottom: 1rem;
}

.question {
  border: none;
  padding: 0;
  margin: 0 0 1.5rem;
}

.legend {
  font-weight: 600;
  font-size: 1.1rem;
  padding: 0;
  margin-bottom: 0.6rem;
}

.answer {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  margin-bottom: 0.4rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  background: #fff;
  font-size: 1.05rem;
  cursor: pointer;
}

.answer input {
  accent-color: var(--accent);
  width: 1.1rem;
  height: 1.1rem;
}

.correct {
  border-color: var(--accent);
  background: var(--accent-tint);
}

.wrong {
  border-color: #c0392b;
  background: #fdecea;
}

.submit {
  font-size: 1.05rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.6rem;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.4;
  cursor: default;
}

.submit:hover:enabled {
  background: var(--accent-deep);
}

.score {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--accent);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Quiz.test.tsx` → ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Quiz.tsx src/components/Quiz.module.css src/components/Quiz.test.tsx
git commit -m "feat(quiz): comprehension quiz component"
```

### Task 13: Show the quiz after playback ends

**Files:**
- Modify: `src/components/Player.tsx`
- Test: `src/components/Player.test.tsx`

**Interfaces:**
- Consumes: `Quiz` (Task 12), `saveQuizResult` from `@/lib/progress` (Task 7), the `ended` handler effect from Task 8.

- [ ] **Step 1: Write the failing test**

Append to `src/components/Player.test.tsx`:

```tsx
  it("shows the quiz after the audio ends and stores the result", () => {
    const withQuiz: Exercise = {
      ...exercise,
      questions: [
        { question: "Kto ma?", answers: ["Ala", "Ola", "Ula"], correct: 0 },
      ],
    };
    render(<Player exercise={withQuiz} />);
    expect(screen.queryByText("Sprawdź zrozumienie")).not.toBeInTheDocument();
    const audio = document.querySelector("audio")!;
    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });
    expect(screen.getByText("Sprawdź zrozumienie")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Ala"));
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    const stored = JSON.parse(localStorage.getItem("voice-reading:progress")!);
    expect(stored.quiz).toEqual({ x: { correct: 1, total: 1 } });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Player.test.tsx`
Expected: FAIL — "Sprawdź zrozumienie" never appears.

- [ ] **Step 3: Implement**

In `src/components/Player.tsx`:

1. Add imports: `import { Quiz } from "./Quiz";` and add `saveQuizResult` to the `@/lib/progress` import list.
2. Add state below the mode state:

```tsx
  // Playback reached the end at least once for this exercise.
  const [finished, setFinished] = useState(false);
```

3. Reset it in the SAME effect that resets `revealed`:

```tsx
  useEffect(() => {
    setRevealed(false);
    setFinished(false);
  }, [exercise.id]);
```

4. In Task 8's progress effect, add `setFinished(true);` as the first line of `onEnded`.
5. In the JSX, AFTER the text block (the `{mode === "listen" ...}` conditional) and BEFORE `<audio ...>`, add:

```tsx
      {finished && exercise.questions && exercise.questions.length > 0 && (
        <Quiz
          questions={exercise.questions}
          onFinish={(correct, total) => saveQuizResult(exercise.id, correct, total)}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Player.test.tsx` → ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Player.tsx src/components/Player.test.tsx
git commit -m "feat(player): show comprehension quiz after playback ends"
```

### Task 14: Author questions for level-1 exercises

**Files:**
- Modify: `content/index.json`
- Modify (generated): `public/library/l1-poranek.json`, `public/library/l1-liczby.json`, `public/library/l1-kuchnia.json`

**Interfaces:**
- Consumes: the `questions` field (Task 11) and `npm run generate` sync path. Requires `.env` with `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` present (the sync path spends NO quota, but the script checks env upfront).

- [ ] **Step 1: Add questions to `content/index.json`**

Add a `questions` array to each of the three level-1 items (verify against each item's `text` — the questions below match the current texts):

To `l1-poranek`:

```json
"questions": [
  { "question": "Co robię po wstaniu z łóżka?", "answers": ["Otwieram okno", "Włączam telewizor", "Idę na spacer"], "correct": 0 },
  { "question": "Co piję powoli?", "answers": ["Kawę", "Herbatę", "Wodę"], "correct": 1 }
]
```

To `l1-liczby`:

```json
"questions": [
  { "question": "Ile dni ma tydzień?", "answers": ["Pięć", "Dziesięć", "Siedem"], "correct": 2 },
  { "question": "Jaki dzień będzie jutro?", "answers": ["Wtorek", "Piątek", "Niedziela"], "correct": 0 }
]
```

To `l1-kuchnia`:

```json
"questions": [
  { "question": "Co gotuję?", "answers": ["Makaron", "Zupę", "Ziemniaki"], "correct": 1 },
  { "question": "Co jest w szklance?", "answers": ["Mleko", "Sok", "Woda"], "correct": 2 }
]
```

- [ ] **Step 2: Sync into the library**

Run: `npm run generate`
Expected output includes `Updated questions for "l1-poranek".` (and the other two), `0 generated` — NO audio regenerated, no quota spent. If it instead says `Generating ...`, STOP and check you did not modify any `text` field.

- [ ] **Step 3: Verify manually**

Run: `npx vitest run` (full suite) and `npm run build`. Then check `public/library/l1-poranek.json` ends with the `questions` array.

- [ ] **Step 4: Commit**

```bash
git add content/index.json public/library
git commit -m "content: comprehension questions for level-1 exercises"
```

---

## Final verification (after all tasks)

- [ ] `npm test` — all tests pass.
- [ ] `npm run build` — static export succeeds.
- [ ] Manual smoke test: `npm run dev`, open an exercise → change tempo (voice slower, same pitch), switch to „Najpierw słuchaj" (text covered, reveal works), click a word mid-text (playback jumps), drag the slider, let audio finish (quiz appears for l1 exercises), go home (Kontynuuj card + streak after 2 days).
- [ ] Do NOT push — the user pushes to `main` themselves.
