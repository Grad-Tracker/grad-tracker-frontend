import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// Mocks — use vi.hoisted to avoid hoisting issues
const { mockPush, mockReplace, mockRefresh, mockGetUser, mockSignOut, mockFrom, mockCheckOnboardingStatus } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockCheckOnboardingStatus: vi.fn(),
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
}));
vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
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
  });

  it("shows loading state initially", () => {
    // getUser never resolves
    mockGetUser.mockReturnValue(new Promise(() => {}));
    mockCheckOnboardingStatus.mockResolvedValue(true);
    renderWithChakra(<Dashboard />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("redirects to /signin when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCheckOnboardingStatus.mockResolvedValue(false);
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
    mockCheckOnboardingStatus.mockResolvedValue(true);

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 1, name: "Test Student", email: "test@uwp.edu",
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
      id: 1, name: "Test Student", email: "test@uwp.edu",
      has_completed_onboarding: true,
      expected_graduation_semester: "Spring",
      expected_graduation_year: 2027,
      ...studentOverrides,
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });
    mockCheckOnboardingStatus.mockResolvedValue(!!studentData.has_completed_onboarding);

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: studentData, error: null });
        return chain;
      }
      // All other tables return empty data
      return createChainMock();
    });
  }

  it("shows onboarding banner when not completed", async () => {
    setupStudentMock({ name: "New Student", email: "new@uwp.edu", has_completed_onboarding: false, expected_graduation_semester: null, expected_graduation_year: null });

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Complete Your Profile Setup").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls signOut and redirects on Sign Out click", async () => {
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Test Student").length).toBeGreaterThanOrEqual(1);
    });

    const signOutElements = screen.getAllByText("Sign Out");
    await act(async () => { fireEvent.click(signOutElements[0]); });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("renders sidebar navigation links", async () => {
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Courses").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Planner").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows degree requirements section", async () => {
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Degree Requirements").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("General Education").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Major Core").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows recent activity section", async () => {
    setupStudentMock();

    await act(async () => { renderWithChakra(<Dashboard />); });

    await waitFor(() => {
      expect(screen.getAllByText("Recent Activity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Added CS 350/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
