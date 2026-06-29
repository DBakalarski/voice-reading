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
