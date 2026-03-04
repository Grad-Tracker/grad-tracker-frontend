import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { PlanWithMeta } from "@/types/planner";
import PlanSwitcher from "@/components/planner/PlanSwitcher";

// Mock Chakra popover to avoid Portal/positioning issues
vi.mock("@/components/ui/popover", () => ({
  PopoverRoot: ({ children }: any) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({ children }: any) =>
    React.createElement("div", null, children),
  PopoverContent: ({ children }: any) =>
    React.createElement("div", null, children),
  PopoverBody: ({ children }: any) =>
    React.createElement("div", null, children),
}));

// Mock Chakra menu to avoid Portal/positioning issues
vi.mock("@/components/ui/menu", () => ({
  MenuRoot: ({ children }: any) =>
    React.createElement("div", null, children),
  MenuTrigger: ({ children }: any) =>
    React.createElement("div", null, children),
  MenuContent: ({ children }: any) =>
    React.createElement("div", null, children),
  MenuItem: ({ children, value, ...rest }: any) =>
    React.createElement(
      "button",
      { "data-testid": `menu-${value}`, ...rest },
      children
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

describe("PlanSwitcher", () => {
  const plan1 = makePlan({ id: 1, name: "Plan Alpha", course_count: 5, total_credits: 15, term_count: 2 });
  const plan2 = makePlan({ id: 2, name: "Plan Beta", course_count: 10, total_credits: 30, term_count: 4 });

  const defaultProps = {
    plans: [plan1, plan2],
    activePlanId: 1,
    onSwitchPlan: vi.fn(),
    onCreatePlan: vi.fn(),
    onRenamePlan: vi.fn().mockResolvedValue(undefined),
    onDeletePlan: vi.fn(),
    onEditPrograms: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onRenamePlan.mockResolvedValue(undefined);
  });

  it("renders active plan name in the trigger button", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    expect(
      screen.getAllByText("Plan Alpha").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders all plans in the list", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    expect(
      screen.getAllByText("Plan Alpha").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Plan Beta").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows course count and credit info for each plan", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    // Plan Alpha: 5 courses, 15 credits
    expect(
      screen.getAllByText("5 courses").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("15 credits").length
    ).toBeGreaterThanOrEqual(1);
    // Plan Beta: 10 courses, 30 credits
    expect(
      screen.getAllByText("10 courses").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("30 credits").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls onSwitchPlan when a plan row is clicked", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    // Click on Plan Beta text to trigger onSwitchPlan
    const betaElements = screen.getAllByText("Plan Beta");
    fireEvent.click(betaElements[0]);
    expect(defaultProps.onSwitchPlan).toHaveBeenCalledWith(2);
  });

  it("calls onCreatePlan when 'Create New Plan' button is clicked", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    const createButtons = screen.getAllByText("Create New Plan");
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(createButtons[0]);
    expect(defaultProps.onCreatePlan).toHaveBeenCalled();
  });

  it("shows rename input when rename is triggered, confirms on Enter", async () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);

    // Click the rename menu item for the first plan
    const renameButtons = screen.getAllByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButtons[0]);
    });

    // The input should now be visible with the current plan name
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Plan Alpha");

    // Change the value and press Enter
    fireEvent.change(input, { target: { value: "Renamed Plan" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(defaultProps.onRenamePlan).toHaveBeenCalledWith(1, "Renamed Plan");
    });
  });

  it("calls onDeletePlan when delete is triggered", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    const deleteButtons = screen.getAllByTestId("menu-delete");
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(deleteButtons[0]);
    expect(defaultProps.onDeletePlan).toHaveBeenCalledWith(1);
  });

  it("hides delete option when only one plan exists", () => {
    const singlePlanProps = {
      ...defaultProps,
      plans: [plan1],
    };
    renderWithChakra(<PlanSwitcher {...singlePlanProps} />);
    expect(screen.queryAllByTestId("menu-delete").length).toBe(0);
  });

  it("calls onEditPrograms when Edit Programs menu item is clicked", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);
    // Each plan has an "edit-programs" menu item
    const editButtons = screen.getAllByTestId("menu-edit-programs");
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(editButtons[0]);
    expect(defaultProps.onEditPrograms).toHaveBeenCalledWith(1);
  });

  it("Cancel button during rename hides the input", async () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);

    // Start rename
    const renameButtons = screen.getAllByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButtons[0]);
    });

    // Input should be visible
    expect(screen.getByRole("textbox")).toBeTruthy();

    // Click Cancel button
    const cancelButton = screen.getByLabelText("Cancel");
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Input should be gone, plan names should be back
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByText("Plan Alpha").length).toBeGreaterThanOrEqual(1);
  });

  it("Escape key during rename calls cancelRename and hides input", async () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);

    const renameButtons = screen.getAllByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButtons[0]);
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("Confirm button during rename calls onRenamePlan with new value", async () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} />);

    const renameButtons = screen.getAllByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButtons[0]);
    });

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Confirmed Name" } });

    const confirmButton = screen.getByLabelText("Confirm");
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(defaultProps.onRenamePlan).toHaveBeenCalledWith(1, "Confirmed Name");
    });
  });

  it("shows 'No Plan' when activePlanId does not match any plan", () => {
    renderWithChakra(<PlanSwitcher {...defaultProps} activePlanId={999} />);
    expect(screen.getAllByText("No Plan").length).toBeGreaterThanOrEqual(1);
  });
});
