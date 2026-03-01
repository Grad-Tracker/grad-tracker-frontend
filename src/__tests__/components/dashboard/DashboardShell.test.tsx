import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";

vi.mock("@/components/dashboard/DashboardSidebar", () => ({
  default: () => <div data-testid="dashboard-sidebar">Sidebar</div>,
}));

vi.mock("@/components/dashboard/DashboardHeader", () => ({
  default: () => <div data-testid="dashboard-header">Header</div>,
}));

import DashboardShell from "@/components/dashboard/DashboardShell";

describe("DashboardShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sidebar", () => {
    renderWithChakra(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>
    );
    expect(screen.getByTestId("dashboard-sidebar")).toBeInTheDocument();
  });

  it("renders header", () => {
    renderWithChakra(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>
    );
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderWithChakra(
      <DashboardShell>
        <div data-testid="child-content">My Dashboard Content</div>
      </DashboardShell>
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getAllByText("My Dashboard Content").length).toBeGreaterThanOrEqual(1);
  });

  it("renders multiple children", () => {
    renderWithChakra(
      <DashboardShell>
        <div>Section A</div>
        <div>Section B</div>
      </DashboardShell>
    );
    expect(screen.getAllByText("Section A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Section B").length).toBeGreaterThanOrEqual(1);
  });
});
