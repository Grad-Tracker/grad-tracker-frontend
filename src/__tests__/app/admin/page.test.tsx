import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockRedirect,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import AdminDashboardPage from "@/app/admin/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeAssignments(programs: object[]) {
  return programs.map((p) => ({ programs: p }));
}

function makeProgram(overrides: object = {}) {
  return {
    id: "prog-1",
    name: "Computer Science",
    catalog_year: 2024,
    program_type: "MAJOR",
    program_requirement_blocks: [
      {
        id: "block-1",
        program_requirement_courses: [
          { course_id: "c1" },
          { course_id: "c2" },
        ],
      },
      {
        id: "block-2",
        program_requirement_courses: [{ course_id: "c3" }],
      },
    ],
    ...overrides,
  };
}

function setupMocks({
  user = { id: "user-1", user_metadata: { role: "advisor" } },
  advisor = { id: "adv-1", first_name: "Ada", last_name: "Lovelace" },
  assignments = makeAssignments([makeProgram()]),
}: {
  user?: object | null;
  advisor?: object | null;
  assignments?: object[];
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user } });

  // Chain: from("staff").select(...).eq(...).single()
  // Chain: from("program_advisors").select(...).eq(...)
  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // staff lookup
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: advisor }),
          }),
        }),
      };
    }
    // program_advisors lookup
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: assignments }),
      }),
    };
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /signin when unauthenticated", async () => {
    setupMocks({ user: null });
    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(mockRedirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects to /dashboard when user is not in staff table", async () => {
    setupMocks({ advisor: null });
    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("renders welcome message with advisor first name", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/welcome back, ada/i)).toBeInTheDocument();
  });

  it("renders program count in subtitle", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/1 program/i)).toBeInTheDocument();
  });

  it("renders program name and catalog year", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("renders correct block count", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/2 blocks/i)).toBeInTheDocument();
  });

  it("renders correct course count", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/3 courses/i)).toBeInTheDocument();
  });

  it("renders program card link to detail page", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByRole("link", { name: /computer science/i })).toHaveAttribute(
      "href",
      "/admin/programs/prog-1"
    );
  });

  it("renders the stat tiles for each program type", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    // Each type label appears at least once (stat tile + optional section heading)
    expect(screen.getAllByText("Majors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Minors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Certificates").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Graduates").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when advisor has no programs", async () => {
    setupMocks({ assignments: [] });
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/no programs assigned yet/i)).toBeInTheDocument();
  });

  it("groups programs by type — shows section heading for MINOR", async () => {
    setupMocks({
      assignments: makeAssignments([
        makeProgram({ id: "p1", name: "CS Major", program_type: "MAJOR" }),
        makeProgram({ id: "p2", name: "Math Minor", program_type: "MINOR" }),
      ]),
    });
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getAllByText("Majors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Minors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CS Major")).toBeInTheDocument();
    expect(screen.getByText("Math Minor")).toBeInTheDocument();
  });

  it("handles programs with no requirement blocks gracefully", async () => {
    setupMocks({
      assignments: makeAssignments([
        makeProgram({ program_requirement_blocks: [] }),
      ]),
    });
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByText(/0 blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/0 courses/i)).toBeInTheDocument();
  });

  it("renders singular 'program' when count is 1", async () => {
    setupMocks();
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByText(/1 program\b/i)).toBeInTheDocument();
  });

  it("renders plural 'programs' when count > 1", async () => {
    setupMocks({
      assignments: makeAssignments([
        makeProgram({ id: "p1", name: "CS" }),
        makeProgram({ id: "p2", name: "Math", program_type: "MINOR" }),
      ]),
    });
    const page = await AdminDashboardPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByText(/2 programs/i)).toBeInTheDocument();
  });
});
