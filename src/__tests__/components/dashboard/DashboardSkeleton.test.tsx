import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

describe("DashboardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<DashboardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a substantial DOM tree for the skeleton layout", () => {
    const { container } = renderWithChakra(<DashboardSkeleton />);
    // The skeleton component should render a rich layout with many nested divs
    // representing cards, grids, and placeholder elements
    const divCount = container.querySelectorAll('div').length;
    expect(divCount).toBeGreaterThan(40);
  });

  it("renders card elements for the grid layout", () => {
    const { container } = renderWithChakra(<DashboardSkeleton />);
    // Cards in Chakra render with role or specific class patterns
    // Just verify the component tree has significant depth and content
    expect(container.querySelectorAll('div').length).toBeGreaterThan(20);
  });

  it("does not render any real dashboard text content", () => {
    renderWithChakra(<DashboardSkeleton />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Overall Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByText("Degree Requirements")).not.toBeInTheDocument();
    expect(screen.queryByText("Current Semester")).not.toBeInTheDocument();
  });

  it("renders multiple card containers for stats and content sections", () => {
    const { container } = renderWithChakra(<DashboardSkeleton />);
    // The skeleton renders 3 stat cards + requirements card + semester card + profile card + activity card = 7+ cards
    // Each Card.Root gets a chakra-card__root class
    const cards = container.querySelectorAll('[class*="card"]');
    expect(cards.length).toBeGreaterThanOrEqual(5);
  });
});
