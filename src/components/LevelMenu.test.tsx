import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LevelMenu } from "./LevelMenu";

afterEach(() => vi.restoreAllMocks());
beforeEach(() => localStorage.clear());

describe("LevelMenu", () => {
  it("renders a card per level linking to the level page", async () => {
    const index = {
      exercises: [
        { id: "a", title: "A", level: 1 },
        { id: "b", title: "B", level: 1 },
        { id: "c", title: "C", level: 2 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() => expect(screen.getByText(/Poziom 1/)).toBeInTheDocument());

    const link = screen.getByRole("link", { name: /Poziom 1/ });
    expect(link).toHaveAttribute("href", "/level?level=1");
    expect(screen.getByText("2 tematy")).toBeInTheDocument();
    expect(screen.getByText(/Poziom 2/)).toBeInTheDocument();
    expect(screen.getByText(/Poziom 3/)).toBeInTheDocument();
    expect(screen.queryByText("Artykuły")).not.toBeInTheDocument();
  });

  it("counts a multi-part article once on the Artykuły card", async () => {
    const index = {
      exercises: [
        { id: "art-sen", title: "Po co nam sen", category: "article" },
        { id: "art-wolyn-cz-1", title: "Wołyń (część 1)", category: "article" },
        { id: "art-wolyn-cz-2", title: "Wołyń (część 2)", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() => expect(screen.getByText("Artykuły")).toBeInTheDocument());
    expect(screen.getByText("2 artykuły")).toBeInTheDocument();
  });

  it("shows an Artykuły card only when articles exist", async () => {
    const index = {
      exercises: [
        { id: "a", title: "A", level: 1 },
        { id: "art-sen", title: "Po co nam sen", category: "article" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() => expect(screen.getByText("Artykuły")).toBeInTheDocument());

    const link = screen.getByRole("link", { name: /Artykuły/ });
    expect(link).toHaveAttribute("href", "/level?cat=article");
    expect(screen.getByText("1 artykuł")).toBeInTheDocument();
  });

  it("shows a continue card for the last played exercise", async () => {
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: [], days: [], last: { id: "a", seconds: 10 } }),
    );
    const index = { exercises: [{ id: "a", title: "Poranek", level: 1 }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() => expect(screen.getByText("Kontynuuj")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Kontynuuj/ });
    expect(link).toHaveAttribute("href", "/exercise?id=a");
  });

  it("shows the practice streak when it is at least 2 days", async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    localStorage.setItem(
      "voice-reading:progress",
      JSON.stringify({ completed: [], days: [key(yesterday), key(today)] }),
    );
    const index = { exercises: [{ id: "a", title: "A", level: 1 }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<LevelMenu />);
    await waitFor(() =>
      expect(screen.getByText("Ćwiczysz 2 dni z rzędu — tak trzymaj!")).toBeInTheDocument(),
    );
  });
});
