import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ExerciseList } from "./ExerciseList";

afterEach(() => vi.restoreAllMocks());

describe("ExerciseList", () => {
  it("renders a link per exercise from the index", async () => {
    const index = { exercises: [{ id: "powitanie", title: "Powitania" }, { id: "dom", title: "W domu" }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    render(<ExerciseList />);
    await waitFor(() => expect(screen.getByText("Powitania")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Powitania/ });
    expect(link).toHaveAttribute("href", "/exercise?id=powitanie");
    expect(screen.getByText("W domu")).toBeInTheDocument();
  });
});
