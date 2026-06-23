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
