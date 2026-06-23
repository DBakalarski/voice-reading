"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./ExerciseList.module.css";

export function ExerciseList() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLibraryIndex().then((i) => setExercises(i.exercises)).catch(() => setError(true));
  }, []);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Ćwiczenia słuchowe</h1>
      {error && <p>Nie udało się wczytać listy ćwiczeń.</p>}
      {!error && exercises === null && <p>Wczytywanie…</p>}
      {exercises && (
        <ul className={styles.list}>
          {exercises.map((e) => (
            <li key={e.id} className={styles.item}>
              <Link href={`/exercise?id=${e.id}`}>{e.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
