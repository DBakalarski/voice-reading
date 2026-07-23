"use client";

import { useEffect, useRef, useState } from "react";
import { HighlightedText } from "./HighlightedText";
import { useAudioSync } from "@/hooks/useAudioSync";
import { phraseToRepeat } from "@/lib/activeIndex";
import type { Exercise } from "@/lib/types";
import styles from "./Player.module.css";

const FONT_SIZE_KEY = "voice-reading:font-size";
const FONT_SIZE_DEFAULT = 2; // rem — matches the CSS fallback
const FONT_SIZE_MIN = 1.25;
const FONT_SIZE_MAX = 3.5;
const FONT_SIZE_STEP = 0.25;

const RATE_KEY = "voice-reading:rate";
const RATES = [0.75, 0.9, 1];
/** "0,75×" — Polish decimal comma. */
const formatRate = (r: number) => `${String(r).replace(".", ",")}×`;

const MODE_KEY = "voice-reading:mode";
type Mode = "read" | "listen";

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

  const repeatPhrase = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const i = phraseToRepeat(audio.currentTime, exercise.phrases);
    audio.currentTime = i === -1 ? 0 : exercise.phrases[i].start;
    void audio.play();
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  return (
    <main className={styles.container}>
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
      </div>
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
      <h1 className={styles.title}>{exercise.title}</h1>
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
      <audio ref={audioRef} src={exercise.audio} onTimeUpdate={onTimeUpdate} preload="auto" />
    </main>
  );
}
