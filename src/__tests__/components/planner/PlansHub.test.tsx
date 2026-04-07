import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { PlanWithMeta } from "@/types/planner";
import PlansHub from "@/components/planner/PlansHub";

// Mock PlanCard to keep tests focused on PlansHub logic
vi.mock("@/components/planner/PlanCard", () => ({
  default: ({ plan, onOpen, canDelete }: any) =>
    React.createElement(
      "div",
      { "data-testid": `plan-card-${plan.id}`, onClick: () => onOpen(plan.id) },
      `${plan.name} canDelete=${canDelete}`
    ),
}));

function makePlan(overrides: Partial<PlanWithMeta> = {}): PlanWithMeta {
  return {
    id: 1,
    student_id: 1,
    name: "Test Plan",
    description: null,
    created_at: "2025-01-01",
    updated_at: "2025-01-15",
    program_ids: [1],
    term_count: 2,
    course_count: 5,
    total_credits: 15,
    has_graduate_program: false,
    ...overrides,
  };
}

describe("PlansHub", () => {
  const mockFetch = vi.fn();
  const defaultProps = {
    plans: [] as PlanWithMeta[],
    onOpenPlan: vi.fn(),
    onCreatePlan: vi.fn(),
    onRenamePlan: vi.fn().mockResolvedValue(undefined),
    onDeletePlan: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ plans: [] }),
    });
  });

  it("renders 'Your Plans' heading", () => {
    renderWithChakra(<PlansHub {...defaultProps} />);
    expect(
      screen.getAllByText("Your Plans").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows shared plans CTA", () => {
    renderWithChakra(<PlansHub {...defaultProps} />);
    expect(screen.getByText("Shared Plans")).toBeInTheDocument();
    expect(screen.getByText("View Shared Plans")).toBeInTheDocument();
  });

  it("shows empty state with create button when no plans", () => {
    renderWithChakra(<PlansHub {...defaultProps} plans={[]} />);

    expect(
      screen.getAllByText("No plans yet").length
    ).toBeGreaterThanOrEqual(1);

    expect(
      screen.getAllByText("Create Your First Plan").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders stats (plan count, total courses, total credits) when plans exist", () => {
    const plans = [
      makePlan({ id: 1, course_count: 5, total_credits: 15 }),
      makePlan({ id: 2, course_count: 7, total_credits: 21 }),
    ];
    renderWithChakra(<PlansHub {...defaultProps} plans={plans} />);

    // plan count: 2
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("plans").length).toBeGreaterThanOrEqual(1);

    // total courses: 5 + 7 = 12
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("total courses").length).toBeGreaterThanOrEqual(1);

    // total credits: 15 + 21 = 36
    expect(screen.getAllByText("36").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("total credits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a PlanCard for each plan", () => {
    const plans = [
      makePlan({ id: 1, name: "Plan A" }),
      makePlan({ id: 2, name: "Plan B" }),
      makePlan({ id: 3, name: "Plan C" }),
    ];
    renderWithChakra(<PlansHub {...defaultProps} plans={plans} />);

    expect(screen.getByTestId("plan-card-1")).toBeTruthy();
    expect(screen.getByTestId("plan-card-2")).toBeTruthy();
    expect(screen.getByTestId("plan-card-3")).toBeTruthy();
  });

  it("shows 'View Shared Plans' dashed card at end of grid when plans exist", () => {
    const plans = [makePlan({ id: 1 })];
    renderWithChakra(<PlansHub {...defaultProps} plans={plans} />);

    expect(
      screen.getAllByText("View Shared Plans").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls onCreatePlan when create button is clicked", () => {
    renderWithChakra(<PlansHub {...defaultProps} plans={[]} />);

    // In empty state, "Create Your First Plan" button triggers onCreatePlan
    const buttons = screen.getAllByText("Create Your First Plan");
    fireEvent.click(buttons[0]);

    expect(defaultProps.onCreatePlan).toHaveBeenCalledTimes(1);
  });

  it("passes canDelete=false to PlanCard when only one plan", () => {
    const plans = [makePlan({ id: 1, name: "Only Plan" })];
    renderWithChakra(<PlansHub {...defaultProps} plans={plans} />);

    const card = screen.getByTestId("plan-card-1");
    expect(card.textContent).toContain("canDelete=false");
  });
});
