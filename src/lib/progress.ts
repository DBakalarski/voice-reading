/** Local, offline progress tracking. Everything lives under one localStorage
 *  key; every accessor degrades to safe defaults when storage is missing,
 *  corrupt, or blocked (private mode). */

export interface LastPosition {
  id: string;
  seconds: number;
}

export interface ProgressData {
  /** Ids of exercises listened to the end. */
  completed: string[];
  /** Most recently played exercise and position, for "Kontynuuj". */
  last?: LastPosition;
  /** Practice days as local "YYYY-MM-DD", sorted ascending, unique. */
  days: string[];
  /** Latest quiz score per exercise id. */
  quiz?: Record<string, { correct: number; total: number }>;
}

const KEY = "voice-reading:progress";

export function loadProgress(): ProgressData {
  if (typeof window === "undefined") return { completed: [], days: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { completed: [], days: [] };
    const data = JSON.parse(raw) as ProgressData;
    const result: ProgressData = {
      completed: Array.isArray(data.completed) ? data.completed : [],
      days: Array.isArray(data.days) ? data.days : [],
    };
    if (data.last && typeof data.last.id === "string") result.last = data.last;
    if (data.quiz && typeof data.quiz === "object") result.quiz = data.quiz;
    return result;
  } catch {
    return { completed: [], days: [] };
  }
}

function save(data: ProgressData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked — progress is a nice-to-have, never crash */
  }
}

export function markCompleted(id: string): void {
  const p = loadProgress();
  if (!p.completed.includes(id)) {
    p.completed.push(id);
    save(p);
  }
}

export function isCompleted(id: string): boolean {
  return loadProgress().completed.includes(id);
}

export function saveLastPosition(id: string, seconds: number): void {
  const p = loadProgress();
  p.last = { id, seconds };
  save(p);
}

export function lastPosition(): LastPosition | undefined {
  return loadProgress().last;
}

export function recordPracticeDay(day: string): void {
  const p = loadProgress();
  if (!p.days.includes(day)) {
    p.days.push(day);
    p.days.sort();
    save(p);
  }
}

export function saveQuizResult(id: string, correct: number, total: number): void {
  const p = loadProgress();
  p.quiz = { ...(p.quiz ?? {}), [id]: { correct, total } };
  save(p);
}

/** Local date as "YYYY-MM-DD" (NOT toISOString, which is UTC). */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day count since epoch; rounding absorbs DST/timezone offsets (<12h). */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / 86_400_000);
}

/** Consecutive practice days ending today — or ending yesterday, so the
 *  streak survives until today's session actually happens. */
export function streakFrom(days: string[], today: string): number {
  const set = new Set(days.map(dayNumber));
  let cur = dayNumber(today);
  if (!set.has(cur)) cur -= 1;
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur--;
  }
  return n;
}

export function streak(today: string): number {
  return streakFrom(loadProgress().days, today);
}
