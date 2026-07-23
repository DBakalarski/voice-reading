import { parseAlignment } from "./alignment";
import type { Alignment, Exercise, Question } from "./types";

/** Pure assembly of an Exercise from an id, title and ElevenLabs alignment.
 *  `next` links to the following part of a multi-part article. */
export function buildExercise(
  id: string,
  title: string,
  alignment: Alignment,
  next?: string,
  questions?: Question[],
): Exercise {
  const { words, phrases } = parseAlignment(alignment);
  const exercise: Exercise = { id, title, audio: `/library/${id}.mp3`, words, phrases };
  if (next) exercise.next = next;
  if (questions && questions.length > 0) exercise.questions = questions;
  return exercise;
}
