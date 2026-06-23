import { describe, it, expect, vi, afterEach } from "vitest";
import { loadExercise, loadLibraryIndex } from "./library";

afterEach(() => vi.restoreAllMocks());

describe("library loaders", () => {
  it("loadLibraryIndex fetches /library/index.json", async () => {
    const index = { exercises: [{ id: "a", title: "A" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    await expect(loadLibraryIndex()).resolves.toEqual(index);
    expect(fetch).toHaveBeenCalledWith("/library/index.json");
  });

  it("loadExercise fetches /library/<id>.json", async () => {
    const ex = { id: "a", title: "A", audio: "/library/a.mp3", words: [], phrases: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ex))));
    await expect(loadExercise("a")).resolves.toEqual(ex);
    expect(fetch).toHaveBeenCalledWith("/library/a.json");
  });
});
