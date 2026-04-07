import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { RequirementsSkeleton, GenEdSkeleton } from "@/components/requirements/RequirementsSkeleton";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("RequirementsSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<RequirementsSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with requirements-skeleton testid", () => {
    renderWithChakra(<RequirementsSkeleton />);
    expect(screen.getByTestId("requirements-skeleton")).toBeInTheDocument();
  });

  it("renders multiple card-style skeleton blocks", () => {
    const { container } = renderWithChakra(<RequirementsSkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(20);
  });

  it("does not render real requirements text", () => {
    renderWithChakra(<RequirementsSkeleton />);
    expect(screen.queryByText("Loading degree blocks...")).not.toBeInTheDocument();
    expect(screen.queryByText("Major Core")).not.toBeInTheDocument();
  });
});

describe("GenEdSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<GenEdSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with gen-ed-skeleton testid", () => {
    renderWithChakra(<GenEdSkeleton />);
    expect(screen.getByTestId("gen-ed-skeleton")).toBeInTheDocument();
  });

  it("renders skeleton rows for gen-ed categories", () => {
    const { container } = renderWithChakra(<GenEdSkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(10);
  });

  it("does not render the old loading text", () => {
    renderWithChakra(<GenEdSkeleton />);
    expect(screen.queryByText(/Loading Gen Ed/)).not.toBeInTheDocument();
  });
});
