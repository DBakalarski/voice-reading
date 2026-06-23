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
