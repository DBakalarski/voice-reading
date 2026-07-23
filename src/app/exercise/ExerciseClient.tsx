"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Player } from "@/components/Player";
import { loadExercise } from "@/lib/library";
import type { Exercise } from "@/lib/types";
import styles from "./Exercise.module.css";

function ExerciseView() {
  const id = useSearchParams().get("id");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Reset while switching parts so the reader shows the loading state and
    // never briefly renders the previous part's text/audio.
    setExercise(null);
    setError(false);
    loadExercise(id)
      .then(setExercise)
      .catch(() => setError(true));
  }, [id]);

  if (!id)
    return (
      <main className={styles.status}>
        Brak wybranego ćwiczenia. <Link href="/">Wróć</Link>
      </main>
    );
  if (error)
    return (
      <main className={styles.status}>
        Nie udało się wczytać ćwiczenia. <Link href="/">Wróć</Link>
      </main>
    );
  // Guard on `exercise.id !== id` too: on a soft navigation the new id arrives
  // one render before the effect reloads, so this keeps the previous part's
  // text/audio from flashing until the matching exercise is in hand.
  if (!exercise || exercise.id !== id)
    return <main className={styles.status}>Wczytywanie…</main>;
  return (
    <>
      <nav className={styles.chrome}>
        <Link href="/">← Lista ćwiczeń</Link>
      </nav>
      <Player exercise={exercise} />
      {exercise.next && (
        <nav className={styles.nextPart}>
          <Link href={`/exercise?id=${exercise.next}`}>Następna część →</Link>
        </nav>
      )}
    </>
  );
}

export function ExerciseClient() {
  return (
    <Suspense fallback={<main className={styles.status}>Wczytywanie…</main>}>
      <ExerciseView />
    </Suspense>
  );
}
