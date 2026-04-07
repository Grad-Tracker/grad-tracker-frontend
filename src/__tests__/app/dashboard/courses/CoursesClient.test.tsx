import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import CoursesClient from "@/app/dashboard/courses/CoursesClient";
import type { Course } from "@/types/course";

const {
  mockPush,
  mockGetUser,
  mockFrom,
  mockFetchPlans,
  mockCreatePlan,
  mockFetchPlannedCourses,
  mockFetchStudentTerms,
  mockGetOrCreateTerm,
  mockAddTermPlan,
  mockAddPlannedCourse,
  mockToasterCreate,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockFetchPlans: vi.fn(),
  mockCreatePlan: vi.fn(),
  mockFetchPlannedCourses: vi.fn(),
  mockFetchStudentTerms: vi.fn(),
  mockGetOrCreateTerm: vi.fn(),
  mockAddTermPlan: vi.fn(),
  mockAddPlannedCourse: vi.fn(),
  mockToasterCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next/link", () => ({
  default: (p: any) => <a href={p.href}>{p.children}</a>,
}));
vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => null,
}));
vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: mockToasterCreate },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));
vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchPlans: (...args: any[]) => mockFetchPlans(...args),
  createPlan: (...args: any[]) => mockCreatePlan(...args),
  fetchPlannedCourses: (...args: any[]) => mockFetchPlannedCourses(...args),
  fetchStudentTerms: (...args: any[]) => mockFetchStudentTerms(...args),
  getOrCreateTerm: (...args: any[]) => mockGetOrCreateTerm(...args),
  addTermPlan: (...args: any[]) => mockAddTermPlan(...args),
  addPlannedCourse: (...args: any[]) => mockAddPlannedCourse(...args),
}));

function findClickableAncestor(element: HTMLElement | null): HTMLElement {
  return (
    element?.closest("button") ??
    element?.closest("[role='button']") ??
    element ??
    document.body
  ) as HTMLElement;
}

const mockCourses: Course[] = [
  { id: 1, subject: "CS", number: "101", title: "Intro to Computer Science", credits: 3, description: "An introductory course.", prereq_text: null },
  { id: 2, subject: "CS", number: "201", title: "Data Structures", credits: 3, description: "Learn about data structures.", prereq_text: "CS 101" },
  { id: 3, subject: "MATH", number: "221", title: "Calculus I", credits: 4, description: null, prereq_text: null },
  { id: 4, subject: "CS", number: "550", title: "Graduate Algorithms", credits: 3, description: "Advanced algorithms.", prereq_text: "CS 201" },
  { id: 5, subject: "ENGL", number: "101", title: "English Composition", credits: 3, description: "Writing course.", prereq_text: null },
];

const mockSubjects = ["CS", "MATH", "ENGL"];

describe("CoursesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      const promise: any = Promise.resolve({
        data: table === "v_student_profile" ? { student_id: 1 } : [],
        error: null,
      });
      promise.select = vi.fn().mockReturnValue(promise);
      promise.eq = vi.fn().mockReturnValue(promise);
      promise.maybeSingle = vi.fn().mockResolvedValue({
        data: table === "v_student_profile" ? { student_id: 1 } : null,
        error: null,
      });
      return promise;
    });
    mockFetchPlans.mockResolvedValue([{ id: 10, name: "My Plan", student_id: 1 }]);
    mockCreatePlan.mockResolvedValue({ id: 10, name: "My Plan", student_id: 1 });
    mockFetchPlannedCourses.mockResolvedValue([]);
    mockFetchStudentTerms.mockResolvedValue([{ id: 20, season: "Spring", year: 2026 }]);
    mockGetOrCreateTerm.mockResolvedValue({ id: 20, season: "Spring", year: 2026 });
    mockAddTermPlan.mockResolvedValue(undefined);
    mockAddPlannedCourse.mockResolvedValue(undefined);
  });

  it("renders course catalog header", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("All Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Course Catalog").length).toBeGreaterThanOrEqual(1);
  });

  it("renders undergraduate tab as default", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText(/Undergraduate/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders course cards for undergraduate courses", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("CS 101").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CS 201").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MATH 221").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ENGL 101").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("CS 550").length).toBe(0);
  });

  it("renders course titles", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("Intro to Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Data Structures").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Calculus I").length).toBeGreaterThanOrEqual(1);
  });

  it("renders credit badges", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("3 cr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4 cr").length).toBeGreaterThanOrEqual(1);
  });

  it("filters courses by search text", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const searchInput = screen.getByPlaceholderText("Search courses by code or title...");
    fireEvent.change(searchInput, { target: { value: "Data Structures" } });
    await waitFor(() => {
      expect(screen.getAllByText("CS 201").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText("CS 101").length).toBe(0);
      expect(screen.queryAllByText("MATH 221").length).toBe(0);
    });
  });

  it("filters courses by course code search", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const searchInput = screen.getByPlaceholderText("Search courses by code or title...");
    fireEvent.change(searchInput, { target: { value: "MATH" } });
    await waitFor(() => {
      expect(screen.getAllByText("MATH 221").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows course count text", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText(/Showing 1-4 of 4 courses/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no courses match filter", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const searchInput = screen.getByPlaceholderText("Search courses by code or title...");
    fireEvent.change(searchInput, { target: { value: "ZZZZ" } });
    await waitFor(() => {
      expect(screen.getAllByText("No courses found").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty database message when initialCourses is empty", () => {
    renderWithChakra(<CoursesClient initialCourses={[]} subjects={[]} />);
    expect(screen.getAllByText("No courses have been added to the database yet.").length).toBeGreaterThanOrEqual(1);
  });

  it("switches to graduate tab", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const graduateTabs = screen.getAllByText(/Graduate/);
    const gradTabButton = graduateTabs.find(
      (el) => el.closest("button") !== null || el.closest("[role='tab']") !== null
    );
    fireEvent.click(gradTabButton?.closest("button") || gradTabButton!);
    await waitFor(() => {
      expect(screen.getAllByText("CS 550").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Graduate Algorithms").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens course detail drawer when card is clicked", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs101Elements = screen.getAllByText("CS 101");
    const cardElement = cs101Elements[0].closest("[class*='card']") || cs101Elements[0].closest("div");
    fireEvent.click(cardElement!);
    await waitFor(() => {
      expect(screen.getAllByText("Intro to Computer Science").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Course Title").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows prerequisites in drawer", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs201Elements = screen.getAllByText("CS 201");
    const cardElement = cs201Elements[0].closest("[class*='card']") || cs201Elements[0].closest("div");
    fireEvent.click(cardElement!);
    await waitFor(() => {
      expect(screen.getAllByText("Prerequisites").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Add to Plan and Add Class to Current Semester buttons in drawer", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs201Elements = screen.getAllByText("CS 201");
    const cardElement = cs201Elements[0].closest("[class*='card']") || cs201Elements[0].closest("div");
    fireEvent.click(cardElement!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add to Plan" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Add Class to Current Semester" })
      ).toBeInTheDocument();
    });
  });

  it("shows plan and semester choices when Add to Plan is clicked", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs101Elements = screen.getAllByText("CS 101");
    const cardElement = cs101Elements[0].closest("[class*='card']") || cs101Elements[0].closest("div");
    fireEvent.click(cardElement!);

    const addToPlanButton = await screen.findByRole("button", { name: "Add to Plan" });
    fireEvent.click(addToPlanButton);

    await waitFor(() => {
      expect(screen.getByText("Add Course to Plan")).toBeInTheDocument();
      expect(screen.getByText("1. Pick a plan")).toBeInTheDocument();
      expect(screen.getAllByText("My Plan").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("2. Pick a semester")).toBeInTheDocument();
      expect(screen.getAllByText(/Spring 2026/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("adds the selected course to a chosen plan semester", async () => {
    mockFetchPlans.mockResolvedValue([
      { id: 10, name: "My Plan", student_id: 1 },
      { id: 11, name: "Backup Plan", student_id: 1 },
    ]);
    mockFetchStudentTerms.mockImplementation(async (_studentId: number, planId: number) => {
      if (planId === 10) return [{ id: 20, season: "Spring", year: 2026 }];
      return [{ id: 21, season: "Fall", year: 2026 }];
    });

    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs101Elements = screen.getAllByText("CS 101");
    const cardElement = cs101Elements[0].closest("[class*='card']") || cs101Elements[0].closest("div");
    fireEvent.click(cardElement!);

    fireEvent.click(await screen.findByRole("button", { name: "Add to Plan" }));
    const backupPlanLabels = await screen.findAllByText("Backup Plan");
    fireEvent.click(findClickableAncestor(backupPlanLabels[0]));
    const fallSemesterLabels = await screen.findAllByText(/Fall 2026/);
    fireEvent.click(findClickableAncestor(fallSemesterLabels[0]));

    await waitFor(() => {
      expect(mockAddPlannedCourse).toHaveBeenCalledWith(1, 21, 1, 11, "CS 101");
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Added to plan",
          type: "success",
        })
      );
    });
  });

  it("adds the selected course to the current semester", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const cs101Elements = screen.getAllByText("CS 101");
    const cardElement = cs101Elements[0].closest("[class*='card']") || cs101Elements[0].closest("div");
    fireEvent.click(cardElement!);

    const addSemesterButton = await screen.findByRole("button", {
      name: "Add Class to Current Semester",
    });
    fireEvent.click(addSemesterButton);

    await waitFor(() => {
      expect(mockAddPlannedCourse).toHaveBeenCalledWith(1, 20, 1, 10, "CS 101");
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Added to current semester",
          type: "success",
        })
      );
    });
  });

  it("shows no description message when description is null", async () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    const math221Elements = screen.getAllByText("MATH 221");
    const cardElement = math221Elements[0].closest("[class*='card']") || math221Elements[0].closest("div");
    fireEvent.click(cardElement!);
    await waitFor(() => {
      expect(screen.getAllByText("No description available.").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("resets to page 1 when filter changes", async () => {
    const manyCourses: Course[] = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      subject: "CS",
      number: String(100 + i),
      title: `Course ${i + 1}`,
      credits: 3,
      description: null,
      prereq_text: null,
    }));
    renderWithChakra(<CoursesClient initialCourses={manyCourses} subjects={["CS"]} />);
    expect(screen.getAllByText(/Showing 1-52 of 60 courses/).length).toBeGreaterThanOrEqual(1);
    const searchInput = screen.getByPlaceholderText("Search courses by code or title...");
    fireEvent.change(searchInput, { target: { value: "Course 1" } });
    await waitFor(() => {
      const showingTexts = screen.getAllByText(/Showing 1-/);
      expect(showingTexts.length).toBeGreaterThanOrEqual(1);
    });
  }, 15000);
});
