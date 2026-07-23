import { describe, it, expect } from "vitest";
import { buildExercise } from "./exercise";
import type { Alignment } from "./types";

function align(text: string): Alignment {
  const characters = [...text];
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, i) => +(i * 0.1).toFixed(2)),
    characterEndTimesSeconds: characters.map((_, i) => +((i + 1) * 0.1).toFixed(2)),
  };
}

describe("buildExercise", () => {
  it("assembles an Exercise with id, title, audio path, words and phrases", () => {
    const ex = buildExercise("powitanie", "Powitania", align("Cześć."));
    expect(ex.id).toBe("powitanie");
    expect(ex.title).toBe("Powitania");
    expect(ex.audio).toBe("/library/powitanie.mp3");
    expect(ex.words.map((w) => w.text)).toEqual(["Cześć."]);
    expect(ex.phrases).toHaveLength(1);
  });

  it("sets next when a following part id is given", () => {
    const ex = buildExercise("art-x-cz-1", "X (część 1)", align("A."), "art-x-cz-2");
    expect(ex.next).toBe("art-x-cz-2");
  });

  it("omits next when no following part id is given", () => {
    const ex = buildExercise("powitanie", "Powitania", align("Cześć."));
    expect(ex.next).toBeUndefined();
  });

  it("passes questions through to the exercise when provided", () => {
    const questions = [
      { question: "Co piję?", answers: ["Herbatę", "Kawę", "Sok"], correct: 0 },
    ];
    const withQ = buildExercise("id1", "T", align("Piję herbatę."), undefined, questions);
    expect(withQ.questions).toEqual(questions);

    const withoutQ = buildExercise("id1", "T", align("Piję herbatę."));
    expect(withoutQ.questions).toBeUndefined();
  });
});
