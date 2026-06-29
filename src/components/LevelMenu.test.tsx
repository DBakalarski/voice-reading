import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LevelMenu } from "./LevelMenu";

afterEach(() => vi.restoreAllMocks());

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
});
