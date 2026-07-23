"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import { ARTICLES_SECTION, articleTopics, levelMeta, topicsForLevel } from "@/lib/levels";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./Library.module.css";

export function TopicList() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [isArticles, setIsArticles] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cat") === "article") {
      setIsArticles(true);
    } else {
      const raw = params.get("level");
      const parsed = raw === null ? NaN : Number(raw);
      setLevel(Number.isFinite(parsed) ? parsed : null);
    }
    loadLibraryIndex()
      .then((i) => setExercises(i.exercises))
      .catch(() => setError(true));
  }, []);

  const meta = level != null ? levelMeta(level) : undefined;
  const heading = isArticles ? ARTICLES_SECTION.title : meta ? meta.title : "Ćwiczenia";
  const description = isArticles ? ARTICLES_SECTION.description : meta?.description;
  const topics = !exercises
    ? null
    : isArticles
      ? articleTopics(exercises)
      : level != null
        ? topicsForLevel(exercises, level)
        : null;
  const emptyLabel = isArticles
    ? "Brak artykułów."
    : "Brak tematów na tym poziomie.";

  return (
    <main className={styles.container}>
      <nav className={styles.nav}>
        <Link href="/">← Poziomy</Link>
      </nav>
      <h1 className={styles.heading}>{heading}</h1>
      {description && <p className={styles.subheading}>{description}</p>}
      {error && <p className={styles.status}>Nie udało się wczytać ćwiczeń.</p>}
      {!error && exercises === null && <p className={styles.status}>Wczytywanie…</p>}
      {topics && topics.length === 0 && <p className={styles.status}>{emptyLabel}</p>}
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
