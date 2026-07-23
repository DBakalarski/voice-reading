import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Player } from "./Player";
import type { Exercise } from "@/lib/types";

const exercise: Exercise = {
  id: "x",
  title: "Test",
  audio: "/library/x.mp3",
  words: [
    { text: "Ala", start: 0, end: 0.5, phrase: 0 },
    { text: "ma.", start: 0.5, end: 1.0, phrase: 0 },
  ],
  phrases: [{ index: 0, text: "Ala ma.", start: 0, end: 1.0 }],
};

describe("Player", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom doesn't implement media playback; stub play/pause.
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("play"));
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("pause"));
    });
  });

  it("renders the title and all words", () => {
    render(<Player exercise={exercise} />);
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getAllByTestId("word")).toHaveLength(2);
  });

  it("toggles play/pause via the button", () => {
    render(<Player exercise={exercise} />);
    const btn = screen.getByRole("button", { name: /odtwórz/i });
    act(() => {
      fireEvent.click(btn);
    });
    expect(screen.getByRole("button", { name: /pauza/i })).toBeInTheDocument();
  });

  it("changes playback rate and persists it", () => {
    render(<Player exercise={exercise} />);
    const btn = screen.getByRole("button", { name: "0,9×" });
    fireEvent.click(btn);
    const audio = document.querySelector("audio")!;
    expect(audio.playbackRate).toBe(0.9);
    expect(localStorage.getItem("voice-reading:rate")).toBe("0.9");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the saved playback rate on mount", () => {
    localStorage.setItem("voice-reading:rate", "0.75");
    render(<Player exercise={exercise} />);
    expect(screen.getByRole("button", { name: "0,75×" })).toHaveAttribute("aria-pressed", "true");
  });

  it("hides the text in listen-first mode until revealed", () => {
    render(<Player exercise={exercise} />);
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
    expect(localStorage.getItem("voice-reading:mode")).toBe("listen");

    fireEvent.click(screen.getByRole("button", { name: "Pokaż tekst" }));
    expect(screen.getAllByTestId("word")).toHaveLength(2);
  });

  it("restores listen-first mode from localStorage", () => {
    localStorage.setItem("voice-reading:mode", "listen");
    render(<Player exercise={exercise} />);
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Najpierw słuchaj" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("re-covers the text when switching back to listen-first", () => {
    render(<Player exercise={exercise} />);
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokaż tekst" }));
    fireEvent.click(screen.getByRole("button", { name: "Słuchaj i czytaj" }));
    fireEvent.click(screen.getByRole("button", { name: "Najpierw słuchaj" }));
    expect(screen.queryAllByTestId("word")).toHaveLength(0);
  });
});
