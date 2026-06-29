export interface Word {
  text: string;
  start: number;
  end: number;
  phrase: number;
}

export interface Phrase {
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface Exercise {
  id: string;
  title: string;
  audio: string;
  words: Word[];
  phrases: Phrase[];
}

export interface ExerciseSummary {
  id: string;
  title: string;
  level: number;
}

export interface LibraryIndex {
  exercises: ExerciseSummary[];
}

/** Shape of the `alignment` object returned by ElevenLabs convertWithTimestamps. */
export interface Alignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}
