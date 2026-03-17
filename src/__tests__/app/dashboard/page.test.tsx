import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
  mockFetchPrograms,
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
  fetchPrograms: (...args: any[]) => mockFetchPrograms(...args),
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

import Dashboard from "@/app/dashboard/page";

function createChainMock(defaultData: any = [], defaultError: any = null) {
  // Use a real Promise so `await chain` works natively
  const result = { data: defaultData, error: defaultError };
  const promise: any = Promise.resolve(result);

  // Bolt chainable methods onto the real promise
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

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockGetOrCreateStudent.mockResolvedValue({ id: 1 });
    mockFetchPrograms.mockResolvedValue([]);
    mockToasterCreate.mockReset();
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

  it("renders student profile and quick actions after sign-in", async () => {
    // Sign Out lives in DashboardSidebar (layout), not in this page component.
    // Verify the page renders key authenticated content instead.
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders main dashboard sections", async () => {
    // Sidebar nav (Courses, Planner, etc.) is rendered by DashboardLayout, not this page.
    // Verify page-level sections that ARE rendered here.
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Degree Requirements").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Recent Activity").length).toBeGreaterThanOrEqual(1);
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

  /* ---- Reset Progress Quick Action ---- */

  describe("Reset Progress Quick Action", () => {
    it("hides Reset All Progress when has_completed_onboarding is false", async () => {
      setupStudentMock({ has_completed_onboarding: false });

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.queryByText("Reset All Progress")).not.toBeInTheDocument();
      });
    });

    it("renders Quick Actions buttons for onboarded students", async () => {
      setupStudentMock({ has_completed_onboarding: true });

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Generate Progress Report")).toBeInTheDocument();
        expect(screen.getByText("Plan Next Semester")).toBeInTheDocument();
        expect(screen.getByText("Review Requirements")).toBeInTheDocument();
      });
    });

    it("renders Quick Actions section for non-onboarded students too", async () => {
      setupStudentMock({ has_completed_onboarding: false });

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("does not render Reset All Progress button (feature removed)", async () => {
      setupStudentMock({ has_completed_onboarding: true });

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getAllByText("Quick Actions").length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.queryByText("Reset All Progress")).not.toBeInTheDocument();
    });
  });

  /* ---- Change Major ---- */

  describe("Change Major", () => {
    function setupChangeMajorMocks(
      majors: any[] = [
        { id: 10, name: "Computer Science", program_type: "MAJOR" },
        { id: 20, name: "Data Science", program_type: "MAJOR" },
      ],
      currentMajorId: number | null = null
    ) {
      mockFetchPrograms.mockResolvedValue(majors);
      mockGetUser.mockResolvedValue({
        data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
        error: null,
      });
      mockCheckOnboardingStatus.mockResolvedValue(true);

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: {
              id: 1,
              first_name: "Test",
              last_name: "Student",
              email: "t@u.edu",
              has_completed_onboarding: true,
              expected_graduation_semester: "Spring",
              expected_graduation_year: 2027,
            },
            error: null,
          });
          return chain;
        }
        if (table === "student_programs") {
          return createChainMock(currentMajorId ? [{ program_id: currentMajorId }] : []);
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: currentMajorId ? { id: currentMajorId, name: "Computer Science" } : null,
            error: null,
          });
          return chain;
        }
        return createChainMock();
      });
    }

    it("shows Change Major card when fetchPrograms returns majors", async () => {
      setupChangeMajorMocks();

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getByText("Change Major")).toBeInTheDocument();
      });
    });

    it("renders major options in the Change Major dropdown", async () => {
      setupChangeMajorMocks();

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getByText("Computer Science")).toBeInTheDocument();
        expect(screen.getByText("Data Science")).toBeInTheDocument();
      });
    });

    it("Save Major button is disabled when same major is already selected", async () => {
      setupChangeMajorMocks(
        [{ id: 10, name: "Computer Science", program_type: "MAJOR" }],
        10
      );

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getByText("Change Major")).toBeInTheDocument();
      });

      expect(screen.getByText("Save Major")).toBeDisabled();
    });

    it("Save Major calls delete on old major and insert for new major", async () => {
      let insertCalledWith: any = null;
      let deleteCalled = false;

      mockFetchPrograms.mockResolvedValue([
        { id: 10, name: "Computer Science", program_type: "MAJOR" },
        { id: 20, name: "Data Science", program_type: "MAJOR" },
      ]);
      mockGetUser.mockResolvedValue({
        data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
        error: null,
      });
      mockCheckOnboardingStatus.mockResolvedValue(true);

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: {
              id: 1,
              first_name: "Test",
              last_name: "Student",
              email: "t@u.edu",
              has_completed_onboarding: true,
              expected_graduation_semester: "Spring",
              expected_graduation_year: 2027,
            },
            error: null,
          });
          return chain;
        }
        if (table === "student_programs") {
          const chain = createChainMock([{ program_id: 10 }]);
          chain.delete = vi.fn(() => {
            deleteCalled = true;
            return chain;
          });
          chain.insert = vi.fn((payload: any) => {
            insertCalledWith = payload;
            return Promise.resolve({ data: null, error: null });
          });
          return chain;
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

      await act(async () => { renderWithChakra(<Dashboard />); });
      await waitFor(() => screen.getByText("Change Major"));

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "20" } });
      });

      const saveMajorBtn = screen.getByText("Save Major");
      expect(saveMajorBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(saveMajorBtn);
      });

      await waitFor(() => {
        expect(deleteCalled).toBe(true);
        expect(insertCalledWith).toMatchObject({ program_id: 20, student_id: 1 });
      });
    });

    it("hides Change Major card when fetchPrograms returns empty array", async () => {
      setupChangeMajorMocks([]);

      await act(async () => { renderWithChakra(<Dashboard />); });

      await waitFor(() => {
        expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.queryByText("Change Major")).not.toBeInTheDocument();
    });
  });
});
