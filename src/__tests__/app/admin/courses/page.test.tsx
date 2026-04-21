import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const { mockFrom, mockSelect, mockOrder1, mockOrder2 } = vi.hoisted(() => {
  const mockOrder2 = vi.fn(); // second .order("number") — awaited
  const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 }); // first .order("subject")
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  return { mockFrom, mockSelect, mockOrder1, mockOrder2 };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: mockFrom,
  }),
}));

// Mock CoursesAdminClient to avoid rendering the full client tree
vi.mock("@/app/admin/(protected)/courses/CoursesAdminClient", () => ({
  default: ({ initialCourses, subjects }: { initialCourses: unknown[]; subjects: string[] }) => (
    <div data-testid="courses-admin-client">
      <span data-testid="course-count">{initialCourses.length}</span>
      <span data-testid="subject-count">{subjects.length}</span>
    </div>
  ),
}));

import AdminCoursesPage from "@/app/admin/(protected)/courses/page";

// ── tests ─────────────────────────────────────────────────────────────────────

describe("AdminCoursesPage (server component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: chain resolves to empty on second order()
    mockOrder2.mockResolvedValue({ data: [], error: null });
    mockOrder1.mockReturnValue({ order: mockOrder2 });
    mockSelect.mockReturnValue({ order: mockOrder1 });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it("renders CoursesAdminClient", async () => {
    const page = await AdminCoursesPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByTestId("courses-admin-client")).toBeInTheDocument();
  });

  it("passes empty arrays when query returns null", async () => {
    mockOrder2.mockResolvedValue({ data: null, error: null });
    const page = await AdminCoursesPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByTestId("course-count").textContent).toBe("0");
    expect(screen.getByTestId("subject-count").textContent).toBe("0");
  });

  it("passes course rows to client component", async () => {
    const courses = [
      { id: 1, subject: "CS", number: "101", title: "Intro", credits: 3, description: null, prereq_text: null, is_active: true },
      { id: 2, subject: "MATH", number: "221", title: "Calc", credits: 4, description: null, prereq_text: null, is_active: true },
    ];
    mockOrder2.mockResolvedValue({ data: courses, error: null });

    const page = await AdminCoursesPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByTestId("course-count").textContent).toBe("2");
  });

  it("deduplicates and sorts subjects", async () => {
    const courses = [
      { id: 1, subject: "MATH", number: "101", title: "A", credits: 3, description: null, prereq_text: null, is_active: true },
      { id: 2, subject: "CS", number: "101", title: "B", credits: 3, description: null, prereq_text: null, is_active: true },
      { id: 3, subject: "CS", number: "201", title: "C", credits: 3, description: null, prereq_text: null, is_active: true },
    ];
    mockOrder2.mockResolvedValue({ data: courses, error: null });

    const page = await AdminCoursesPage();
    renderWithChakra(page as React.ReactElement);
    // 3 courses but only 2 distinct subjects
    expect(screen.getByTestId("subject-count").textContent).toBe("2");
  });

  it("handles query error gracefully (passes empty courses)", async () => {
    mockOrder2.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const page = await AdminCoursesPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByTestId("course-count").textContent).toBe("0");
  });
});
