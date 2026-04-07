import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import DashboardError from "@/app/dashboard/error";

describe("DashboardError", () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error heading", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Something went wrong").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders dashboard-specific description", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText(/problem loading this page/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Try Again button", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Try Again").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Dashboard Overview link", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    expect(
      screen.getAllByText("Dashboard Overview").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls reset when Try Again is clicked", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    const buttons = screen.getAllByText("Try Again");
    const btn = buttons.find((el) => el.closest("button") !== null);
    fireEvent.click(btn!);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("shows error digest when present", () => {
    const error = Object.assign(new Error("test"), { digest: "xyz789" });
    renderWithChakra(<DashboardError error={error} reset={mockReset} />);
    expect(
      screen.getAllByText("Error ID: xyz789").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not show error digest when absent", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it("has a link pointing to dashboard", () => {
    renderWithChakra(
      <DashboardError error={new Error("test")} reset={mockReset} />
    );
    const dashLink = screen.getAllByText("Dashboard Overview")
      .find((el) => el.closest("a") !== null);
    expect(dashLink?.closest("a")).toHaveAttribute("href", "/dashboard");
  });
});
