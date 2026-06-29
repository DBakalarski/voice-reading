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
      <div className={styles.controls}>
        <button className={styles.button} onClick={toggle}>
          {playing ? "Pauza" : "Odtwórz"}
        </button>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <h1 className={styles.title}>{exercise.title}</h1>
      <HighlightedText words={exercise.words} wordIndex={wordIndex} phraseIndex={phraseIndex} />
      <audio ref={audioRef} src={exercise.audio} onTimeUpdate={onTimeUpdate} preload="auto" />
    </main>
  );
}
