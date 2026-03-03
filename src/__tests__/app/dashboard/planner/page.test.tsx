import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";

const {
  mockPush,
  mockRouter,
  mockGetUser,
  mockFrom,
  mockToaster,
  mockFetchPlans,
  mockCreatePlan,
  mockFetchTerms,
  mockFetchPlannedCourses,
  mockFetchAvailableCourses,
  mockFetchCompletedCourseIds,
  mockUpdatePlan,
  mockDeletePlan,
  mockGetOrCreateTerm,
  mockAddTermPlan,
  mockRemoveTermPlan,
  mockAddPlannedCourse,
  mockRemovePlannedCourse,
  mockMovePlannedCourse,
} = vi.hoisted(() => {
  const mockPush = vi.fn();
  return {
    mockPush,
    // Stable object reference — prevents useEffect([router]) from re-firing on every render
    mockRouter: { push: mockPush },
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockToaster: { create: vi.fn() },
    mockFetchPlans: vi.fn(),
    mockCreatePlan: vi.fn().mockResolvedValue({ id: 99, name: "My Plan", student_id: 1 }),
    mockFetchTerms: vi.fn().mockResolvedValue([]),
    mockFetchPlannedCourses: vi.fn().mockResolvedValue([]),
    mockFetchAvailableCourses: vi.fn().mockResolvedValue([]),
    mockFetchCompletedCourseIds: vi.fn().mockResolvedValue(new Set()),
    mockUpdatePlan: vi.fn().mockResolvedValue(undefined),
    mockDeletePlan: vi.fn().mockResolvedValue(undefined),
    mockGetOrCreateTerm: vi.fn().mockResolvedValue({ id: 1, season: "Fall", year: 2025 }),
    mockAddTermPlan: vi.fn().mockResolvedValue(undefined),
    mockRemoveTermPlan: vi.fn().mockResolvedValue(undefined),
    mockAddPlannedCourse: vi.fn().mockResolvedValue(undefined),
    mockRemovePlannedCourse: vi.fn().mockResolvedValue(undefined),
    mockMovePlannedCourse: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchPlans: mockFetchPlans,
  fetchStudentTerms: mockFetchTerms,
  fetchPlannedCourses: mockFetchPlannedCourses,
  fetchAvailableCourses: mockFetchAvailableCourses,
  fetchCompletedCourseIds: mockFetchCompletedCourseIds,
  createPlan: mockCreatePlan,
  updatePlan: mockUpdatePlan,
  deletePlan: mockDeletePlan,
  getOrCreateTerm: mockGetOrCreateTerm,
  addTermPlan: mockAddTermPlan,
  removeTermPlan: mockRemoveTermPlan,
  addPlannedCourse: mockAddPlannedCourse,
  removePlannedCourse: mockRemovePlannedCourse,
  movePlannedCourse: mockMovePlannedCourse,
}));

// Mock all child components to avoid DnD and complex setup
vi.mock("@/components/planner/PlansHub", () => ({
  default: ({ plans, onOpenPlan, onCreatePlan, onRenamePlan, onDeletePlan }: any) => (
    <div data-testid="plans-hub">
      <span>{plans.length} plans</span>
      <button data-testid="open-plan" onClick={() => onOpenPlan(plans[0]?.id)}>Open</button>
      <button data-testid="create-plan-btn" onClick={onCreatePlan}>Create</button>
      {plans[0] && <button data-testid="rename-plan" onClick={() => onRenamePlan(plans[0].id, "Renamed")}>Rename</button>}
      {plans[0] && <button data-testid="delete-plan" onClick={() => onDeletePlan(plans[0].id)}>Delete</button>}
    </div>
  ),
}));
vi.mock("@/components/planner/SemesterGrid", () => ({
  default: () => <div data-testid="semester-grid" />,
}));
vi.mock("@/components/planner/CoursePanel", () => ({
  default: () => <div data-testid="course-panel" />,
}));
vi.mock("@/components/planner/PlannerSummary", () => ({
  default: () => <div data-testid="planner-summary" />,
}));
vi.mock("@/components/planner/AddSemesterDialog", () => ({
  default: ({ open, onAdd }: any) => open ? (
    <div data-testid="add-semester-dialog">
      <button data-testid="submit-add-semester" onClick={() => onAdd("Fall", 2025)}>Add</button>
    </div>
  ) : null,
}));
vi.mock("@/components/planner/RemoveSemesterDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planner/CreatePlanDialog", () => ({
  default: ({ open, onCreatePlan }: any) => open ? (
    <div data-testid="create-plan-dialog">
      <button data-testid="submit-create-plan" onClick={() => onCreatePlan("New Plan", "desc", [1])}>Submit</button>
    </div>
  ) : null,
}));
vi.mock("@/components/planner/DeletePlanDialog", () => ({
  default: ({ open, onConfirm }: any) => open ? (
    <div data-testid="delete-plan-dialog">
      <button data-testid="confirm-delete" onClick={onConfirm}>Confirm</button>
    </div>
  ) : null,
}));
vi.mock("@/components/planner/DraggableCourseCard", () => ({
  default: () => null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

import PlannerPage from "@/app/dashboard/planner/page";

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockStudentRow(studentRow: { id: number } | null, error = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: studentRow, error });
  mockFrom.mockReturnValue(chain);
}

function mockStudentAndPrograms(studentId: number, programIds: number[] = []) {
  // First call: students table
  const studentChain: Record<string, any> = {};
  studentChain.select = vi.fn().mockReturnValue(studentChain);
  studentChain.eq = vi.fn().mockReturnValue(studentChain);
  studentChain.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: studentId }, error: null });

  // Second call: student_programs table
  const programsChain: Record<string, any> = {};
  programsChain.select = vi.fn().mockReturnValue(programsChain);
  programsChain.eq = vi.fn().mockReturnValue(programsChain);
  programsChain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) =>
      resolve({
        data: programIds.map((id) => ({ program_id: id })),
        error: null,
      })
    );

  mockFrom
    .mockReturnValueOnce(studentChain)
    .mockReturnValueOnce(programsChain);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PlannerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the default resolved values after vi.clearAllMocks()
    mockFetchTerms.mockResolvedValue([]);
    mockFetchPlannedCourses.mockResolvedValue([]);
    mockFetchAvailableCourses.mockResolvedValue([]);
    mockFetchCompletedCourseIds.mockResolvedValue(new Set());
    mockCreatePlan.mockResolvedValue({ id: 99, name: "My Plan", student_id: 1 });
  });

  it("shows loading spinner initially", () => {
    // getUser never resolves — stay in loading state
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<PlannerPage />);
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThanOrEqual(1);
  });

  it("redirects to signin when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("redirects to dashboard when student profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow(null);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders PlansHub with existing plans", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue([
      {
        id: 1,
        name: "Plan A",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
    ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });
  });

  it("auto-creates a plan when student has no plans", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentAndPrograms(1, [10]);
    mockFetchPlans
      .mockResolvedValueOnce([]) // First call: no plans
      .mockResolvedValueOnce([
        {
          id: 99,
          name: "My Plan",
          has_graduate_program: false,
          program_ids: [10],
          term_count: 0,
          course_count: 0,
          total_credits: 0,
        },
      ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith(1, "My Plan", null, [10]);
    });
  });

  it("shows error toaster when student query errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("DB error") });
    mockFrom.mockReturnValue(chain);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });
  });

  it("shows plans count in PlansHub mock", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue([
      {
        id: 1,
        name: "Plan A",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
      {
        id: 2,
        name: "Plan B",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
    ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      // PlansHub mock renders "{plans.length} plans"
      expect(screen.getAllByText("2 plans").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Workspace & Plan Operation Tests ──────────────────────────────────────

  /** Set up mocks so the component loads fully with a plan in hub view */
  function setupAuthenticatedState(plansOverride?: any[]) {
    const defaultPlans = [{
      id: 1, student_id: 1, name: "Plan A", description: null,
      created_at: "2025-01-01", updated_at: "2025-01-15",
      program_ids: [1], term_count: 2, course_count: 3,
      total_credits: 9, has_graduate_program: false,
    }];
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue(plansOverride ?? defaultPlans);
  }

  it("opens plan workspace when onOpenPlan is called", async () => {
    setupAuthenticatedState();
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      // Breadcrumb "Plans" text
      expect(screen.getAllByText("Plans").length).toBeGreaterThanOrEqual(1);
      // CoursePanel mock
      expect(screen.getByTestId("course-panel")).toBeInTheDocument();
    });
    // fetchStudentTerms should have been called when opening the plan
    expect(mockFetchTerms).toHaveBeenCalled();
  });

  it("shows plan name in workspace header", async () => {
    setupAuthenticatedState([{
      id: 1, student_id: 1, name: "Test Plan", description: null,
      created_at: "2025-01-01", updated_at: "2025-01-15",
      program_ids: [1], term_count: 0, course_count: 0,
      total_credits: 0, has_graduate_program: false,
    }]);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Test Plan").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No semesters yet' when plan has zero terms", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([]);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/No semesters yet/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows SemesterGrid when plan has terms", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([
      { id: 1, season: "Fall", year: 2025 },
      { id: 2, season: "Spring", year: 2026 },
    ]);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("semester-grid")).toBeInTheDocument();
    });
  });

  it("handles add semester", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([]);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    // Open plan to get to workspace
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });
    await waitFor(() => {
      expect(screen.getAllByText("Plans").length).toBeGreaterThanOrEqual(1);
    });

    // Click "Add Semester" button in the workspace header
    const addSemesterButtons = screen.getAllByText(/Add Semester/i);
    await act(async () => {
      fireEvent.click(addSemesterButtons[0]);
    });

    // Wait for the add semester dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("add-semester-dialog")).toBeInTheDocument();
    });

    // Submit the add semester form
    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-add-semester"));
    });

    await waitFor(() => {
      expect(mockGetOrCreateTerm).toHaveBeenCalledWith("Fall", 2025);
      expect(mockAddTermPlan).toHaveBeenCalled();
    });
  });

  it("handles create plan", async () => {
    setupAuthenticatedState();
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    // Click create plan button in PlansHub mock
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-plan-btn"));
    });

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("create-plan-dialog")).toBeInTheDocument();
    });

    // Submit the create plan form
    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-create-plan"));
    });

    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith(1, "New Plan", "desc", [1]);
    });
  });

  it("handles rename plan", async () => {
    setupAuthenticatedState();
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("rename-plan"));
    });

    await waitFor(() => {
      expect(mockUpdatePlan).toHaveBeenCalledWith(1, { name: "Renamed" });
    });
  });

  it("handles delete plan request and confirmation", async () => {
    setupAuthenticatedState();
    // After delete, fetchPlans will be called again - return empty
    mockFetchPlans.mockResolvedValueOnce([{
      id: 1, student_id: 1, name: "Plan A", description: null,
      created_at: "2025-01-01", updated_at: "2025-01-15",
      program_ids: [1], term_count: 2, course_count: 3,
      total_credits: 9, has_graduate_program: false,
    }]).mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    // Click delete plan button
    await act(async () => {
      fireEvent.click(screen.getByTestId("delete-plan"));
    });

    // Wait for delete confirmation dialog
    await waitFor(() => {
      expect(screen.getByTestId("delete-plan-dialog")).toBeInTheDocument();
    });

    // Confirm deletion
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-delete"));
    });

    await waitFor(() => {
      expect(mockDeletePlan).toHaveBeenCalledWith(1);
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Plan deleted" })
      );
    });
  });

  it("shows plan tabs when multiple plans exist", async () => {
    const twoPlans = [
      {
        id: 1, student_id: 1, name: "Plan Alpha", description: null,
        created_at: "2025-01-01", updated_at: "2025-01-15",
        program_ids: [1], term_count: 0, course_count: 0,
        total_credits: 0, has_graduate_program: false,
      },
      {
        id: 2, student_id: 1, name: "Plan Beta", description: null,
        created_at: "2025-01-02", updated_at: "2025-01-16",
        program_ids: [1], term_count: 0, course_count: 0,
        total_credits: 0, has_graduate_program: false,
      },
    ];
    setupAuthenticatedState(twoPlans);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    // Open the first plan to enter workspace
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    // In workspace view with >1 plan, both plan names should appear as tab buttons
    await waitFor(() => {
      expect(screen.getAllByText("Plan Alpha").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Plan Beta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows plan data loading spinner", async () => {
    setupAuthenticatedState();
    // Make fetchStudentTerms never resolve to keep planDataLoading=true
    mockFetchTerms.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });

    // Open plan — loadPlanData will hang because fetchStudentTerms never resolves
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Loading plan/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
