import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { PlanWithMeta } from "@/types/planner";
import DeletePlanDialog from "@/components/planner/DeletePlanDialog";

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

describe("DeletePlanDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    plan: makePlan(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onConfirm.mockResolvedValue(undefined);
  });

  it("renders dialog title and plan name when open with a plan", () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} />);
    expect(screen.getAllByText("Delete Plan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Test Plan").length).toBeGreaterThanOrEqual(1);
  });

  it("displays plan stats (term count, course count) in confirmation text", () => {
    const plan = makePlan({ term_count: 3, course_count: 8 });
    renderWithChakra(<DeletePlanDialog {...defaultProps} plan={plan} />);
    expect(screen.getAllByText(/3 semesters/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/8 planned courses/).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onConfirm when delete button is clicked", async () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} />);
    const deleteButtons = screen.getAllByText("Delete Plan");
    // The last "Delete Plan" text is the action button (the first is the dialog title)
    const deleteButton = deleteButtons[deleteButtons.length - 1];

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("closes dialog (calls onOpenChange(false)) after successful delete", async () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} />);

    const deleteButtons = screen.getAllByText("Delete Plan");
    const deleteButton = deleteButtons[deleteButtons.length - 1];

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
      // handleDelete calls onOpenChange(false) after confirm resolves
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  }, 15000);

  it("shows loading state on delete button while confirming", async () => {
    let resolveConfirm!: () => void;
    const slowConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );

    renderWithChakra(<DeletePlanDialog {...defaultProps} onConfirm={slowConfirm} />);

    const deleteButtons = screen.getAllByText("Delete Plan");
    const deleteButton = deleteButtons[deleteButtons.length - 1];

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      const btn = deleteButton.closest("button");
      expect(btn).toBeTruthy();
      expect(
        btn!.hasAttribute("disabled") ||
          btn!.hasAttribute("data-loading") ||
          btn!.getAttribute("aria-busy") === "true"
      ).toBe(true);
    });

    await act(async () => {
      resolveConfirm();
    });
  }, 15000);

  it("calls onOpenChange(false) when Cancel is clicked (covers Dialog.Root onOpenChange branch)", async () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // This should flow through Dialog.Root onOpenChange={(e)=> onOpenChange(e.open)}
    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("calls onOpenChange(false) when CloseButton is clicked (covers Dialog.Root onOpenChange branch)", async () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} />);

    // Chakra CloseButton is usually aria-label="Close"
    const closeBtn =
      screen.queryByRole("button", { name: /close/i }) ??
      // fallback: last button in dialog header area if aria-label differs
      screen.getAllByRole("button")[screen.getAllByRole("button").length - 1];

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("renders safely when plan is null (covers ?? 0 fallbacks)", () => {
    renderWithChakra(
      <DeletePlanDialog
        {...defaultProps}
        plan={null}
      />
    );

    // Still shows title
    expect(screen.getAllByText("Delete Plan").length).toBeGreaterThanOrEqual(1);

    // Fallback text uses 0 when plan is null
    expect(screen.getAllByText(/0 semesters/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/0 planned courses/).length).toBeGreaterThanOrEqual(1);
  });

  it("does not render content when open={false}", () => {
    renderWithChakra(<DeletePlanDialog {...defaultProps} open={false} />);
    expect(screen.queryAllByText("Delete Plan").length).toBe(0);
    expect(screen.queryAllByText("Test Plan").length).toBe(0);
  });
});
