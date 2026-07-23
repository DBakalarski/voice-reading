import { describe, it, expect } from "vitest";
import { resolveActiveIndices, phraseToRepeat } from "./activeIndex";
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
