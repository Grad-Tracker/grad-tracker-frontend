import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const { mockAddCourse, mockUpdateCourse, mockDeactivateCourse, mockReactivateCourse, mockToaster } =
  vi.hoisted(() => ({
    mockAddCourse: vi.fn(),
    mockUpdateCourse: vi.fn(),
    mockDeactivateCourse: vi.fn(),
    mockReactivateCourse: vi.fn(),
    mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
  }));

vi.mock("@/lib/supabase/queries/courses", () => ({
  addCourse: mockAddCourse,
  updateCourse: mockUpdateCourse,
  deactivateCourse: mockDeactivateCourse,
  reactivateCourse: mockReactivateCourse,
}));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/field", () => ({
  Field: ({ label, children, errorText, required }: any) => (
    <div>
      <label>
        {label}
        {required && " *"}
      </label>
      {children}
      {errorText && <span role="alert">{errorText}</span>}
    </div>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/courses",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

import CoursesAdminClient from "@/app/admin/courses/CoursesAdminClient";
import type { CourseDetail } from "@/types/course";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const COURSES: CourseDetail[] = [
  { id: 1, subject: "CS", number: "101", title: "Intro to CS", credits: 3, description: "An intro.", prereq_text: null, is_active: true },
  { id: 2, subject: "CS", number: "201", title: "Data Structures", credits: 3, description: "DS course.", prereq_text: "CS 101", is_active: true },
  { id: 3, subject: "MATH", number: "221", title: "Calculus I", credits: 4, description: null, prereq_text: null, is_active: true },
  { id: 4, subject: "ENGL", number: "101", title: "English Composition", credits: 3, description: "Writing.", prereq_text: null, is_active: false },
];

const SUBJECTS = ["CS", "ENGL", "MATH"];

// ── helpers ───────────────────────────────────────────────────────────────────

function setup(courses = COURSES, subjects = SUBJECTS) {
  return renderWithChakra(
    <CoursesAdminClient initialCourses={courses} subjects={subjects} />
  );
}

// ── large fixture for pagination tests ───────────────────────────────────────

const LARGE_COURSES: CourseDetail[] = Array.from({ length: 30 }, (_, i) => ({
  id: 100 + i,
  subject: "CS",
  number: String(100 + i),
  title: `Course ${100 + i}`,
  credits: 3,
  description: null,
  prereq_text: null,
  is_active: true,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe("CoursesAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── rendering ──────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders Course Catalog heading", () => {
      setup();
      expect(screen.getByText("Course Catalog")).toBeInTheDocument();
    });

    it("renders Add Course button", () => {
      setup();
      expect(screen.getByRole("button", { name: /add course/i })).toBeInTheDocument();
    });

    it("renders table column headers", () => {
      setup();
      expect(screen.getByText("Subject")).toBeInTheDocument();
      expect(screen.getByText("Number")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Credits")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("renders all courses in the table", () => {
      setup();
      expect(screen.getByText("Intro to CS")).toBeInTheDocument();
      expect(screen.getByText("Data Structures")).toBeInTheDocument();
      expect(screen.getByText("Calculus I")).toBeInTheDocument();
      expect(screen.getByText("English Composition")).toBeInTheDocument();
    });

    it("shows course numbers", () => {
      setup();
      // Multiple rows may share the same number (e.g. CS 101 and ENGL 101)
      expect(screen.getAllByText("221").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("201").length).toBeGreaterThanOrEqual(1);
    });

    it("shows Active badge for active courses", () => {
      setup();
      const badges = screen.getAllByText("Active");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it("shows Inactive badge for inactive courses", () => {
      setup();
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("renders View and Edit buttons for each row", () => {
      setup();
      expect(screen.getAllByRole("button", { name: /view course/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("button", { name: /edit course/i }).length).toBeGreaterThanOrEqual(1);
    });

    it("shows empty state when no courses", () => {
      setup([], []);
      expect(screen.getByText("No courses in the database yet.")).toBeInTheDocument();
    });

    it("shows result count", () => {
      setup();
      expect(screen.getByText(/4 courses/)).toBeInTheDocument();
    });
  });

  // ── pagination ─────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("shows pagination controls when courses exceed page size", () => {
      renderWithChakra(
        <CoursesAdminClient initialCourses={LARGE_COURSES} subjects={["CS"]} />
      );
      expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    });

    it("does not show pagination when courses fit on one page", () => {
      setup(); // 4 courses < 25
      expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
    });

    it("clamps page when search narrows results below current page", async () => {
      renderWithChakra(
        <CoursesAdminClient initialCourses={LARGE_COURSES} subjects={["CS"]} />
      );
      // Navigate to page 2
      const nextBtn = screen.getByRole("button", { name: /next page/i });
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
      });
      // Search to narrow to < PAGE_SIZE results — pagination disappears (single page)
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "Course 100" } });
      await waitFor(() => {
        // Controls hide when totalPages === 1
        expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
        // And the one matching course is visible
        expect(screen.getByText("Course 100")).toBeInTheDocument();
      });
    });
  });

  // ── search ─────────────────────────────────────────────────────────────────

  describe("search", () => {
    it("filters courses by title", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "Data Structures" } });
      await waitFor(() => {
        expect(screen.getByText("Data Structures")).toBeInTheDocument();
        expect(screen.queryByText("Intro to CS")).not.toBeInTheDocument();
        expect(screen.queryByText("Calculus I")).not.toBeInTheDocument();
      });
    });

    it("filters courses by subject code", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "MATH" } });
      await waitFor(() => {
        expect(screen.getByText("Calculus I")).toBeInTheDocument();
        expect(screen.queryByText("Intro to CS")).not.toBeInTheDocument();
      });
    });

    it("filters courses by number", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "221" } });
      await waitFor(() => {
        expect(screen.getByText("Calculus I")).toBeInTheDocument();
        expect(screen.queryByText("Intro to CS")).not.toBeInTheDocument();
      });
    });

    it("shows no-match message when search has no results", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "xyznotfound" } });
      await waitFor(() => {
        expect(screen.getByText("No courses match your filters.")).toBeInTheDocument();
      });
    });

    it("shows filtered count in result text", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "CS" } });
      await waitFor(() => {
        expect(screen.getByText(/of 4 courses/)).toBeInTheDocument();
      });
    });
  });

  // ── Add Course dialog ──────────────────────────────────────────────────────

  describe("Add Course dialog", () => {
    it("opens dialog when Add Course is clicked", async () => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      // Assert on dialog-only content — the Subject input only mounts when the dialog is open
      await waitFor(() => {
        expect(screen.getByPlaceholderText("e.g. CSCI")).toBeInTheDocument();
      });
    });

    it("shows all required form fields", async () => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("e.g. CSCI")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("e.g. 101")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("e.g. Introduction to Computer Science")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("3")).toBeInTheDocument();
      });
    });

    it("shows validation errors for empty required fields on save", async () => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      await waitFor(() => screen.getByPlaceholderText("e.g. CSCI"));

      // Click save with empty form — get the last "Add Course" btn (the dialog submit)
      const allAddBtns = screen.getAllByRole("button", { name: /add course/i });
      fireEvent.click(allAddBtns[allAddBtns.length - 1]);

      await waitFor(() => {
        expect(screen.getByText("Subject is required.")).toBeInTheDocument();
        expect(screen.getByText("Number is required.")).toBeInTheDocument();
        expect(screen.getByText("Title is required.")).toBeInTheDocument();
        expect(screen.getByText("Credits must be a positive number.")).toBeInTheDocument();
      });
    });

    it("calls addCourse and closes dialog on successful save", async () => {
      mockAddCourse.mockResolvedValue({ id: 99 });
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      await waitFor(() => screen.getByPlaceholderText("e.g. CSCI"));

      fireEvent.change(screen.getByPlaceholderText("e.g. CSCI"), { target: { value: "CS" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. 101"), { target: { value: "301" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to Computer Science"), { target: { value: "Algorithms" } });
      fireEvent.change(screen.getByPlaceholderText("3"), { target: { value: "3" } });

      const allAddBtns = screen.getAllByRole("button", { name: /add course/i });
      fireEvent.click(allAddBtns[allAddBtns.length - 1]);

      await waitFor(() => {
        expect(mockAddCourse).toHaveBeenCalledWith(
          expect.objectContaining({ subject: "CS", number: "301", title: "Algorithms", credits: 3 })
        );
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Course added", type: "success" })
        );
      });
    });

    it("shows duplicate error on 23505 postgres code", async () => {
      mockAddCourse.mockRejectedValue({ code: "23505" });
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      await waitFor(() => screen.getByPlaceholderText("e.g. CSCI"));

      fireEvent.change(screen.getByPlaceholderText("e.g. CSCI"), { target: { value: "CS" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. 101"), { target: { value: "101" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to Computer Science"), { target: { value: "Intro" } });
      fireEvent.change(screen.getByPlaceholderText("3"), { target: { value: "3" } });

      const allAddBtns = screen.getAllByRole("button", { name: /add course/i });
      fireEvent.click(allAddBtns[allAddBtns.length - 1]);

      await waitFor(() => {
        expect(
          screen.getByText(/already exists/i)
        ).toBeInTheDocument();
      });
    });

    it("shows general error for non-duplicate failures", async () => {
      mockAddCourse.mockRejectedValue({ code: "42P01", message: "table not found" });
      setup();
      fireEvent.click(screen.getByRole("button", { name: /add course/i }));
      await waitFor(() => screen.getByPlaceholderText("e.g. CSCI"));

      fireEvent.change(screen.getByPlaceholderText("e.g. CSCI"), { target: { value: "CS" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. 101"), { target: { value: "999" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to Computer Science"), { target: { value: "Test" } });
      fireEvent.change(screen.getByPlaceholderText("3"), { target: { value: "3" } });

      const allAddBtns = screen.getAllByRole("button", { name: /add course/i });
      fireEvent.click(allAddBtns[allAddBtns.length - 1]);

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });
  });

  // ── Edit dialog ────────────────────────────────────────────────────────────

  describe("Edit dialog", () => {
    it("opens edit dialog pre-filled with course data", async () => {
      setup();
      const editBtns = screen.getAllByRole("button", { name: /edit course/i });
      fireEvent.click(editBtns[0]);
      await waitFor(() => {
        // First course is CS 101 - Intro to CS
        expect(screen.getByDisplayValue("CS")).toBeInTheDocument();
        expect(screen.getByDisplayValue("101")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Intro to CS")).toBeInTheDocument();
      });
    });

    it("shows Edit Course title in dialog", async () => {
      setup();
      const editBtns = screen.getAllByRole("button", { name: /edit course/i });
      fireEvent.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getByText("Edit Course")).toBeInTheDocument();
      });
    });

    it("calls updateCourse on save", async () => {
      mockUpdateCourse.mockResolvedValue({ id: 1 });
      setup();
      const editBtns = screen.getAllByRole("button", { name: /edit course/i });
      fireEvent.click(editBtns[0]);
      await waitFor(() => screen.getByDisplayValue("Intro to CS"));

      fireEvent.change(screen.getByDisplayValue("Intro to CS"), { target: { value: "Intro to CS Updated" } });

      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateCourse).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ title: "Intro to CS Updated" })
        );
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Course updated", type: "success" })
        );
      });
    });
  });

  // ── View drawer ────────────────────────────────────────────────────────────

  describe("View drawer", () => {
    it("opens view drawer with course details", async () => {
      setup();
      const viewBtns = screen.getAllByRole("button", { name: /view course/i });
      fireEvent.click(viewBtns[0]);
      // Assert on drawer-only content — description is not shown in the table
      await waitFor(() => {
        expect(screen.getByText("An intro.")).toBeInTheDocument();
      });
    });

    it("shows description in drawer", async () => {
      setup();
      const viewBtns = screen.getAllByRole("button", { name: /view course/i });
      fireEvent.click(viewBtns[0]);
      await waitFor(() => {
        expect(screen.getByText("An intro.")).toBeInTheDocument();
      });
    });

    it("shows 'No description available' when description is null", async () => {
      setup();
      // Course at index 2 is MATH 221 with no description
      const viewBtns = screen.getAllByRole("button", { name: /view course/i });
      fireEvent.click(viewBtns[2]);
      await waitFor(() => {
        expect(screen.getByText("No description available.")).toBeInTheDocument();
      });
    });

    it("shows prerequisites when present", async () => {
      setup();
      // Course at index 1 is CS 201 with prereq_text "CS 101"
      const viewBtns = screen.getAllByRole("button", { name: /view course/i });
      fireEvent.click(viewBtns[1]);
      await waitFor(() => {
        expect(screen.getByText("CS 101")).toBeInTheDocument();
      });
    });
  });

  // ── deactivate / reactivate ────────────────────────────────────────────────

  describe("deactivate / reactivate", () => {
    it("calls deactivateCourse for active courses", async () => {
      mockDeactivateCourse.mockResolvedValue({ id: 1 });
      setup();
      const deactivateBtns = screen.getAllByRole("button", { name: /deactivate course/i });
      fireEvent.click(deactivateBtns[0]);
      await waitFor(() => {
        expect(mockDeactivateCourse).toHaveBeenCalledWith(1);
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Course deactivated" })
        );
      });
    });

    it("calls reactivateCourse for inactive courses", async () => {
      mockReactivateCourse.mockResolvedValue({ id: 4 });
      setup();
      const reactivateBtn = screen.getByRole("button", { name: /reactivate course/i });
      fireEvent.click(reactivateBtn);
      await waitFor(() => {
        expect(mockReactivateCourse).toHaveBeenCalledWith(4);
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Course reactivated" })
        );
      });
    });

    it("shows error toast when toggle fails", async () => {
      mockDeactivateCourse.mockRejectedValue(new Error("DB error"));
      setup();
      const deactivateBtns = screen.getAllByRole("button", { name: /deactivate course/i });
      fireEvent.click(deactivateBtns[0]);
      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Failed to update course status", type: "error" })
        );
      });
    });
  });

  // ── empty state ────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows no-match message when filters return nothing", async () => {
      setup();
      const input = screen.getByPlaceholderText("Search by subject, number, or title...");
      fireEvent.change(input, { target: { value: "zzz_not_found_xyz" } });
      await waitFor(() => {
        expect(screen.getByText("No courses match your filters.")).toBeInTheDocument();
      });
    });
  });
});
