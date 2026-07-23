import { describe, it, expect, beforeEach } from "vitest";
import {
  loadProgress,
  markCompleted,
  isCompleted,
  saveLastPosition,
  lastPosition,
  recordPracticeDay,
  todayKey,
  streakFrom,
  streak,
  saveQuizResult,
} from "./progress";

beforeEach(() => localStorage.clear());

describe("progress storage", () => {
  it("returns empty defaults when nothing is stored", () => {
    expect(loadProgress()).toEqual({ completed: [], days: [] });
    expect(lastPosition()).toBeUndefined();
    expect(isCompleted("x")).toBe(false);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("voice-reading:progress", "not json{");
    expect(loadProgress()).toEqual({ completed: [], days: [] });
  });

  it("marks completed exactly once", () => {
    markCompleted("a");
    markCompleted("a");
    markCompleted("b");
    expect(loadProgress().completed).toEqual(["a", "b"]);
    expect(isCompleted("a")).toBe(true);
  });

  it("stores and overwrites the last position", () => {
    saveLastPosition("a", 12.5);
    saveLastPosition("b", 3);
    expect(lastPosition()).toEqual({ id: "b", seconds: 3 });
  });

  it("records practice days uniquely and sorted", () => {
    recordPracticeDay("2026-07-23");
    recordPracticeDay("2026-07-21");
    recordPracticeDay("2026-07-23");
    expect(loadProgress().days).toEqual(["2026-07-21", "2026-07-23"]);
  });

  it("stores quiz results per exercise", () => {
    saveQuizResult("a", 2, 3);
    saveQuizResult("a", 3, 3);
    expect(loadProgress().quiz).toEqual({ a: { correct: 3, total: 3 } });
  });
});

describe("todayKey", () => {
  it("formats a local date with zero padding", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("streakFrom", () => {
  it("is 0 with no days", () => {
    expect(streakFrom([], "2026-07-23")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(streakFrom(["2026-07-21", "2026-07-22", "2026-07-23"], "2026-07-23")).toBe(3);
  });

  it("keeps yesterday's streak alive (today not yet practiced)", () => {
    expect(streakFrom(["2026-07-21", "2026-07-22"], "2026-07-23")).toBe(2);
  });

  it("breaks on a gap", () => {
    expect(streakFrom(["2026-07-19", "2026-07-20", "2026-07-23"], "2026-07-23")).toBe(1);
  });

  it("is 0 when the last practice was before yesterday", () => {
    expect(streakFrom(["2026-07-19"], "2026-07-23")).toBe(0);
  });

  it("crosses month boundaries", () => {
    expect(streakFrom(["2026-06-30", "2026-07-01"], "2026-07-01")).toBe(2);
  });
});

describe("streak (reads storage)", () => {
  it("uses the stored practice days", () => {
    recordPracticeDay("2026-07-22");
    recordPracticeDay("2026-07-23");
    expect(streak("2026-07-23")).toBe(2);
  });
});
