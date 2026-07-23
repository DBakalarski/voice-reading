import styles from "./SoundBars.module.css";

/* Bar heights per variant: denser, more irregular bars = more complex speech.
   Level 1 is short simple sentences; level 3 approaches natural speech;
   articles are continuous real-world text. */
const VARIANTS: Record<string, number[]> = {
  "1": [8, 14, 8],
  "2": [8, 16, 10, 18, 9],
  "3": [10, 18, 8, 22, 12, 20, 9],
  article: [7, 12, 9, 15, 8, 13, 10, 14, 8],
};

export function SoundBars({ variant }: { variant: 1 | 2 | 3 | "article" }) {
  const heights = VARIANTS[String(variant)];
  return (
    <span className={styles.bars} aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} className={styles.bar} style={{ height: `${h}px` }} />
      ))}
    </span>
  );
}
