import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const {
  mockPush,
  mockReplace,
  mockRefresh,
  mockGetUser,
  mockSignOut,
  mockFrom,
  mockCheckOnboardingStatus,
  mockGetOrCreateStudent,
  mockFetchPrograms,
  mockFetchStudentProfileByAuthUserId,
  mockFetchStudentMajorProgram,
  mockFetchStudentCourseProgress,
  mockFetchRecentStudentActivity,
  mockLogStudentActivity,
  mockToasterCreate,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockCheckOnboardingStatus: vi.fn(),
  mockGetOrCreateStudent: vi.fn(),
  mockFetchPrograms: vi.fn(),
  mockFetchStudentProfileByAuthUserId: vi.fn(),
  mockFetchStudentMajorProgram: vi.fn(),
  mockFetchStudentCourseProgress: vi.fn(),
  mockFetchRecentStudentActivity: vi.fn(),
  mockLogStudentActivity: vi.fn(),
  mockToasterCreate: vi.fn(),
}));

const mockRouter = { push: mockPush, replace: mockReplace, refresh: mockRefresh };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));
vi.mock("next/link", () => ({
  default: (p: any) => <a href={p.href}>{p.children}</a>,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser, signOut: mockSignOut },
    from: mockFrom,
  }),
}));
vi.mock("@/lib/supabase/queries/onboarding", () => ({
  checkOnboardingStatus: (...args: any[]) => mockCheckOnboardingStatus(...args),
  getOrCreateStudent: (...args: any[]) => mockGetOrCreateStudent(...args),
  fetchPrograms: (...args: any[]) => mockFetchPrograms(...args),
  fetchStudentProfileByAuthUserId: (...args: any[]) =>
    mockFetchStudentProfileByAuthUserId(...args),
  fetchStudentMajorProgram: (...args: any[]) => mockFetchStudentMajorProgram(...args),
}));
vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchStudentCourseProgress: (...args: any[]) => mockFetchStudentCourseProgress(...args),
}));
vi.mock("@/lib/supabase/queries/activity", () => ({
  fetchRecentStudentActivity: (...args: any[]) => mockFetchRecentStudentActivity(...args),
  logStudentActivity: (...args: any[]) => mockLogStudentActivity(...args),
}));
vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: mockToasterCreate, success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/progress", () => ({
  ProgressBar: () => null,
  ProgressLabel: (p: any) => <span>{p.children}</span>,
  ProgressRoot: (p: any) => <div>{p.children}</div>,
  ProgressValueText: () => null,
}));
vi.mock("@/components/ui/progress-circle", () => ({
  ProgressCircleRing: () => null,
  ProgressCircleRoot: (p: any) => <div>{p.children}</div>,
  ProgressCircleValueText: () => null,
}));
vi.mock("@/components/dashboard/DashboardSkeleton", () => ({
  default: () => <div data-testid="dashboard-skeleton">Loading skeleton</div>,
}));
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (p: any) => <div data-testid="skeleton" {...p} />,
  SkeletonCircle: (p: any) => <div data-testid="skeleton-circle" {...p} />,
  SkeletonText: (p: any) => <div data-testid="skeleton-text" {...p} />,
}));

import Dashboard from "@/app/dashboard/page";

function createChainMock(defaultData: any = [], defaultError: any = null) {
  const result = { data: defaultData, error: defaultError };
  const promise: any = Promise.resolve(result);

  promise.select = vi.fn().mockReturnValue(promise);
  promise.insert = vi.fn().mockReturnValue(promise);
  promise.update = vi.fn().mockReturnValue(promise);
  promise.delete = vi.fn().mockReturnValue(promise);
  promise.upsert = vi.fn().mockReturnValue(promise);
  promise.eq = vi.fn().mockReturnValue(promise);
  promise.neq = vi.fn().mockReturnValue(promise);
  promise.in = vi.fn().mockReturnValue(promise);
  promise.order = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockReturnValue(promise);
  promise.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  promise.single = vi.fn().mockResolvedValue({ data: null, error: null });

  return promise;
}

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function setupHappyPath(overrides?: {
  profile?: Record<string, any>;
  major?: Record<string, any> | null;
  majors?: any[];
  plannedRows?: any[];
  blockRows?: any[];
  progressRows?: any[];
}) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "auth-uuid", email: "test@uwp.edu", user_metadata: {} } },
    error: null,
  });
  mockCheckOnboardingStatus.mockResolvedValue(true);
  mockSignOut.mockResolvedValue({ error: null });

  mockFetchStudentProfileByAuthUserId.mockResolvedValue({
    student_id: 1,
    auth_user_id: "auth-uuid",
    email: "test@uwp.edu",
    first_name: "Test",
    last_name: "Student",
    full_name: "Test Student",
    has_completed_onboarding: true,
    expected_graduation_semester: "Spring",
    expected_graduation_year: 2027,
    breadth_package_id: null,
    ...(overrides?.profile ?? {}),
  });

  mockFetchStudentMajorProgram.mockResolvedValue(
    overrides?.major === undefined
      ? {
          student_id: 1,
          program_id: 10,
          program_name: "Computer Science",
          catalog_year: 2025,
          program_type: "MAJOR",
        }
      : overrides.major
  );

  mockFetchStudentCourseProgress.mockResolvedValue(
    (overrides?.progressRows ?? [
      {
        student_id: 1,
        course_id: 241,
        completed: true,
        progress_status: "COMPLETED",
      },
    ]) as any
  );
  mockFetchRecentStudentActivity.mockResolvedValue(
    [
      {
        id: 1,
        student_id: 1,
        activity_type: "course_added",
        message: "Added CS 350 to a semester plan",
        metadata: {},
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ] as any
  );
  mockLogStudentActivity.mockResolvedValue(undefined);

  mockFetchPrograms.mockResolvedValue(overrides?.majors ?? []);
  mockGetOrCreateStudent.mockResolvedValue({ id: 1 });

  const plannedRows =
    overrides?.plannedRows ??
    [
      {
        student_id: 1,
        plan_id: 1,
        course_id: 350,
        status: "enrolled",
        subject: "CS",
        number: "350",
        title: "Algorithms",
        credits: 3,
      },
    ];

  const blockRows =
    overrides?.blockRows ??
    [
      {
        block_id: 1,
        block_name: "General Education",
        credits_required: 6,
        courses: [
          { course_id: 241, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
        ],
      },
      {
        block_id: 2,
        block_name: "Major Core",
        credits_required: 3,
        courses: [
          { course_id: 350, subject: "CS", number: "350", title: "Algorithms", credits: 3 },
        ],
      },
    ];

  mockFrom.mockImplementation((table: string) => {
    if (table === "v_plan_courses") {
      return createChainMock(plannedRows);
    }
    if (table === "v_program_block_courses") {
      return createChainMock(blockRows);
    }
    if (table === "student_programs") {
      return createChainMock();
    }
    return createChainMock();
  });
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("shows loading state initially", () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<Dashboard />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("redirects to /signin when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("renders dashboard with student data", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows onboarding banner when not completed", async () => {
    setupHappyPath({
      profile: {
        first_name: "New",
        last_name: "Student",
        full_name: "New Student",
        has_completed_onboarding: false,
        expected_graduation_semester: null,
        expected_graduation_year: null,
      },
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Complete Your Profile Setup").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders main dashboard sections", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Degree Requirements").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Recent Activity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows degree requirements section", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("General Education").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Major Core").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("/ 9")).toBeInTheDocument();
    });
  });

  it("shows recent activity section", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Added CS 350 to a semester plan/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows recent activity timestamps as past times", async () => {
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-04-20T12:00:00.000Z").getTime());

    mockFetchRecentStudentActivity.mockResolvedValue([
      {
        id: 1,
        student_id: 1,
        activity_type: "course_added",
        message: "Added CS 350 to a semester plan",
        metadata: {},
        created_at: "2026-04-20T10:00:00.000Z",
      },
    ] as any);

    try {
      await act(async () => {
        renderWithChakra(<Dashboard />);
      });

      await waitFor(() => {
        expect(screen.getByText("2 hours ago")).toBeInTheDocument();
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("navigates to course management when Add Course is clicked", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    const addCourseButton = await screen.findByRole("button", { name: /Add Course/i });

    await act(async () => {
      fireEvent.click(addCourseButton);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/courses");
  });

  it("navigates to planner when Plan Next Semester is clicked", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    const plannerButton = await screen.findByRole("button", { name: /Plan Next Semester/i });

    await act(async () => {
      fireEvent.click(plannerButton);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/planner");
  });

  it("navigates to requirements when Review Requirements is clicked", async () => {
    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    const requirementsButton = await screen.findByRole("button", { name: /Review Requirements/i });

    await act(async () => {
      fireEvent.click(requirementsButton);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/requirements");
  });

  it("renders waitlist and planned status badges for courses", async () => {
    setupHappyPath({
      plannedRows: [
        {
          student_id: 1,
          course_id: 350,
          status: "waitlist",
          subject: "CS",
          number: "350",
          title: "Algorithms",
          credits: 3,
        },
        {
          student_id: 1,
          course_id: 361,
          status: "planned",
          subject: "CS",
          number: "361",
          title: "Data Structures",
          credits: 3,
        },
        {
          student_id: 1,
          course_id: 400,
          status: "",
          subject: "CS",
          number: "400",
          title: "Capstone",
          credits: 3,
        },
      ],
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Waitlist").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Planned").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("creates a new student profile when none exists", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-uuid",
          email: "new@uwp.edu",
          user_metadata: { first_name: "New", last_name: "User" },
        },
      },
      error: null,
    });
    mockCheckOnboardingStatus.mockResolvedValue(false);
    mockFetchStudentProfileByAuthUserId.mockResolvedValue(null);
    mockGetOrCreateStudent.mockResolvedValue({ id: 99 });
    mockFetchStudentMajorProgram.mockResolvedValue(null);
    mockFetchStudentCourseProgress.mockResolvedValue([]);
    mockFetchPrograms.mockResolvedValue([]);
    mockFrom.mockImplementation(() => createChainMock([]));

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockGetOrCreateStudent).toHaveBeenCalledWith(
        "auth-uuid",
        "new@uwp.edu",
        "New User"
      );
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Profile restored" })
      );
    });
  });

  it("renders dashboard when major program is null", async () => {
    setupHappyPath({ major: null });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("No degree requirements yet")).toBeInTheDocument();
      expect(screen.getByText("Select a program to see required credits")).toBeInTheDocument();
    });
  });

  describe("Change Major", () => {
    it("shows Change Major card when majors are available", async () => {
      setupHappyPath({
        majors: [
          { id: 10, name: "Computer Science", program_type: "MAJOR" },
          { id: 20, name: "Data Science", program_type: "MAJOR" },
        ],
      });

      await act(async () => {
        renderWithChakra(<Dashboard />);
      });

      await waitFor(() => {
        expect(screen.getByText("Change Major")).toBeInTheDocument();
        expect(screen.getByText("Save Major")).toBeInTheDocument();
      });
    });

    it("Save Major button is disabled when same major is selected", async () => {
      setupHappyPath({
        majors: [{ id: 10, name: "Computer Science", program_type: "MAJOR" }],
      });

      await act(async () => {
        renderWithChakra(<Dashboard />);
      });

      await waitFor(() => {
        expect(screen.getByText("Change Major")).toBeInTheDocument();
      });

      expect(screen.getByText("Save Major")).toBeDisabled();
    });

    it("Save Major calls delete old major then insert new major", async () => {
      let deleteCalled = false;
      let insertPayload: any = null;

      setupHappyPath({
        majors: [
          { id: 10, name: "Computer Science", program_type: "MAJOR" },
          { id: 20, name: "Data Science", program_type: "MAJOR" },
        ],
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "v_plan_courses") {
          return createChainMock([
            {
              student_id: 1,
              course_id: 350,
              status: "enrolled",
              subject: "CS",
              number: "350",
              title: "Algorithms",
              credits: 3,
            },
          ]);
        }
        if (table === "v_program_block_courses") {
          return createChainMock([
            {
              block_id: 2,
              block_name: "Major Core",
              credits_required: 3,
              courses: [
                {
                  course_id: 350,
                  subject: "CS",
                  number: "350",
                  title: "Algorithms",
                  credits: 3,
                },
              ],
            },
          ]);
        }
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.delete = vi.fn(() => {
            deleteCalled = true;
            return chain;
          });
          chain.insert = vi.fn((payload: any) => {
            insertPayload = payload;
            return Promise.resolve({ data: null, error: null });
          });
          return chain;
        }
        return createChainMock();
      });

      await act(async () => {
        renderWithChakra(<Dashboard />);
      });

      await waitFor(() => {
        expect(screen.getByText("Change Major")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "20" } });
      });

      // Wait for the select state update to enable the Save button
      await waitFor(() => {
        expect(screen.getByText("Save Major")).not.toBeDisabled();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save Major"));
      });

      await waitFor(() => {
        expect(deleteCalled).toBe(true);
        expect(insertPayload).toMatchObject({ student_id: 1, program_id: 20 });
      });
    });

    it("hides Change Major card when no majors returned", async () => {
      setupHappyPath({ majors: [] });

      await act(async () => {
        renderWithChakra(<Dashboard />);
      });

      await waitFor(() => {
        expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.queryByText("Change Major")).not.toBeInTheDocument();
    });
  });
});
