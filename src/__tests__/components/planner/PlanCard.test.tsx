import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { PlanWithMeta } from "@/types/planner";
import PlanCard from "@/components/planner/PlanCard";

// Mock Chakra menu components to avoid Portal/positioning issues
vi.mock("@/components/ui/menu", () => ({
  MenuRoot: ({ children }: any) => React.createElement("div", null, children),
  MenuTrigger: ({ children }: any) => React.createElement("div", null, children),
  MenuContent: ({ children }: any) => React.createElement("div", null, children),
  MenuItem: ({ children, value, ...rest }: any) =>
    React.createElement(
      "button",
      { "data-testid": `menu-${value}`, ...rest },
      children
    ),
}));

// Mock ProgressCircle
vi.mock("@/components/ui/progress-circle", () => ({
  ProgressCircleRoot: ({ children, value }: any) =>
    React.createElement("div", { "data-testid": "progress-root", "data-value": value }, children),
  ProgressCircleRing: () => null,
  ProgressCircleValueText: ({ children }: any) =>
    React.createElement("span", null, children),
}));

function makePlan(overrides: Partial<PlanWithMeta> = {}): PlanWithMeta {
  return {
    id: 1,
    student_id: 1,
    name: "Test Plan",
    description: "A test plan",
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

describe("PlanCard", () => {
  const defaultProps = {
    plan: makePlan(),
    onOpen: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    canDelete: true,
    index: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onRename.mockResolvedValue(undefined);
  });

  it("renders plan name", () => {
    renderWithChakra(<PlanCard {...defaultProps} />);
    expect(
      screen.getAllByText("Test Plan").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows term count, course count, and credit stats", () => {
    const plan = makePlan({ term_count: 4, course_count: 12, total_credits: 36 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);

    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("semesters").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("courses").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("36").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("credits").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Graduate badge when has_graduate_program=true", () => {
    const plan = makePlan({ has_graduate_program: true });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    expect(
      screen.getAllByText("Graduate").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("does NOT show Graduate badge when has_graduate_program=false", () => {
    const plan = makePlan({ has_graduate_program: false });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    expect(screen.queryAllByText("Graduate").length).toBe(0);
  });

  it("calls onOpen(plan.id) when card body is clicked", () => {
    const plan = makePlan({ id: 42 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    // Click the outermost card element (role="group")
    const card = screen.getByRole("group");
    fireEvent.click(card);
    expect(defaultProps.onOpen).toHaveBeenCalledWith(42);
  });

  it("shows progress percentage based on credits (total_credits / 120 * 100)", () => {
    // 60 / 120 = 50%
    const plan = makePlan({ total_credits: 60 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    const progressRoot = screen.getByTestId("progress-root");
    expect(progressRoot.getAttribute("data-value")).toBe("50");
  });

  it("shows rename input when rename menu item is clicked, calls onRename on Enter key", async () => {
    const plan = makePlan({ id: 7, name: "Old Name" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);

    // Click the rename menu item
    const renameButton = screen.getByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButton);
    });

    // The input should now be visible with the current plan name
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Old Name");

    // Change the value and press Enter
    fireEvent.change(input, { target: { value: "New Name" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(defaultProps.onRename).toHaveBeenCalledWith(7, "New Name");
    });
  });

  it("hides delete menu item when canDelete=false", () => {
    renderWithChakra(<PlanCard {...defaultProps} canDelete={false} />);
    expect(screen.queryByTestId("menu-delete")).toBeNull();
  });

  it("calls onDelete when delete menu item is clicked", () => {
    const plan = makePlan({ id: 22 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} canDelete />);
    fireEvent.click(screen.getByTestId("menu-delete"));
    expect(defaultProps.onDelete).toHaveBeenCalledWith(22);
  });

  it("cancels rename on Escape and does not call onRename", async () => {
    const plan = makePlan({ id: 7, name: "Old Name" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    fireEvent.click(screen.getByTestId("menu-rename"));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Another Name" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).toBeNull();
    });
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("shows fallback updated text when updated_at is null", () => {
    const plan = makePlan({ updated_at: null as unknown as string });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    expect(screen.getByText("No changes yet")).toBeInTheDocument();
  });
});
