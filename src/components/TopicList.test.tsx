import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopicList } from "./TopicList";

// The App Router hook, reduced to what it guarantees: the params of the URL as
// it is right now. Reading them per render is what makes in-place navigation
// (/level?cat=article → /level?cat=article&art=…) update the list.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

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

  it("folds a multi-part article into one folder row", async () => {
    window.history.pushState({}, "", "/level?cat=article");
    const index = {
      exercises: [
        { id: "art-sen", title: "Po co nam sen", category: "article" },
        { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
        { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
        { id: "art-wolyn-cz-3", title: "Wołyń (część 3)", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Wołyń")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /Wołyń/ })).toHaveAttribute(
      "href",
      "/level?cat=article&art=art-wolyn",
    );
    expect(screen.getByText("3 części")).toBeInTheDocument();
    expect(screen.queryByText("Wołyń (część 1)")).not.toBeInTheDocument();
    // A single-chunk article still links straight to its exercise.
    expect(screen.getByRole("link", { name: "Po co nam sen" })).toHaveAttribute(
      "href",
      "/exercise?id=art-sen",
    );
  });

  it("opens a folder without remounting, when only the query string changes", async () => {
    window.history.pushState({}, "", "/level?cat=article");
    const index = {
      exercises: [
        { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
        { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    const { rerender } = render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Wołyń")).toBeInTheDocument());

    // Next navigates in place on the same route: no remount, only a new URL.
    window.history.pushState({}, "", "/level?cat=article&art=art-wolyn");
    rerender(<TopicList />);
    expect(screen.getByText("Część 1")).toBeInTheDocument();
    expect(screen.getByText("Część 2")).toBeInTheDocument();
  });

  it("counts finished parts on the folder row", async () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: ["art-wolyn-cz-1"], days: [] }),
    );
    window.history.pushState({}, "", "/level?cat=article");
    const index = {
      exercises: [
        { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
        { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("1 z 2 części")).toBeInTheDocument());
    // Not every part is done yet, so the folder carries no completed badge.
    expect(screen.queryByRole("img", { name: "Ukończone" })).not.toBeInTheDocument();
  });

  it("lists the parts of an opened article folder", async () => {
    window.history.pushState({}, "", "/level?cat=article&art=art-wolyn");
    const index = {
      exercises: [
        { id: "art-sen", title: "Po co nam sen", category: "article" },
        { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
        { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<TopicList />);
    await waitFor(() => expect(screen.getByText("Część 1")).toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "Wołyń" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Część 2" })).toHaveAttribute(
      "href",
      "/exercise?id=art-wolyn-cz-2",
    );
    expect(screen.getByRole("link", { name: "← Artykuły" })).toHaveAttribute(
      "href",
      "/level?cat=article",
    );
    expect(screen.queryByText("Po co nam sen")).not.toBeInTheDocument();
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
