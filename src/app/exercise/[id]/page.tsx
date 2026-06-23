import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryIndex } from "@/lib/types";
import { ExerciseClient } from "./ExerciseClient";

export async function generateStaticParams() {
  try {
    const raw = await readFile(join(process.cwd(), "public/library/index.json"), "utf8");
    const { exercises } = JSON.parse(raw) as LibraryIndex;
    return exercises.map((e) => ({ id: e.id }));
  } catch {
    return [];
  }
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseClient id={id} />;
}
