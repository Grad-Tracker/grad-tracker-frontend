import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// Mocks — use vi.hoisted to avoid hoisting issues
const {
  mockPush,
  mockReplace,
  mockRefresh,
  mockGetUser,
  mockSignOut,
  mockFrom,
  mockCheckOnboardingStatus,
  mockGetOrCreateStudent,
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
  mockToasterCreate: vi.fn(),
}));

// Stable router reference prevents infinite useEffect re-runs
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
}));
vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: (...args: any[]) => mockToasterCreate(...args), success: vi.fn(), error: vi.fn() },
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

import Dashboard from "@/app/dashboard/page";

function createChainMock(defaultData: any = [], defaultError: any = null) {
  // Use a real Promise so `await chain` works natively
  const result = { data: defaultData, error: defaultError };
  const promise: any = Promise.resolve(result);

  // Bolt chainable methods onto the real promise
  promise.select = vi.fn().mockReturnValue(promise);
  promise.insert = vi.fn().mockReturnValue(promise);
  promise.update = vi.fn().mockReturnValue(promise);
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

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockGetOrCreateStudent.mockResolvedValue({ id: 1 });
    mockCheckOnboardingStatus.mockResolvedValue(true);
  });

  it("shows loading state initially", () => {
    // getUser never resolves
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<Dashboard />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("redirects to /signin when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockFrom.mockImplementation(() => createChainMock());

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("renders dashboard with student data", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }
      if (table === "student_programs") {
        return createChainMock([{ program_id: 10 }]);
      }
      if (table === "programs") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 10, name: "Computer Science" },
          error: null,
        });
        return chain;
      }
      return createChainMock();
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
    });
  });

  function setupStudentMock(studentOverrides: Record<string, any> = {}) {
    const studentData = {
      id: 1,
      first_name: "Test",
      last_name: "Student",
      email: "test@uwp.edu",
      has_completed_onboarding: true,
      expected_graduation_semester: "Spring",
      expected_graduation_year: 2027,
      ...studentOverrides,
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: studentData, error: null });
        return chain;
      }
      return createChainMock();
    });
  }

  it("shows onboarding banner when not completed", async () => {
    setupStudentMock({
      first_name: "New",
      last_name: "Student",
      email: "new@uwp.edu",
      has_completed_onboarding: false,
      expected_graduation_semester: null,
      expected_graduation_year: null,
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Complete Your Profile Setup").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows degree requirements section", async () => {
    setupStudentMock();

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Degree Requirements").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("General Education").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Major Core").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows recent activity section", async () => {
    setupStudentMock();

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Recent Activity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Added CS 350/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------
  // NEW TESTS: coverage boosters
  // ----------------------------

  it("falls back to legacy student schema when new schema columns are missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-legacy", email: "legacy@uwp.edu" } },
      error: null,
    });

    let studentsCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        studentsCall++;
        const chain = createChainMock();

        if (studentsCall === 1) {
          // Trigger legacy fallback: error message includes "column"
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: { message: "column expected_graduation_semester does not exist" },
          });
        } else {
          // Legacy select returns row with `name` + expected_graduation_term
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: {
              id: 1,
              name: "Legacy User",
              email: "legacy@uwp.edu",
              has_completed_onboarding: true,
              expected_graduation_term: "Fall",
              expected_graduation_year: 2026,
            },
            error: null,
          });
        }
        return chain;
      }
      return createChainMock();
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Legacy User").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("signs out and redirects when student profile query returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-err", email: "err@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "DB is down" }, // not a missing column error
        });
        return chain;
      }
      return createChainMock();
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Profile not found", type: "error" })
      );
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("recreates missing student profile and shows onboarding banner (Profile restored path)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-missing",
          email: "newperson@uwp.edu",
          user_metadata: { first_name: "New", last_name: "Person" },
        },
      },
      error: null,
    });

    mockGetOrCreateStudent.mockResolvedValueOnce({ id: 55 });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); // missing row
        return chain;
      }
      // Everything else empty so we hit "no major / no courses" branches too
      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Profile restored", type: "info" })
      );
      // Name comes from user metadata in recreated row
      expect(screen.getAllByText("New Person").length).toBeGreaterThanOrEqual(1);
      // Onboarding banner should show (has_completed_onboarding false)
      expect(screen.getAllByText("Complete Your Profile Setup").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("uses default requirements when no major program is found", async () => {
    // student exists but has no student_programs major
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }
      if (table === "student_programs") {
        return createChainMock([]); // no programs => majorProgramId null
      }
      if (table === "student_course_history") {
        return createChainMock([]); // completed none
      }
      if (table === "student_planned_courses") {
        return createChainMock([]); // planned none
      }
      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Degree Requirements").length).toBeGreaterThanOrEqual(1);
      // defaults are 0/0 credits
      expect(screen.getAllByText("0/0 credits").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("computes requirement credit totals when major blocks exist", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }

      if (table === "student_programs") {
        return createChainMock([{ program_id: 10 }]);
      }

      if (table === "programs") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 10, name: "Computer Science" },
          error: null,
        });
        return chain;
      }

      if (table === "student_course_history") {
        // Completed includes course 101 only (3 credits)
        return createChainMock([
          { course_id: 101, courses: { credits: 3 } },
        ]);
      }

      if (table === "program_requirement_blocks") {
        // Create blocks that land in "General Education" and "Major Core"
        return createChainMock([
          {
            id: 1,
            name: "General Education",
            credits_required: 6,
            program_requirement_courses: [
              { course_id: 101, courses: { credits: 3 } },
              { course_id: 999, courses: { credits: 3 } },
            ],
          },
          {
            id: 2,
            name: "Core Requirements",
            credits_required: 3,
            program_requirement_courses: [
              { course_id: 101, courses: { credits: 3 } },
            ],
          },
        ]);
      }

      if (table === "student_planned_courses") {
        return createChainMock([]);
      }

      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      // We should see computed credits text (not "Loading...")
      expect(screen.getAllByText("3/6 credits").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("3/3 credits").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("falls back to default requirements when blocks query returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }

      if (table === "student_programs") {
        return createChainMock([{ program_id: 10 }]);
      }

      if (table === "programs") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 10, name: "Computer Science" },
          error: null,
        });
        return chain;
      }

      if (table === "program_requirement_blocks") {
        return createChainMock(null, { message: "blocks error" });
      }

      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("0/0 credits").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders current semester courses with status badges and progress credits", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }

      if (table === "student_programs") return createChainMock([]); // don't care for this test
      if (table === "program_requirement_blocks") return createChainMock([]); // no blocks

      if (table === "student_course_history") {
        return createChainMock([
          { course_id: 101, courses: { credits: 3 } },
          { course_id: 102, courses: { credits: 3 } },
        ]);
      }

      if (table === "student_planned_courses") {
        return createChainMock([
          {
            status: "enrolled",
            courses: { subject: "CS", number: "101", title: "Intro", credits: 3 },
          },
          {
            status: "waitlist",
            courses: { subject: "CS", number: "222", title: "Systems", credits: 4 },
          },
          {
            status: "planned",
            courses: { subject: "MATH", number: "200", title: "Discrete", credits: 3 },
          },
        ]);
      }

      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      // course codes
      expect(screen.getAllByText("CS 101").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("CS 222").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("MATH 200").length).toBeGreaterThanOrEqual(1);

      // status badges
      expect(screen.getAllByText("Enrolled").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Waitlist").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Planned").length).toBeGreaterThanOrEqual(1);

      // in progress credits should appear (enrolled 3 + waitlist 4 = 7)
      expect(screen.getAllByText("In Progress").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No courses planned yet' when planned courses are empty", async () => {
    setupStudentMock();

    // override planned courses query to return empty
    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1,
            first_name: "Test",
            last_name: "Student",
            email: "test@uwp.edu",
            has_completed_onboarding: true,
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
          },
          error: null,
        });
        return chain;
      }
      if (table === "student_planned_courses") return createChainMock([]);
      if (table === "student_course_history") return createChainMock([]);
      if (table === "student_programs") return createChainMock([]);
      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("No courses planned yet").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders Quick Actions section", async () => {
    setupStudentMock();

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Generate Progress Report").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Plan Next Semester").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Review Requirements").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows session reset toast and redirects when an unexpected error is thrown", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        throw new Error("boom");
      }
      return createChainMock([]);
    });

    await act(async () => {
      renderWithChakra(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Session reset required", type: "error" })
      );
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });
});