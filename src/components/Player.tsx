"use client";

import { useEffect, useRef, useState } from "react";
import { HighlightedText } from "./HighlightedText";
import { useAudioSync } from "@/hooks/useAudioSync";
import type { Exercise } from "@/lib/types";
import styles from "./Player.module.css";

const FONT_SIZE_KEY = "voice-reading:font-size";
const FONT_SIZE_DEFAULT = 2; // rem — matches the CSS fallback
const FONT_SIZE_MIN = 1.25;
const FONT_SIZE_MAX = 3.5;
const FONT_SIZE_STEP = 0.25;

const clampFontSize = (rem: number) =>
  Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(rem / FONT_SIZE_STEP) * FONT_SIZE_STEP));

export function Player({ exercise }: { exercise: Exercise }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const { wordIndex, phraseIndex, playing } = useAudioSync(audioRef, exercise.words, exercise.phrases);

  // Reader-chosen text size, persisted across sessions. Start from the default
  // so the server-rendered HTML matches the first client render (no hydration
  // mismatch), then restore the saved value on mount.
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);

  useEffect(() => {
    const saved = window.localStorage.getItem(FONT_SIZE_KEY);
    if (saved !== null) setFontSize(clampFontSize(Number(saved)));
  }, []);

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = clampFontSize(prev + delta);
      window.localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  };

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
      <div className={styles.controls}>
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
        <div className={styles.fontControls} role="group" aria-label="Rozmiar tekstu">
          <button
            className={styles.fontButton}
            onClick={() => changeFontSize(-FONT_SIZE_STEP)}
            disabled={fontSize <= FONT_SIZE_MIN}
            aria-label="Zmniejsz tekst"
            title="Zmniejsz tekst"
          >
            A−
          </button>
          <button
            className={styles.fontButton}
            onClick={() => changeFontSize(FONT_SIZE_STEP)}
            disabled={fontSize >= FONT_SIZE_MAX}
            aria-label="Powiększ tekst"
            title="Powiększ tekst"
          >
            A+
          </button>
        </div>
      </div>
      <h1 className={styles.title}>{exercise.title}</h1>
      <HighlightedText
        words={exercise.words}
        wordIndex={wordIndex}
        phraseIndex={phraseIndex}
        fontSize={fontSize}
      />
      <audio ref={audioRef} src={exercise.audio} onTimeUpdate={onTimeUpdate} preload="auto" />
    </main>
  );
}
