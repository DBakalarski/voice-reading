import type { Word } from "@/lib/types";
import styles from "./HighlightedText.module.css";

interface Props {
  words: Word[];
  wordIndex: number;
  phraseIndex: number;
}

export function HighlightedText({ words, wordIndex, phraseIndex }: Props) {
  return (
    <p className={styles.text}>
      {words.map((w, i) => {
        const isWord = i === wordIndex;
        const isPhrase = phraseIndex !== -1 && w.phrase === phraseIndex;
        const classNames = [styles.word];
        if (isPhrase) classNames.push(styles.currentPhrase, "current-phrase");
        if (isWord) classNames.push(styles.currentWord, "current-word");
        return (
          <span key={i} data-testid="word" className={classNames.join(" ")}>
            {w.text}{" "}
          </span>
        );
      })}
    </p>
  );
}
