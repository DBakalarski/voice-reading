import type { Exercise, LibraryIndex } from "./types";

export async function loadLibraryIndex(): Promise<LibraryIndex> {
  const res = await fetch("/library/index.json");
  if (!res.ok) throw new Error(`Failed to load library index: ${res.status}`);
  return (await res.json()) as LibraryIndex;
}

export async function loadExercise(id: string): Promise<Exercise> {
  const res = await fetch(`/library/${id}.json`);
  if (!res.ok) throw new Error(`Failed to load exercise ${id}: ${res.status}`);
  return (await res.json()) as Exercise;
}
