import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import GlobalError from "@/app/error";

describe("GlobalError", () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error heading", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Something went wrong").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders error description", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText(/unexpected error occurred/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Try Again button", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Try Again").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Back to Home link", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Back to Home").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls reset when Try Again is clicked", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    const buttons = screen.getAllByText("Try Again");
    const btn = buttons.find((el) => el.closest("button") !== null);
    fireEvent.click(btn!);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("shows error digest when present", () => {
    const error = Object.assign(new Error("test"), { digest: "abc123" });
    renderWithChakra(<GlobalError error={error} reset={mockReset} />);
    expect(
      screen.getAllByText("Error ID: abc123").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not show error digest when absent", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it("has a link pointing to home", () => {
    renderWithChakra(
      <GlobalError error={new Error("test")} reset={mockReset} />
    );
    const homeLink = screen.getAllByText("Back to Home")
      .find((el) => el.closest("a") !== null);
    expect(homeLink?.closest("a")).toHaveAttribute("href", "/");
  });
});
