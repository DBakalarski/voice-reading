"use client";

import { useState } from "react";
import type { Question } from "@/lib/types";
import styles from "./Quiz.module.css";

interface Props {
  questions: Question[];
  /** Called exactly once, when the answers are submitted. */
  onFinish: (correct: number, total: number) => void;
}

export function Quiz({ questions, onFinish }: Props) {
  const [chosen, setChosen] = useState<(number | null)[]>(questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = chosen.every((c) => c !== null);
  const correctCount = chosen.filter((c, i) => c === questions[i].correct).length;

  const choose = (q: number, a: number) => {
    if (submitted) return;
    setChosen((prev) => prev.map((c, i) => (i === q ? a : c)));
  };

  const submit = () => {
    setSubmitted(true);
    onFinish(correctCount, questions.length);
  };

  return (
    <section className={styles.quiz} aria-label="Sprawdź zrozumienie">
      <h2 className={styles.heading}>Sprawdź zrozumienie</h2>
      {questions.map((q, qi) => (
        <fieldset key={qi} className={styles.question}>
          <legend className={styles.legend}>{q.question}</legend>
          {q.answers.map((a, ai) => {
            const cls = [styles.answer];
            if (submitted && ai === q.correct) cls.push(styles.correct);
            if (submitted && chosen[qi] === ai && ai !== q.correct) cls.push(styles.wrong);
            return (
              <label key={ai} className={cls.join(" ")}>
                <input
                  type="radio"
                  name={`question-${qi}`}
                  checked={chosen[qi] === ai}
                  onChange={() => choose(qi, ai)}
                  disabled={submitted}
                />
                {a}
              </label>
            );
          })}
        </fieldset>
      ))}
      {!submitted ? (
        <button className={styles.submit} onClick={submit} disabled={!allAnswered}>
          Sprawdź odpowiedzi
        </button>
      ) : (
        <p className={styles.score}>
          Poprawne odpowiedzi: {correctCount} z {questions.length}.
        </p>
      )}
    </section>
  );
}
