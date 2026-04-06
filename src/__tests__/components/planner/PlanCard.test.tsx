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

  it("calls onDelete(plan.id) when delete menu item is clicked", () => {
    const plan = makePlan({ id: 7 });
    const onDelete = vi.fn();
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} onDelete={onDelete} canDelete={true} />);
    const deleteButton = screen.getByTestId("menu-delete");
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(7);
  });

  it("shows 'No changes yet' when updated_at is null", () => {
    const plan = { ...makePlan(), updated_at: null } as unknown as PlanWithMeta;
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    expect(screen.getAllByText("No changes yet").length).toBeGreaterThanOrEqual(1);
  });

  it("shows formatted date when updated_at is set", () => {
    const plan = makePlan({ updated_at: "2025-01-15" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    // Should show "Updated Jan 15" or similar formatted date
    expect(screen.getAllByText(/Updated/).length).toBeGreaterThanOrEqual(1);
  });

  it("Cancel button during rename hides the input and restores plan name", async () => {
    const plan = makePlan({ name: "My Plan" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);

    // Enter rename mode via rename menu item
    const renameButton = screen.getByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButton);
    });

    // Input should be visible
    expect(screen.getByRole("textbox")).toBeTruthy();

    // Click Cancel button
    const cancelButton = screen.getByLabelText("Cancel");
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Input should be gone; plan name heading should be back
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByText("My Plan").length).toBeGreaterThanOrEqual(1);
  });

  it("Escape key during rename hides the input", async () => {
    const plan = makePlan({ name: "Escape Plan" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);

    const renameButton = screen.getByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButton);
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).toBeNull();
    });
    expect(screen.getAllByText("Escape Plan").length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("shows 0% progress when total_credits is 0", () => {
    const plan = makePlan({ total_credits: 0 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    const progressRoot = screen.getByTestId("progress-root");
    expect(progressRoot.getAttribute("data-value")).toBe("0");
  });

  it("shows 75% progress when total_credits is 90 (green color threshold)", () => {
    const plan = makePlan({ total_credits: 90 });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);
    const progressRoot = screen.getByTestId("progress-root");
    expect(progressRoot.getAttribute("data-value")).toBe("75");
  });

  it("does not call onRename when confirm is clicked but name is unchanged", async () => {
    const plan = makePlan({ id: 5, name: "Same Name" });
    renderWithChakra(<PlanCard {...defaultProps} plan={plan} />);

    const renameButton = screen.getByTestId("menu-rename");
    await act(async () => {
      fireEvent.click(renameButton);
    });

    // Do NOT change the value — click confirm with same name
    const confirmButton = screen.getByLabelText("Confirm");
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // onRename should not be called for unchanged name
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });
});
