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
  /** Id of the next part, for multi-part articles; drives the reader link. */
  next?: string;
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

/** Position of one part within a split (multi-part) article. */
export interface PartInfo {
  index: number; // 1-based
  total: number;
  nextId?: string; // id of the next part; absent on the last part
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
  /** Set only for split articles; absent for single-chunk articles and exercises. */
  part?: PartInfo;
}

/** Shape of the `alignment` object returned by ElevenLabs convertWithTimestamps. */
export interface Alignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}
