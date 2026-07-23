import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Quiz } from "./Quiz";
import type { Question } from "@/lib/types";

const questions: Question[] = [
  { question: "Co piję?", answers: ["Herbatę", "Kawę", "Sok"], correct: 0 },
  { question: "Co jem?", answers: ["Zupę", "Chleb", "Ser"], correct: 1 },
];

describe("Quiz", () => {
  it("disables submit until every question is answered", () => {
    render(<Quiz questions={questions} onFinish={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Sprawdź odpowiedzi" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Herbatę"));
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Chleb"));
    expect(submit).toBeEnabled();
  });

  it("scores answers and reports the result once", () => {
    const onFinish = vi.fn();
    render(<Quiz questions={questions} onFinish={onFinish} />);
    fireEvent.click(screen.getByLabelText("Herbatę")); // correct
    fireEvent.click(screen.getByLabelText("Ser")); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(1, 2);
    expect(screen.getByText("Poprawne odpowiedzi: 1 z 2.")).toBeInTheDocument();
  });

  it("locks the answers after submitting", () => {
    render(<Quiz questions={questions} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Herbatę"));
    fireEvent.click(screen.getByLabelText("Chleb"));
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    expect(screen.getByLabelText("Kawę")).toBeDisabled();
  });
});
