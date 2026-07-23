"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadLibraryIndex } from "@/lib/library";
import { loadProgress } from "@/lib/progress";
import {
  ARTICLES_SECTION,
  articleGroups,
  levelMeta,
  partCountLabel,
  partNumber,
  topicsForLevel,
} from "@/lib/levels";
import type { ExerciseSummary } from "@/lib/types";
import styles from "./Library.module.css";

function TopicListView() {
  const [exercises, setExercises] = useState<ExerciseSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Derived from the URL on every render: opening an article folder only
  // changes the query string, so this route re-renders without remounting.
  const params = useSearchParams();
  const isArticles = params.get("cat") === "article";
  /** Base id of the opened article folder, when one is selected. */
  const openId = isArticles ? params.get("art") : null;
  const levelRaw = isArticles ? null : params.get("level");
  const parsedLevel = levelRaw === null ? NaN : Number(levelRaw);
  const level = Number.isFinite(parsedLevel) ? parsedLevel : null;

  useEffect(() => {
    loadLibraryIndex()
      .then((i) => setExercises(i.exercises))
      .catch(() => setError(true));
    setCompleted(new Set(loadProgress().completed));
  }, []);

  const groups = exercises && isArticles ? articleGroups(exercises) : null;
  const open = openId ? groups?.find((g) => g.id === openId) : undefined;
  const meta = level != null ? levelMeta(level) : undefined;

  const heading = open
    ? open.title
    : isArticles
      ? ARTICLES_SECTION.title
      : meta
        ? meta.title
        : "Ćwiczenia";
  const description = open ? undefined : isArticles ? ARTICLES_SECTION.description : meta?.description;

  const row = (key: string, href: string, title: string, count?: string, done?: boolean) => (
    <li key={key} className={styles.item}>
      <Link href={href}>
        <span className={styles.itemTitle}>{title}</span>
        {count && <span className={styles.itemMeta}>{count}</span>}
        {done && (
          <span className={styles.done} role="img" aria-label="Ukończone">
            ✓
          </span>
        )}
      </Link>
    </li>
  );

  let rows: ReactNode[] | null = null;
  if (open) {
    rows = open.parts.map((p) => {
      const n = partNumber(p.id);
      return row(p.id, `/exercise?id=${p.id}`, n > 0 ? `Część ${n}` : p.title, undefined, completed.has(p.id));
    });
  } else if (openId && groups) {
    rows = []; // the query string names an article that is no longer in the library
  } else if (groups) {
    // A split article is one folder row; a single-chunk article opens directly.
    rows = groups.map((g) => {
      if (!g.multiPart) {
        const only = g.parts[0];
        return row(g.id, `/exercise?id=${only.id}`, g.title, undefined, completed.has(only.id));
      }
      const done = g.parts.filter((p) => completed.has(p.id)).length;
      const label = done > 0 ? `${done} z ${g.parts.length} części` : partCountLabel(g.parts.length);
      return row(g.id, `/level?cat=article&art=${g.id}`, g.title, label, done === g.parts.length);
    });
  } else if (exercises && level != null) {
    rows = topicsForLevel(exercises, level).map((e) =>
      row(e.id, `/exercise?id=${e.id}`, e.title, undefined, completed.has(e.id)),
    );
  }

  const emptyLabel = openId
    ? "Nie znaleziono artykułu."
    : isArticles
      ? "Brak artykułów."
      : "Brak tematów na tym poziomie.";

  return (
    <main className={styles.container}>
      <nav className={styles.nav}>
        {open ? (
          <Link href="/level?cat=article">← Artykuły</Link>
        ) : (
          <Link href="/">← Poziomy</Link>
        )}
      </nav>
      <h1 className={styles.heading}>{heading}</h1>
      {description && <p className={styles.subheading}>{description}</p>}
      {error && <p className={styles.status}>Nie udało się wczytać ćwiczeń.</p>}
      {!error && exercises === null && <p className={styles.status}>Wczytywanie…</p>}
      {rows && rows.length === 0 && <p className={styles.status}>{emptyLabel}</p>}
      {rows && rows.length > 0 && <ul className={styles.list}>{rows}</ul>}
    </main>
  );
}

export function TopicList() {
  return (
    <Suspense
      fallback={
        <main className={styles.container}>
          <p className={styles.status}>Wczytywanie…</p>
        </main>
      }
    >
      <TopicListView />
    </Suspense>
  );
}
