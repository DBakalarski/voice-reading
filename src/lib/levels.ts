import type { ExerciseSummary } from "./types";

export interface LevelMeta {
  level: number;
  title: string;
  description: string;
}

/** Difficulty levels, ordered from easiest to hardest (Erber auditory hierarchy). */
export const LEVELS: LevelMeta[] = [
  {
    level: 1,
    title: "Poziom 1 — Łatwy",
    description: "Krótkie, proste zdania z życia codziennego. Wolne tempo i wyraźne pauzy.",
  },
  {
    level: 2,
    title: "Poziom 2 — Średni",
    description:
      "Dłuższe, spójne opowiadania ze zdaniami złożonymi i większą liczbą szczegółów.",
  },
  {
    level: 3,
    title: "Poziom 3 — Trudny",
    description:
      "Rozbudowane teksty o złożonej składni i bogatym słownictwie, zbliżone do mowy naturalnej.",
  },
];

export function levelMeta(level: number): LevelMeta | undefined {
  return LEVELS.find((l) => l.level === level);
}

export function topicsForLevel(
  exercises: ExerciseSummary[],
  level: number,
): ExerciseSummary[] {
  return exercises.filter((e) => e.category !== "article" && e.level === level);
}

/** The imported-articles section shown on the home screen when articles exist. */
export const ARTICLES_SECTION = {
  title: "Artykuły",
  description: "Teksty zaimportowane z internetu, czytane na głos słowo po słowie.",
};

export function articleTopics(exercises: ExerciseSummary[]): ExerciseSummary[] {
  return exercises.filter((e) => e.category === "article");
}

/** One article as shown in the library: a single text, or a folder of parts. */
export interface ArticleGroup {
  /** Base id shared by every part — the folder's key in the query string. */
  id: string;
  /** Title without the "(część N)" suffix. */
  title: string;
  /** Parts in reading order; exactly one entry for a single-chunk article. */
  parts: ExerciseSummary[];
  multiPart: boolean;
}

/** Parts of a split article are ids like `<base>-cz-3`, titled "… (część 3)"
 *  (see splitIntoParts in lib/article.ts). */
const PART_ID = /^(.*)-cz-(\d+)$/;
const PART_TITLE = /\s*\(część \d+\)\s*$/;

/** Fold imported articles into one entry per article: a multi-part article
 *  becomes a folder of its parts instead of N look-alike rows. Groups keep
 *  the order of their first part; parts are ordered by their number. */
export function articleGroups(exercises: ExerciseSummary[]): ArticleGroup[] {
  const groups: ArticleGroup[] = [];
  const byId = new Map<string, ArticleGroup>();

  for (const e of articleTopics(exercises)) {
    const m = PART_ID.exec(e.id);
    const id = m ? m[1] : e.id;
    let group = byId.get(id);
    if (!group) {
      group = {
        id,
        title: m ? e.title.replace(PART_TITLE, "") : e.title,
        parts: [],
        multiPart: false,
      };
      byId.set(id, group);
      groups.push(group);
    }
    group.parts.push(e);
  }

  for (const group of groups) {
    group.multiPart = group.parts.length > 1;
    group.parts.sort((a, b) => partNumber(a.id) - partNumber(b.id));
  }
  return groups;
}

/** The N of a `<base>-cz-N` id; 0 for an unnumbered article. */
export function partNumber(id: string): number {
  const m = PART_ID.exec(id);
  return m ? Number(m[2]) : 0;
}

/** Polish pluralisation for a count of items with the given singular/few/many forms. */
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return `${n} ${one}`;
  const ones = n % 10;
  const tens = n % 100;
  if (ones >= 2 && ones <= 4 && !(tens >= 12 && tens <= 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Polish pluralisation for the word "temat". */
export function topicCountLabel(n: number): string {
  return plural(n, "temat", "tematy", "tematów");
}

/** Polish pluralisation for the word "artykuł". */
export function articleCountLabel(n: number): string {
  return plural(n, "artykuł", "artykuły", "artykułów");
}

/** Polish pluralisation for the word "część". */
export function partCountLabel(n: number): string {
  return plural(n, "część", "części", "części");
}
