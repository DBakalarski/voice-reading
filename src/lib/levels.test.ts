import { describe, it, expect } from "vitest";
import {
  LEVELS,
  articleCountLabel,
  articleGroups,
  articleTopics,
  levelMeta,
  partCountLabel,
  topicCountLabel,
  topicsForLevel,
} from "./levels";
import type { ExerciseSummary } from "./types";

const sample: ExerciseSummary[] = [
  { id: "a", title: "A", level: 1 },
  { id: "b", title: "B", level: 1 },
  { id: "c", title: "C", level: 3 },
  { id: "art-x", title: "X", category: "article" },
];

describe("levels", () => {
  it("exposes three ordered levels", () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3]);
  });

  it("levelMeta finds a level by number", () => {
    expect(levelMeta(2)?.title).toContain("Średni");
    expect(levelMeta(9)).toBeUndefined();
  });

  it("topicsForLevel filters exercises by level, excluding articles", () => {
    expect(topicsForLevel(sample, 1).map((e) => e.id)).toEqual(["a", "b"]);
    expect(topicsForLevel(sample, 2)).toEqual([]);
  });

  it("articleTopics returns only article entries", () => {
    expect(articleTopics(sample).map((e) => e.id)).toEqual(["art-x"]);
  });

  it("topicCountLabel uses Polish plural forms", () => {
    expect(topicCountLabel(1)).toBe("1 temat");
    expect(topicCountLabel(3)).toBe("3 tematy");
    expect(topicCountLabel(5)).toBe("5 tematów");
  });

  it("articleCountLabel uses Polish plural forms", () => {
    expect(articleCountLabel(1)).toBe("1 artykuł");
    expect(articleCountLabel(3)).toBe("3 artykuły");
    expect(articleCountLabel(5)).toBe("5 artykułów");
  });

  it("partCountLabel uses Polish plural forms", () => {
    expect(partCountLabel(1)).toBe("1 część");
    expect(partCountLabel(3)).toBe("3 części");
    expect(partCountLabel(7)).toBe("7 części");
  });
});

describe("articleGroups", () => {
  const articles: ExerciseSummary[] = [
    { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
    { id: "art-sen", title: "Po co nam sen?", category: "article" },
    { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
    { id: "art-wolyn-cz-10", title: "Wołyń (część 10)", category: "article" },
  ];

  it("folds the parts of one article into a single group", () => {
    const groups = articleGroups(articles);
    expect(groups.map((g) => g.id)).toEqual(["art-wolyn", "art-sen"]);
    const wolyn = groups[0];
    expect(wolyn.title).toBe("Wołyń");
    expect(wolyn.multiPart).toBe(true);
    expect(wolyn.parts.map((p) => p.id)).toEqual([
      "art-wolyn-cz-1",
      "art-wolyn-cz-2",
      "art-wolyn-cz-10",
    ]);
  });

  it("keeps a single-part article as its own one-part group", () => {
    const sen = articleGroups(articles)[1];
    expect(sen.title).toBe("Po co nam sen?");
    expect(sen.multiPart).toBe(false);
    expect(sen.parts.map((p) => p.id)).toEqual(["art-sen"]);
  });

  it("ignores non-article entries", () => {
    expect(articleGroups(sample).map((g) => g.id)).toEqual(["art-x"]);
  });
});
