import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

import GenEdRequirements from "@/components/requirements/GenEdRequirements";
import {
  fetchGenEdBucketsWithCourses,
  fetchStudentCourseProgress,
} from "@/lib/supabase/queries/planner";

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchGenEdBucketsWithCourses: vi.fn(),
  fetchStudentCourseProgress: vi.fn(),
}));

vi.mock("@/lib/prereq", () => ({
  evaluatePrereqsForCourses: vi.fn(async () => new Map()),
}));

const mockFetchGenEdBucketsWithCourses = vi.mocked(fetchGenEdBucketsWithCourses);
const mockFetchStudentCourseProgress = vi.mocked(fetchStudentCourseProgress);

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function setupDefaultData() {
  mockFetchGenEdBucketsWithCourses.mockResolvedValue([
    {
      id: 1,
      code: "HU",
      name: "Humanities",
      credits_required: 6,
      courses: [
        { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
        { id: 101, subject: "HIST", number: "201", title: "World History", credits: 3 },
      ],
    },
    {
      id: 2,
      code: "NS",
      name: "Natural Sciences",
      credits_required: 7,
      courses: [
        { id: 300, subject: "BIOL", number: "101", title: "General Biology", credits: 4 },
      ],
    },
  ] as any);

  mockFetchStudentCourseProgress.mockResolvedValue([
    {
      student_id: 1,
      course_id: 100,
      completed: true,
      progress_status: "COMPLETED",
    },
  ] as any);
}

describe("GenEdRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultData();
  });

  it("shows skeleton loading state", () => {
    mockFetchGenEdBucketsWithCourses.mockReturnValue(new Promise(() => {}) as any);

    renderWithChakra(<GenEdRequirements studentId={1} />);
    expect(screen.getByTestId("gen-ed-skeleton")).toBeInTheDocument();
  });

  it("renders bucket names after data loads", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Humanities").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Natural Sciences").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error when fetch fails", async () => {
    mockFetchGenEdBucketsWithCourses.mockRejectedValueOnce(
      new Error("Error loading buckets")
    );

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
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("HU").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows credit progress text", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Remaining/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows In progress badge for incomplete buckets", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("In progress").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows courses in bucket section", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("English Comp").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'Show remaining' toggle for uncompleted courses in a bucket", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Show remaining/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("toggles remaining courses visibility when 'Show remaining' is clicked", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Show remaining/).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryAllByText("General Biology").length).toBe(0);

    const toggles = screen.getAllByText(/Show remaining/);
    await act(async () => {
      for (const toggle of toggles) {
        fireEvent.click(toggle);
      }
    });

    await waitFor(() => {
      expect(screen.getAllByText("Hide remaining").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("General Biology").length).toBeGreaterThanOrEqual(1);
    });

    const hideToggle = screen.getAllByText("Hide remaining")[0];
    await act(async () => {
      fireEvent.click(hideToggle);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Show remaining/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'Completed' section heading when courses are completed", async () => {
    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'Done' badge when bucket credits are fully met", async () => {
    mockFetchGenEdBucketsWithCourses.mockResolvedValueOnce([
      {
        id: 1,
        code: "HU",
        name: "Humanities",
        credits_required: 3,
        courses: [
          { id: 100, subject: "ENGL", number: "101", title: "English Comp", credits: 3 },
        ],
      },
    ] as any);
    mockFetchStudentCourseProgress.mockResolvedValueOnce([
      {
        student_id: 1,
        course_id: 100,
        completed: true,
        progress_status: "COMPLETED",
      },
    ] as any);

    await act(async () => {
      renderWithChakra(<GenEdRequirements studentId={1} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Done").length).toBeGreaterThanOrEqual(1);
    });
  });
});
