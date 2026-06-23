import { parseAlignment } from "./alignment";
import type { Alignment, Exercise } from "./types";

/** Pure assembly of an Exercise from an id, title and ElevenLabs alignment. */
export function buildExercise(id: string, title: string, alignment: Alignment): Exercise {
  const { words, phrases } = parseAlignment(alignment);
  return { id, title, audio: `/library/${id}.mp3`, words, phrases };
}
