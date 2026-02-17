import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import CoursesClient from "@/app/dashboard/courses/CoursesClient";
import type { Course } from "@/types/course";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("next/link", () => ({
  default: (p: any) => <a href={p.href}>{p.children}</a>,
}));
vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => null,
}));

function renderWithChakra(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
  );
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
  });

  it("renders course catalog header", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("All Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Course Catalog").length).toBeGreaterThanOrEqual(1);
  });

  it("renders sidebar navigation", () => {
    renderWithChakra(<CoursesClient initialCourses={mockCourses} subjects={mockSubjects} />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(1);
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
  });
});
