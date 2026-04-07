import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import { SettingsSkeleton, ClassHistorySkeleton } from "@/components/settings/SettingsSkeleton";

describe("SettingsSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<SettingsSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with settings-skeleton testid", () => {
    renderWithChakra(<SettingsSkeleton />);
    expect(screen.getByTestId("settings-skeleton")).toBeInTheDocument();
  });

  it("renders multiple card skeletons for form sections", () => {
    const { container } = renderWithChakra(<SettingsSkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(20);
  });

  it("does not render real settings text", () => {
    renderWithChakra(<SettingsSkeleton />);
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Address")).not.toBeInTheDocument();
  });
});

describe("ClassHistorySkeleton", () => {
  it("renders without crashing", () => {
    const { container } = renderWithChakra(<ClassHistorySkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders skeleton rows for course list sections", () => {
    const { container } = renderWithChakra(<ClassHistorySkeleton />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(15);
  });

  it("does not render real class history text", () => {
    renderWithChakra(<ClassHistorySkeleton />);
    expect(screen.queryByText("General Education")).not.toBeInTheDocument();
    expect(screen.queryByText("Major Requirements")).not.toBeInTheDocument();
  });
});
