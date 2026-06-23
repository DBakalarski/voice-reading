"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "@/components/Player";
import { loadExercise } from "@/lib/library";
import type { Exercise } from "@/lib/types";

export function ExerciseClient({ id }: { id: string }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadExercise(id).then(setExercise).catch(() => setError(true));
  }, [id]);

  if (error) return <main style={{ padding: "2rem" }}>Nie udało się wczytać ćwiczenia. <Link href="/">Wróć</Link></main>;
  if (!exercise) return <main style={{ padding: "2rem" }}>Wczytywanie…</main>;
  return (
    <>
      <nav style={{ padding: "1rem 1.5rem" }}><Link href="/">← Lista ćwiczeń</Link></nav>
      <Player exercise={exercise} />
    </>
  );
}
