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
  return exercises.filter((e) => e.level === level);
}

/** Polish pluralisation for the word "temat". */
export function topicCountLabel(n: number): string {
  if (n === 1) return "1 temat";
  const ones = n % 10;
  const tens = n % 100;
  if (ones >= 2 && ones <= 4 && !(tens >= 12 && tens <= 14)) return `${n} tematy`;
  return `${n} tematów`;
}
