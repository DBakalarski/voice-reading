import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
