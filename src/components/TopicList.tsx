"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import { levelMeta, topicsForLevel } from "@/lib/levels";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./Library.module.css";

export function TopicList() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("level");
    const parsed = raw === null ? NaN : Number(raw);
    setLevel(Number.isFinite(parsed) ? parsed : null);
    loadLibraryIndex()
      .then((i) => setExercises(i.exercises))
      .catch(() => setError(true));
  }, []);

  const meta = level != null ? levelMeta(level) : undefined;
  const topics =
    exercises && level != null ? topicsForLevel(exercises, level) : null;

  return (
    <main className={styles.container}>
      <nav className={styles.nav}>
        <Link href="/">← Poziomy</Link>
      </nav>
      <h1 className={styles.heading}>{meta ? meta.title : "Ćwiczenia"}</h1>
      {meta && <p className={styles.subheading}>{meta.description}</p>}
      {error && <p>Nie udało się wczytać ćwiczeń.</p>}
      {!error && exercises === null && <p>Wczytywanie…</p>}
      {topics && topics.length === 0 && <p>Brak tematów na tym poziomie.</p>}
      {topics && topics.length > 0 && (
        <ul className={styles.list}>
          {topics.map((e) => (
            <li key={e.id} className={styles.item}>
              <Link href={`/exercise?id=${e.id}`}>{e.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
