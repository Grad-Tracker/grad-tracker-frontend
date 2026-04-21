import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import CreatePlanDrawer from "@/components/planner/CreatePlanDrawer";

const { mockFetchPrograms, mockAutoGeneratePlan } = vi.hoisted(() => ({
  mockFetchPrograms: vi.fn(),
  mockAutoGeneratePlan: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/onboarding", () => ({
  fetchPrograms: mockFetchPrograms,
}));

vi.mock("@/lib/planner/auto-generate-orchestrator", () => ({
  autoGeneratePlan: mockAutoGeneratePlan,
}));

vi.mock("@/components/shared/ProgramSelector", () => ({
  default: () => <div data-testid="program-selector" />,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    size,
  }: {
    checked?: boolean;
    onCheckedChange: (payload: { checked: boolean }) => void;
    size?: string;
  }) => (
    <button
      data-testid={size === "sm" ? "include-summers-switch" : "autofill-switch"}
      aria-pressed={checked ? "true" : "false"}
      onClick={() => onCheckedChange({ checked: !checked })}
      type="button"
    >
      switch
    </button>
  ),
}));

describe("CreatePlanDrawer", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    studentId: 10,
    programIds: [1],
    plans: [],
    activePlanId: null,
    existingPlanCount: 0,
    onCreatePlan: vi.fn().mockResolvedValue(undefined),
    onAutoFillComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onCreatePlan.mockResolvedValue(undefined);
    mockFetchPrograms.mockImplementation((type: string) =>
      Promise.resolve([
        {
          id: type === "MAJOR" ? 1 : 2,
          name: `${type} Program`,
          catalog_year: "2025",
          program_type: type,
        },
      ])
    );
  });

  it("creates a blank plan and closes the drawer", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDrawer {...defaultProps} />);
    });

    await waitFor(() => {
      expect(mockFetchPrograms).toHaveBeenCalledTimes(4);
    });

    const createButton = screen.getByRole("button", { name: "Create Plan" });
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(defaultProps.onCreatePlan).toHaveBeenCalledWith(
        "Plan 1",
        null,
        [1],
        false
      );
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("auto-fills plan and routes to the generated plan", async () => {
    mockAutoGeneratePlan.mockResolvedValue({
      planId: 77,
      semesters: [
        {
          season: "Fall",
          year: 2026,
          courses: [{ id: 1, subject: "CS", number: "101" }],
          totalCredits: 3,
        },
      ],
      totalCourses: 1,
      totalCredits: 3,
      validation: {
        valid: true,
        issues: [],
        blockStatuses: [],
        genEdStatuses: [],
        unscheduledCourses: [],
      },
    });

    await act(async () => {
      renderWithChakra(<CreatePlanDrawer {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("autofill-switch"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mathematics" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create & Auto-Fill" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Plan Generated")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View Plan" }));
    });

    expect(defaultProps.onAutoFillComplete).toHaveBeenCalledWith(77);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onCreatePlan).not.toHaveBeenCalled();
  });

  it("shows an error state and allows retry when auto-fill fails", async () => {
    mockAutoGeneratePlan.mockRejectedValue(new Error("Auto generation failed"));

    await act(async () => {
      renderWithChakra(<CreatePlanDrawer {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("autofill-switch"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mathematics" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create & Auto-Fill" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Generation Failed")).toBeInTheDocument();
      expect(screen.getByText("Auto generation failed")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });

    expect(mockAutoGeneratePlan).toHaveBeenCalledTimes(2);
  });
});
