import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("renders 404 text", () => {
    renderWithChakra(<NotFound />);
    expect(screen.getAllByText("404").length).toBeGreaterThanOrEqual(1);
  });

  it("renders page not found heading", () => {
    renderWithChakra(<NotFound />);
    expect(
      screen.getAllByText("Page not found").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders description text", () => {
    renderWithChakra(<NotFound />);
    expect(
      screen.getAllByText(/doesn't exist or has been moved/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Back to Home button", () => {
    renderWithChakra(<NotFound />);
    expect(
      screen.getAllByText("Back to Home").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Go to Dashboard button", () => {
    renderWithChakra(<NotFound />);
    expect(
      screen.getAllByText("Go to Dashboard").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("has a link pointing to home", () => {
    renderWithChakra(<NotFound />);
    const homeLink = screen.getAllByText("Back to Home")
      .find((el) => el.closest("a") !== null);
    expect(homeLink?.closest("a")).toHaveAttribute("href", "/");
  });

  it("has a link pointing to dashboard", () => {
    renderWithChakra(<NotFound />);
    const dashLink = screen.getAllByText("Go to Dashboard")
      .find((el) => el.closest("a") !== null);
    expect(dashLink?.closest("a")).toHaveAttribute("href", "/dashboard");
  });
});
