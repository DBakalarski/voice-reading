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
