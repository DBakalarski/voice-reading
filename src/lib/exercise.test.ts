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
});
