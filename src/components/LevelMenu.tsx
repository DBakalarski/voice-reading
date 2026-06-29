"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import {
  ARTICLES_SECTION,
  LEVELS,
  articleCountLabel,
  articleTopics,
  topicCountLabel,
  topicsForLevel,
} from "@/lib/levels";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./Library.module.css";

export function LevelMenu() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLibraryIndex()
      .then((i) => setExercises(i.exercises))
      .catch(() => setError(true));
  }, []);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Ćwiczenia słuchowe</h1>
      <p className={styles.subheading}>Wybierz poziom trudności.</p>
      {error && <p>Nie udało się wczytać ćwiczeń.</p>}
      {!error && exercises === null && <p>Wczytywanie…</p>}
      {exercises && (
        <ul className={styles.list}>
          {LEVELS.map((lvl) => {
            const count = topicsForLevel(exercises, lvl.level).length;
            return (
              <li key={lvl.level}>
                <Link href={`/level?level=${lvl.level}`} className={styles.card}>
                  <span className={styles.cardTitle}>{lvl.title}</span>
                  <span className={styles.cardDesc}>{lvl.description}</span>
                  <span className={styles.cardMeta}>{topicCountLabel(count)}</span>
                </Link>
              </li>
            );
          })}
          {articleTopics(exercises).length > 0 && (
            <li key="articles">
              <Link href="/level?cat=article" className={styles.card}>
                <span className={styles.cardTitle}>{ARTICLES_SECTION.title}</span>
                <span className={styles.cardDesc}>{ARTICLES_SECTION.description}</span>
                <span className={styles.cardMeta}>
                  {articleCountLabel(articleTopics(exercises).length)}
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
