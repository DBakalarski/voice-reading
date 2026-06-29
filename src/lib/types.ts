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

export type Category = "exercise" | "article";

export interface ExerciseSummary {
  id: string;
  title: string;
  level?: number;
  category?: Category;
}

export interface LibraryIndex {
  exercises: ExerciseSummary[];
}

/** An authored content entry in content/index.json (input to the generate pipeline). */
export interface ContentItem {
  id: string;
  title: string;
  level?: number;
  category?: Category;
  /** Source URL for imported articles; absent for hand-written exercises. */
  url?: string;
  /** The text read aloud. Filled by `npm run fetch` for articles. */
  text?: string;
}

/** Shape of the `alignment` object returned by ElevenLabs convertWithTimestamps. */
export interface Alignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}
