"use client";

import { useEffect, useRef } from "react";
import type { Word } from "@/lib/types";
import styles from "./HighlightedText.module.css";

interface Props {
  words: Word[];
  wordIndex: number;
  phraseIndex: number;
  /** Text size in rem; overrides the CSS default when provided. */
  fontSize?: number;
  /** Called with the phrase number of a clicked word (tap-to-seek). */
  onPhraseClick?: (phrase: number) => void;
}

export function HighlightedText({
  words,
  wordIndex,
  phraseIndex,
  fontSize,
  onPhraseClick,
}: Props) {
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Gently follow the reading: nudge the page only when the active word is
  // near a viewport edge. `block: "nearest"` is a no-op while the word is
  // comfortably visible, so it never jumps.
  useEffect(() => {
    if (wordIndex === -1) return;
    const el = activeWordRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    try {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    } catch {
      /* scrollIntoView unavailable (e.g. jsdom) — ignore */
    }
  }, [wordIndex]);

  return (
    <p
      className={onPhraseClick ? `${styles.text} ${styles.clickable}` : styles.text}
      style={fontSize ? { fontSize: `${fontSize}rem` } : undefined}
    >
      {words.map((w, i) => {
        const isWord = i === wordIndex;
        const isPhrase = phraseIndex !== -1 && w.phrase === phraseIndex;
        const classNames = [styles.word];
        if (isPhrase) classNames.push(styles.currentPhrase, "current-phrase");
        if (isWord) classNames.push(styles.currentWord, "current-word");
        return (
          <span
            key={i}
            ref={isWord ? activeWordRef : undefined}
            data-testid="word"
            className={classNames.join(" ")}
            onClick={onPhraseClick ? () => onPhraseClick(w.phrase) : undefined}
          >
            {w.text}{" "}
          </span>
        );
      })}
    </p>
  );
}
