/**
 * RequirementsDashboard tests
 *
 * The requirements dashboard is implemented as GenEdRequirements, a client
 * component rendered by the /dashboard/requirements page. These tests exercise
 * that component end-to-end, mocking the Supabase client.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// evaluatePrereqsForCourses uses @/lib/supabase/client (different from the component's client).
// Mock it to avoid real Supabase calls when course IDs are present.
vi.mock("@/lib/prereq", () => ({
  evaluatePrereqsForCourses: vi.fn().mockResolvedValue(new Map()),
}));

import GenEdRequirements from "@/components/requirements/GenEdRequirements";

// ── Chain helper ─────────────────────────────────────────────────────────────

function createChainMock() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation((resolve: any) =>
    resolve({ data: [], error: null })
  );
  return chain;
}

/** Set up a full mock that resolves with buckets, no mappings, no history. */
function setupMockWithBuckets(buckets: any[]) {
  mockFrom.mockImplementation((table: string) => {
    const chain = createChainMock();
    if (table === "gen_ed_buckets") {
      chain.order = vi.fn().mockResolvedValue({ data: buckets, error: null });
    } else if (table === "gen_ed_bucket_courses") {
      chain.then = vi.fn().mockImplementation((resolve: any) =>
        resolve({ data: [], error: null })
      );
    } else if (table === "student_course_history") {
      chain.eq = vi.fn().mockResolvedValue({ data: [], error: null });
    }
    return chain;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RequirementsDashboard (GenEdRequirements)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching data", () => {
    mockFrom.mockImplementation(() => {
      const chain = createChainMock();
      // Never resolves — holds the component in loading state
      chain.order = vi.fn().mockReturnValue({ then: () => new Promise(() => {}) });
      chain.then = vi.fn().mockReturnValue(new Promise(() => {}));
      return chain;
    });

    renderWithChakra(<GenEdRequirements studentId={1} />);
    expect(
      screen.getAllByText(/Loading Gen Ed requirements/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the Gen Ed Requirements heading after data loads", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Gen Ed Requirements").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders bucket names when data is loaded", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
      { id: 2, code: "NS", name: "Natural Sciences", credits_required: 7 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Humanities").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Natural Sciences").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders bucket codes as badges", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("HU").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows credit progress text for each bucket", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      // Shows "Completed 0 / 6 credits · Remaining 6"
      expect(screen.getAllByText(/Remaining/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'In progress' badge for incomplete buckets", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("In progress").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'Done' badge when bucket is fully completed", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 3 },
    ];
    const bucketCourses = [{ bucket_id: 1, course_id: 100 }];
    const courses = [
      { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
    ];
    const history = [{ course_id: 100, grade: "A", completed: true }];

    mockFrom.mockImplementation((table: string) => {
      const chain = createChainMock();
      if (table === "gen_ed_buckets") {
        chain.order = vi.fn().mockResolvedValue({ data: buckets, error: null });
      } else if (table === "gen_ed_bucket_courses") {
        chain.then = vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: bucketCourses, error: null })
        );
      } else if (table === "student_course_history") {
        chain.eq = vi.fn().mockResolvedValue({ data: history, error: null });
      } else if (table === "courses") {
        chain.in = vi.fn().mockResolvedValue({ data: courses, error: null });
      }
      return chain;
    });

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Done").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error message when bucket fetch fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = createChainMock();
      if (table === "gen_ed_buckets") {
        chain.order = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "DB connection error" },
        });
      }
      return chain;
    });

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Error loading buckets/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders course details within a bucket", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];
    const bucketCourses = [{ bucket_id: 1, course_id: 100 }];
    const courses = [
      { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
    ];
    // Completed history so the course shows in the visible "Completed" section (not collapsed "remaining")
    const history = [{ course_id: 100, grade: "A", completed: true }];

    mockFrom.mockImplementation((table: string) => {
      const chain = createChainMock();
      if (table === "gen_ed_buckets") {
        chain.order = vi.fn().mockResolvedValue({ data: buckets, error: null });
      } else if (table === "gen_ed_bucket_courses") {
        chain.then = vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: bucketCourses, error: null })
        );
      } else if (table === "student_course_history") {
        chain.eq = vi.fn().mockResolvedValue({ data: history, error: null });
      } else if (table === "courses") {
        chain.in = vi.fn().mockResolvedValue({ data: courses, error: null });
      }
      return chain;
    });

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/ENGL 101/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No courses found' when a bucket has no mapped courses", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/No courses found for this bucket/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders multiple buckets", async () => {
    setupMockWithBuckets([
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
      { id: 2, code: "NS", name: "Natural Sciences", credits_required: 7 },
      { id: 3, code: "SS", name: "Social Sciences", credits_required: 6 },
    ]);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Humanities").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Natural Sciences").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Social Sciences").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows completed course in the Completed section", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];
    const bucketCourses = [{ bucket_id: 1, course_id: 100 }];
    const courses = [
      { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
    ];
    const history = [{ course_id: 100, grade: "A", completed: true }];

    mockFrom.mockImplementation((table: string) => {
      const chain = createChainMock();
      if (table === "gen_ed_buckets") {
        chain.order = vi.fn().mockResolvedValue({ data: buckets, error: null });
      } else if (table === "gen_ed_bucket_courses") {
        chain.then = vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: bucketCourses, error: null })
        );
      } else if (table === "student_course_history") {
        chain.eq = vi.fn().mockResolvedValue({ data: history, error: null });
      } else if (table === "courses") {
        chain.in = vi.fn().mockResolvedValue({ data: courses, error: null });
      }
      return chain;
    });

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      // Completed section heading appears when there are completed courses
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    });
  });
});
