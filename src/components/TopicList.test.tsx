import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopicList } from "./TopicList";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("TopicList", () => {
  it("lists only the topics for the level in the query string", async () => {
    window.history.pushState({}, "", "/level?level=1");
    const index = {
      exercises: [
        { id: "a", title: "Poranek", level: 1 },
        { id: "c", title: "Wiadomości", level: 3 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Poranek")).toBeInTheDocument());

    const link = screen.getByRole("link", { name: "Poranek" });
    expect(link).toHaveAttribute("href", "/exercise?id=a");
    expect(screen.queryByText("Wiadomości")).not.toBeInTheDocument();
  });

  it("lists only articles when cat=article", async () => {
    window.history.pushState({}, "", "/level?cat=article");
    const index = {
      exercises: [
        { id: "a", title: "Poranek", level: 1 },
        { id: "art-sen", title: "Po co nam sen", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<TopicList />);
    await waitFor(() =>
      expect(screen.getByText("Po co nam sen")).toBeInTheDocument(),
    );

    expect(screen.getByText("Artykuły")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Po co nam sen" })).toHaveAttribute(
      "href",
      "/exercise?id=art-sen",
    );
    expect(screen.queryByText("Poranek")).not.toBeInTheDocument();
  });

  it("shows a completed badge for finished exercises", async () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: ["l1-poranek"], days: [] }),
    );
    const index = {
      exercises: [
        { id: "l1-poranek", title: "Poranek", level: 1 },
        { id: "l1-liczby", title: "Liczby", level: 1 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    window.history.pushState({}, "", "/level?level=1");
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Poranek")).toBeInTheDocument());
    expect(screen.getByRole("img", { name: "Ukończone" })).toBeInTheDocument();
    // Only one badge — "Liczby" is not completed.
    expect(screen.getAllByRole("img", { name: "Ukończone" })).toHaveLength(1);
  });
});
