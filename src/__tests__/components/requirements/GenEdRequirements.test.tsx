import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const mockFrom = vi.fn();

vi.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/prereq", () => ({
  evaluatePrereqsForCourses: vi.fn(async () => new Map()),
}));

import GenEdRequirements from "@/components/requirements/GenEdRequirements";

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

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("GenEdRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockFrom.mockImplementation(() => {
      const chain = createChainMock();
      chain.order = vi.fn().mockReturnValue({
        then: () => new Promise(() => {}),
      });
      chain.then = vi.fn().mockReturnValue(new Promise(() => {}));
      return chain;
    });

    renderWithChakra(<GenEdRequirements studentId={1} />);
    expect(
      screen.getAllByText(/Loading Gen Ed requirements/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders bucket names after data loads", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
      { id: 2, code: "NS", name: "Natural Sciences", credits_required: 7 },
    ];

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

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Humanities").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Natural Sciences").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error when fetch fails", async () => {
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

  it("renders Gen Ed Requirements heading", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];

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

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Gen Ed Requirements").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows bucket codes as badges", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];

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

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("HU").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows credit progress text", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];

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

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      // Shows "Completed 0 / 6 credits · Remaining 6"
      expect(screen.getAllByText(/Remaining/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows In progress badge for incomplete buckets", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];

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

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("In progress").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows courses in bucket section", async () => {
    const buckets = [
      { id: 1, code: "HU", name: "Humanities", credits_required: 6 },
    ];
    const bucketCourses = [
      { bucket_id: 1, course_id: 100 },
    ];
    const courses = [
      { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
    ];

    mockFrom.mockImplementation((table: string) => {
      const chain = createChainMock();
      if (table === "gen_ed_buckets") {
        chain.order = vi.fn().mockResolvedValue({ data: buckets, error: null });
      } else if (table === "gen_ed_bucket_courses") {
        chain.then = vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: bucketCourses, error: null })
        );
      } else if (table === "student_course_history") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [{ course_id: 100, grade: "A", completed: true }],
          error: null,
        });
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
});
