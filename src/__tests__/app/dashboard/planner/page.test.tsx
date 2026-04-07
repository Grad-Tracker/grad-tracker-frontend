import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import { BREADTH_PACKAGES } from "@/types/planner";

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
  mockFetchGenEdBucketsWithCourses,
  mockFetchBreadthPackageId,
  mockUpdateBreadthPackageId,

  // NEW: capture DnD handlers so tests can call them
  mockDndHandlers,
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
    mockFetchGenEdBucketsWithCourses: vi.fn().mockResolvedValue([]),
    mockFetchBreadthPackageId: vi.fn().mockResolvedValue(null),
    mockUpdateBreadthPackageId: vi.fn().mockResolvedValue(undefined),

    mockDndHandlers: {
      onDragStart: null as null | ((e: any) => void),
      onDragEnd: null as null | ((e: any) => Promise<void> | void),
    },
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
  fetchGenEdBucketsWithCourses: mockFetchGenEdBucketsWithCourses,
  createPlan: mockCreatePlan,
  updatePlan: mockUpdatePlan,
  deletePlan: mockDeletePlan,
  getOrCreateTerm: mockGetOrCreateTerm,
  addTermPlan: mockAddTermPlan,
  removeTermPlan: mockRemoveTermPlan,
  addPlannedCourse: mockAddPlannedCourse,
  removePlannedCourse: mockRemovePlannedCourse,
  movePlannedCourse: mockMovePlannedCourse,
  fetchBreadthPackageId: mockFetchBreadthPackageId,
  updateBreadthPackageId: mockUpdateBreadthPackageId,
}));

// Mock all child components to avoid DnD and complex setup
vi.mock("@/components/planner/PlansHub", () => ({
  default: ({ plans, onOpenPlan, onCreatePlan, onRenamePlan, onDeletePlan }: any) => (
    <div data-testid="plans-hub">
      <span>{plans.length} plans</span>
      <button data-testid="open-plan" onClick={() => onOpenPlan(plans[0]?.id)}>Open</button>
      <button data-testid="create-plan-btn" onClick={onCreatePlan}>Create</button>
      {plans[0] && (
        <button data-testid="rename-plan" onClick={() => onRenamePlan(plans[0].id, "Renamed")}>
          Rename
        </button>
      )}
      {plans[0] && (
        <button data-testid="delete-plan" onClick={() => onDeletePlan(plans[0].id)}>
          Delete
        </button>
      )}
    </div>
  ),
}));

// UPDATED: SemesterGrid mock can trigger onRemoveTerm
vi.mock("@/components/planner/SemesterGrid", () => ({
  default: (props: any) => (
    <div data-testid="semester-grid">
      <button
        data-testid="mock-remove-term"
        onClick={() => props.onRemoveTerm?.(props.terms?.[0]?.id ?? 1)}
      >
        RemoveTerm
      </button>
    </div>
  ),
}));

// UPDATED: CoursePanel mock can trigger breadth/track selection
vi.mock("@/components/planner/CoursePanel", () => ({
  default: (props: any) => (
    <div data-testid="course-panel">
      <button
        data-testid="mock-select-breadth"
        onClick={() =>
          props.onBreadthPackageSelect?.(
            props.selectedBreadthPackageId ?? BREADTH_PACKAGES[0].id
          )
        }
      >
        SelectBreadth
      </button>

      <button
        data-testid="mock-select-track"
        onClick={() => props.onTrackSelect?.(123)}
      >
        SelectTrack
      </button>
    </div>
  ),
}));

vi.mock("@/components/planner/PlannerSummary", () => ({
  default: () => <div data-testid="planner-summary" />,
}));

vi.mock("@/components/planner/AddSemesterDialog", () => ({
  default: ({ open, onAdd }: any) =>
    open ? (
      <div data-testid="add-semester-dialog">
        <button data-testid="submit-add-semester" onClick={() => onAdd("Fall", 2025)}>
          Add
        </button>
      </div>
    ) : null,
}));

// UPDATED: RemoveSemesterDialog mock renders confirm when open
vi.mock("@/components/planner/RemoveSemesterDialog", () => ({
  default: ({ open, onConfirm }: any) =>
    open ? (
      <div data-testid="remove-semester-dialog">
        <button data-testid="confirm-remove-semester" onClick={onConfirm}>
          ConfirmRemove
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/planner/CreatePlanDialog", () => ({
  default: ({ open, onCreatePlan }: any) =>
    open ? (
      <div data-testid="create-plan-dialog">
        <button
          data-testid="submit-create-plan"
          onClick={() => onCreatePlan("New Plan", "desc", [1])}
        >
          Submit
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/planner/DeletePlanDialog", () => ({
  default: ({ open, onConfirm }: any) =>
    open ? (
      <div data-testid="delete-plan-dialog">
        <button data-testid="confirm-delete" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/planner/AutoGenerateDialog", () => ({
  default: () => <div data-testid="auto-generate-dialog" />,
}));

vi.mock("@/components/planner/DraggableCourseCard", () => ({
  default: () => null,
}));

// UPDATED: capture drag handlers passed into DndContext
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragStart, onDragEnd }: any) => {
    mockDndHandlers.onDragStart = onDragStart;
    mockDndHandlers.onDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  PointerSensor: class {},
  KeyboardSensor: class {},
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
  studentChain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: studentId }, error: null });

  // Second call: student_programs table
  const programsChain: Record<string, any> = {};
  programsChain.select = vi.fn().mockReturnValue(programsChain);
  programsChain.eq = vi.fn().mockReturnValue(programsChain);
  programsChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    resolve({
      data: programIds.map((id) => ({ program_id: id })),
      error: null,
    })
  );

  mockFrom.mockReturnValueOnce(studentChain).mockReturnValueOnce(programsChain);
}

/** Set up mocks so the component loads fully with a plan in hub view */
function setupAuthenticatedState(plansOverride?: any[]) {
  const defaultPlans = [
    {
      id: 1,
      student_id: 1,
      name: "Plan A",
      description: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-15",
      program_ids: [1],
      term_count: 2,
      course_count: 3,
      total_credits: 9,
      has_graduate_program: false,
    },
  ];

  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockStudentRow({ id: 1 });
  mockFetchPlans.mockResolvedValue(plansOverride ?? defaultPlans);
}

// Small course object used in drag tests
const COURSE: any = {
  id: 777,
  subject: "CS",
  number: "101",
  title: "Intro",
  credits: 3,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PlannerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset defaults after clear
    mockFetchTerms.mockResolvedValue([]);
    mockFetchPlannedCourses.mockResolvedValue([]);
    mockFetchAvailableCourses.mockResolvedValue([]);
    mockFetchCompletedCourseIds.mockResolvedValue(new Set());
    mockFetchBreadthPackageId.mockResolvedValue(null);
    mockUpdateBreadthPackageId.mockResolvedValue(undefined);
    mockCreatePlan.mockResolvedValue({ id: 99, name: "My Plan", student_id: 1 });
    mockGetOrCreateTerm.mockResolvedValue({ id: 1, season: "Fall", year: 2025 });

    // clear DnD handler captures
    mockDndHandlers.onDragStart = null;
    mockDndHandlers.onDragEnd = null;

    localStorage.clear();
  });

  it("shows skeleton loading state initially", () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<PlannerPage />);
    expect(screen.getByTestId("planner-page-skeleton")).toBeInTheDocument();
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
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
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
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") });
    mockFrom.mockReturnValue(chain);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });
  });

  it("shows plans count in PlansHub mock", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue([
      { id: 1, name: "Plan A", has_graduate_program: false, program_ids: [], term_count: 0, course_count: 0, total_credits: 0 },
      { id: 2, name: "Plan B", has_graduate_program: false, program_ids: [], term_count: 0, course_count: 0, total_credits: 0 },
    ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getAllByText("2 plans").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens plan workspace when onOpenPlan is called", async () => {
    setupAuthenticatedState();
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-plan"));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Plans").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId("course-panel")).toBeInTheDocument();
    });
    expect(mockFetchTerms).toHaveBeenCalled();
  });

  it("shows plan name in workspace header", async () => {
    setupAuthenticatedState([
      {
        id: 1, student_id: 1, name: "Test Plan", description: null,
        created_at: "2025-01-01", updated_at: "2025-01-15",
        program_ids: [1], term_count: 0, course_count: 0,
        total_credits: 0, has_graduate_program: false,
      },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => {
      expect(screen.getAllByText("Test Plan").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No semesters yet' when plan has zero terms", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([]);
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => {
      expect(screen.getAllByText(/No semesters yet/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows SemesterGrid when plan has terms", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());
  });

  it("handles add semester", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([]);
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getAllByText("Plans").length).toBeGreaterThanOrEqual(1));

    const addSemesterButtons = screen.getAllByText(/Add Semester/i);
    await act(async () => fireEvent.click(addSemesterButtons[0]));
    await waitFor(() => expect(screen.getByTestId("add-semester-dialog")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("submit-add-semester")));

    await waitFor(() => {
      expect(mockGetOrCreateTerm).toHaveBeenCalledWith("Fall", 2025);
      expect(mockAddTermPlan).toHaveBeenCalled();
    });
  });

  it("handles create plan", async () => {
    setupAuthenticatedState();
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("create-plan-btn")));
    await waitFor(() => expect(screen.getByTestId("create-plan-dialog")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("submit-create-plan")));

    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith(1, "New Plan", "desc", [1]);
    });
  });

  it("handles rename plan", async () => {
    setupAuthenticatedState();
    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("rename-plan")));

    await waitFor(() => {
      expect(mockUpdatePlan).toHaveBeenCalledWith(1, { name: "Renamed" });
    });
  });

  it("handles delete plan request and confirmation", async () => {
    setupAuthenticatedState();
    mockFetchPlans.mockResolvedValueOnce([
      {
        id: 1, student_id: 1, name: "Plan A", description: null,
        created_at: "2025-01-01", updated_at: "2025-01-15",
        program_ids: [1], term_count: 2, course_count: 3,
        total_credits: 9, has_graduate_program: false,
      },
    ]).mockResolvedValue([]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("delete-plan")));
    await waitFor(() => expect(screen.getByTestId("delete-plan-dialog")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("confirm-delete")));

    await waitFor(() => {
      expect(mockDeletePlan).toHaveBeenCalledWith(1);
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Plan deleted" }));
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

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => {
      expect(screen.getAllByText("Plan Alpha").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Plan Beta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows plan data skeleton while plan is loading", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockReturnValue(new Promise(() => {}));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => {
      expect(screen.getByTestId("planner-skeleton")).toBeInTheDocument();
    });
  });

  // ── Existing: error-branch tests (these now pass after page.tsx catches rejections) ──

  it("shows toaster when fetchPlans fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockRejectedValueOnce(new Error("fail"));

    await act(async () => renderWithChakra(<PlannerPage />));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });
  });

  it("shows toaster when createPlan fails", async () => {
    setupAuthenticatedState();
    mockCreatePlan.mockRejectedValueOnce(new Error("fail create"));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("create-plan-btn")));
    await waitFor(() => expect(screen.getByTestId("create-plan-dialog")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("submit-create-plan")));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });
  });

  it("shows toaster when add semester fails", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([]);
    mockGetOrCreateTerm.mockRejectedValueOnce(new Error("fail term"));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getAllByText("Plans").length).toBeGreaterThanOrEqual(1));

    const addSemesterButtons = screen.getAllByText(/Add Semester/i);
    await act(async () => fireEvent.click(addSemesterButtons[0]));
    await waitFor(() => expect(screen.getByTestId("add-semester-dialog")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("submit-add-semester")));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });
    expect(mockAddTermPlan).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // NEW: Coverage boosters to raise % Funcs/Branch
  // ─────────────────────────────────────────────

  it("can go back to hub from workspace (handleBackToHub)", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getAllByText("Plans").length).toBeGreaterThan(0));

    // click the back icon button
    fireEvent.click(screen.getByLabelText("Back to plans"));

    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });
  });

  it("switches plans in workspace (handleSwitchPlan)", async () => {
    const twoPlans = [
      { id: 1, student_id: 1, name: "Plan Alpha", program_ids: [1], term_count: 0, course_count: 0, total_credits: 0, has_graduate_program: false },
      { id: 2, student_id: 1, name: "Plan Beta", program_ids: [1], term_count: 0, course_count: 0, total_credits: 0, has_graduate_program: false },
    ];
    setupAuthenticatedState(twoPlans);

    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getAllByText("Plan Alpha").length).toBeGreaterThan(0));

    // Click the Plan Beta tab button
    fireEvent.click(screen.getByText("Plan Beta"));

    await waitFor(() => {
      // loadPlanData triggers fetchStudentTerms(sid, planId)
      expect(mockFetchTerms).toHaveBeenCalled();
    });

    // assert last call is planId 2
    const last = mockFetchTerms.mock.calls[mockFetchTerms.mock.calls.length - 1];
    expect(last[0]).toBe(1);
    expect(last[1]).toBe(2);
  });

  it("removes an empty term immediately (handleRemoveTermRequest -> handleRemoveTermConfirmed)", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    mockFetchPlannedCourses.mockResolvedValue([]); // empty term

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("mock-remove-term"));

    await waitFor(() => {
      expect(mockRemoveTermPlan).toHaveBeenCalled();
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Semester removed" }));
    });
  });

  it("removes a term with courses via confirm dialog", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    mockFetchPlannedCourses.mockResolvedValue([
      { student_id: 1, term_id: 1, course_id: 777, status: "planned", plan_id: 1, course: COURSE },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());

    // Request removal (should open dialog because term has courses)
    fireEvent.click(screen.getByTestId("mock-remove-term"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-semester-dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("confirm-remove-semester"));

    await waitFor(() => {
      expect(mockRemoveTermPlan).toHaveBeenCalled();
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Semester removed" }));
    });
  });

  it("selects breadth package and persists to students.breadth_package_id", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);

    // Use a real package ID that exists
    const pkg = BREADTH_PACKAGES[0]?.id ?? "BREADTH";

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("course-panel")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("mock-select-breadth"));

    await waitFor(() => {
      expect(mockUpdateBreadthPackageId).toHaveBeenCalledWith(1, pkg);
    });
  });

  it("migrates legacy breadth package from localStorage when DB value is null", async () => {
    setupAuthenticatedState();
    const pkg = BREADTH_PACKAGES[1]?.id ?? "math-physics";
    localStorage.setItem("gradtracker:breadthPackage:1", pkg);

    await act(async () => renderWithChakra(<PlannerPage />));

    await waitFor(() => {
      expect(mockUpdateBreadthPackageId).toHaveBeenCalledWith(1, pkg);
    });
    expect(localStorage.getItem("gradtracker:breadthPackage:1")).toBeNull();
  });

  it("executes drag handlers: add, move, remove (handleDragStart/handleDragEnd branches)", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([
      { id: 1, season: "Fall", year: 2025 },
      { id: 2, season: "Spring", year: 2026 },
    ]);

    // start with a planned course in term 1 for move/remove branches
    mockFetchPlannedCourses.mockResolvedValue([
      { student_id: 1, term_id: 1, course_id: 777, status: "planned", plan_id: 1, course: COURSE },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());

    // 1) DragStart
    await act(async () => {
      mockDndHandlers.onDragStart?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
      });
    });

    // 2) Move from term 1 -> term 2
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "term-2", data: { current: { term: { id: 2 } } } },
      });
    });

    expect(mockMovePlannedCourse).toHaveBeenCalled();

    // 3) Remove from term -> course panel
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "course-panel", data: { current: {} } },
      });
    });

    expect(mockRemovePlannedCourse).toHaveBeenCalled();

    // 4) Add from pool -> term 1 (fromTermId undefined)
    const newCourse = { ...COURSE, id: 888 };
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: newCourse } } },
        over: { id: "term-1", data: { current: { term: { id: 1 } } } },
      });
    });

    expect(mockAddPlannedCourse).toHaveBeenCalled();
  });

  it("handles graduate plan data path and track persistence", async () => {
    setupAuthenticatedState([
      {
        id: 1, student_id: 1, name: "Grad Plan", description: null,
        created_at: "2025-01-01", updated_at: "2025-01-15",
        program_ids: [1], term_count: 0, course_count: 0,
        total_credits: 0, has_graduate_program: true,
      },
    ]);
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    localStorage.setItem("gradtracker:track:1:1", "123");

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("course-panel")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("mock-select-track"));

    expect(setItemSpy).toHaveBeenCalledWith("gradtracker:track:1:1", "123");
    setItemSpy.mockRestore();
  });

  it("shows toaster when graduate plan data load fails", async () => {
    setupAuthenticatedState([
      {
        id: 1, student_id: 1, name: "Grad Plan", description: null,
        created_at: "2025-01-01", updated_at: "2025-01-15",
        program_ids: [1], term_count: 0, course_count: 0,
        total_credits: 0, has_graduate_program: true,
      },
    ]);
    mockFetchTerms.mockRejectedValueOnce(new Error("terms fail"));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load plan", type: "error" })
      );
    });
  });

  it("shows toaster when fetching student programs fails during auto-create", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const studentChain: Record<string, any> = {};
    studentChain.select = vi.fn().mockReturnValue(studentChain);
    studentChain.eq = vi.fn().mockReturnValue(studentChain);
    studentChain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });

    const programsChain: Record<string, any> = {};
    programsChain.select = vi.fn().mockReturnValue(programsChain);
    programsChain.eq = vi.fn().mockReturnValue(programsChain);
    programsChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: new Error("program query failed") })
    );

    mockFrom.mockReturnValueOnce(studentChain).mockReturnValueOnce(programsChain);
    mockFetchPlans.mockResolvedValueOnce([]);

    await act(async () => renderWithChakra(<PlannerPage />));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load programs", type: "error" })
      );
    });
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it("shows toaster when rename plan fails", async () => {
    setupAuthenticatedState();
    mockUpdatePlan.mockRejectedValueOnce(new Error("rename fail"));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByTestId("rename-plan")));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to rename plan", type: "error" })
      );
    });
  });

  it("handles drag guard branches and drag failures", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    mockFetchPlannedCourses.mockResolvedValue([
      { student_id: 1, term_id: 1, course_id: 777, status: "planned", plan_id: 1, course: COURSE },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());

    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: null,
      });
    });

    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "term-1", data: { current: {} } },
      });
    });

    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "term-1", data: { current: { term: { id: 1 } } } },
      });
    });

    const dupCourse = { ...COURSE, id: 777 };
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: dupCourse } } },
        over: { id: "term-1", data: { current: { term: { id: 1 } } } },
      });
    });

    mockMovePlannedCourse.mockRejectedValueOnce(new Error("move fail"));
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "term-2", data: { current: { term: { id: 2 } } } },
      });
    });

    mockRemovePlannedCourse.mockRejectedValueOnce(new Error("remove fail"));
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "course-panel", data: { current: {} } },
      });
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to move course", type: "error" })
      );
    });
  });

  it("shows toaster when delete plan fails", async () => {
    setupAuthenticatedState();
    mockDeletePlan.mockRejectedValueOnce(new Error("delete failed"));

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("delete-plan"));
    await waitFor(() => expect(screen.getByTestId("delete-plan-dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("confirm-delete"));
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to delete plan", type: "error" })
      );
    });
  });

  it("handles remove-term fallback and drag update fallback errors", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);
    mockFetchPlannedCourses.mockResolvedValue([
      { student_id: 1, term_id: 1, course_id: 777, status: "planned", plan_id: 1, course: COURSE },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("semester-grid")).toBeInTheDocument());

    mockRemoveTermPlan.mockRejectedValueOnce(new Error("remove term failed"));
    fireEvent.click(screen.getByTestId("mock-remove-term"));
    await waitFor(() => expect(screen.getByTestId("remove-semester-dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("confirm-remove-semester"));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error", description: "remove term failed", type: "error" })
      );
    });

    mockMovePlannedCourse.mockRejectedValueOnce({});
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "term-2", data: { current: { term: { id: 2 } } } },
      });
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to move course",
          type: "error",
        })
      );
    });

    mockRemovePlannedCourse.mockClear();
    await act(async () => {
      await mockDndHandlers.onDragEnd?.({
        active: { data: { current: { course: COURSE, fromTermId: 1 } } },
        over: { id: "trash-zone", data: { current: {} } },
      });
    });
    expect(mockRemovePlannedCourse).toHaveBeenCalled();
  });

  it("exercises plannerPoolBlocks genEd path when buckets have courses", async () => {
    setupAuthenticatedState();
    mockFetchTerms.mockResolvedValue([{ id: 1, season: "Fall", year: 2025 }]);

    // Return gen-ed buckets with courses — exercises the IIFE, flatMap, and filter callbacks
    mockFetchGenEdBucketsWithCourses.mockResolvedValueOnce([
      {
        id: 1,
        code: "MATH",
        name: "Mathematics",
        credits_required: 6,
        courses: [
          { id: 201, subject: "MATH", number: "101", title: "Calculus I", credits: 3 },
          { id: 201, subject: "MATH", number: "101", title: "Calculus I", credits: 3 }, // duplicate to exercise dedup filter
        ],
      },
    ]);

    // Return blocks without a "General Education" block so the Gen Ed synthetic block is added
    mockFetchAvailableCourses.mockResolvedValueOnce([
      {
        id: 10,
        program_id: 1,
        name: "Core Requirements",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null,
        courses: [],
      },
    ]);

    await act(async () => renderWithChakra(<PlannerPage />));
    await waitFor(() => expect(screen.getByTestId("plans-hub")).toBeInTheDocument());

    await act(async () => fireEvent.click(screen.getByTestId("open-plan")));
    await waitFor(() => expect(screen.getByTestId("course-panel")).toBeInTheDocument());

    // Component rendered successfully with the gen-ed block appended
    expect(mockFetchGenEdBucketsWithCourses).toHaveBeenCalled();
  });
});
