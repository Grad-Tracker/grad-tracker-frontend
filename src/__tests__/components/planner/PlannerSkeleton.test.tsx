import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import PlannerSkeleton, { PlannerPageSkeleton } from "@/components/planner/PlannerSkeleton";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("PlannerSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<PlannerSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with planner-skeleton testid", () => {
    renderWithChakra(<PlannerSkeleton />);
    expect(screen.getByTestId("planner-skeleton")).toBeInTheDocument();
  });

  it("renders skeleton card elements for semester columns", () => {
    const { container } = renderWithChakra(<PlannerSkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(20);
  });

  it("does not render real planner text", () => {
    renderWithChakra(<PlannerSkeleton />);
    expect(screen.queryByText("Loading plan...")).not.toBeInTheDocument();
    expect(screen.queryByText("No semesters yet")).not.toBeInTheDocument();
  });
});

describe("PlannerPageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<PlannerPageSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with planner-page-skeleton testid", () => {
    renderWithChakra(<PlannerPageSkeleton />);
    expect(screen.getByTestId("planner-page-skeleton")).toBeInTheDocument();
  });

  it("includes the inner PlannerSkeleton", () => {
    renderWithChakra(<PlannerPageSkeleton />);
    expect(screen.getByTestId("planner-skeleton")).toBeInTheDocument();
  });

  it("renders a header skeleton area with multiple skeleton elements", () => {
    const { container } = renderWithChakra(<PlannerPageSkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(30);
  });
});
