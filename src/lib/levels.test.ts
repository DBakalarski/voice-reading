import { describe, it, expect } from "vitest";
import { LEVELS, levelMeta, topicCountLabel, topicsForLevel } from "./levels";
import type { ExerciseSummary } from "./types";

const sample: ExerciseSummary[] = [
  { id: "a", title: "A", level: 1 },
  { id: "b", title: "B", level: 1 },
  { id: "c", title: "C", level: 3 },
];

describe("levels", () => {
  it("exposes three ordered levels", () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3]);
  });

  it("levelMeta finds a level by number", () => {
    expect(levelMeta(2)?.title).toContain("Średni");
    expect(levelMeta(9)).toBeUndefined();
  });

  it("topicsForLevel filters exercises by level", () => {
    expect(topicsForLevel(sample, 1).map((e) => e.id)).toEqual(["a", "b"]);
    expect(topicsForLevel(sample, 2)).toEqual([]);
  });

  it("topicCountLabel uses Polish plural forms", () => {
    expect(topicCountLabel(1)).toBe("1 temat");
    expect(topicCountLabel(3)).toBe("3 tematy");
    expect(topicCountLabel(5)).toBe("5 tematów");
  });
});
