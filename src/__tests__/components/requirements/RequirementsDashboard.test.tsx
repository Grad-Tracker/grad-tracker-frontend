import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Provider } from "@/components/ui/provider";
import RequirementsDashboard from "@/components/requirements/RequirementsDashboard";
import {
  fetchProgramRequirements,
  fetchStudentMajorProgram,
} from "@/lib/supabase/queries/onboarding";
import { fetchStudentCourseProgress } from "@/lib/supabase/queries/planner";

vi.mock("@/lib/prereq", () => ({
  evaluatePrereqsForCourses: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/supabase/queries/onboarding", () => ({
  fetchProgramRequirements: vi.fn(),
  fetchStudentMajorProgram: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchStudentCourseProgress: vi.fn(),
}));

vi.mock("@/components/requirements/GenEdRequirements", () => ({
  default: () => <div data-testid="gen-ed-requirements">GenEd content</div>,
}));

const mockFetchStudentMajorProgram = vi.mocked(fetchStudentMajorProgram);
const mockFetchProgramRequirements = vi.mocked(fetchProgramRequirements);
const mockFetchStudentCourseProgress = vi.mocked(fetchStudentCourseProgress);

describe("RequirementsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchStudentMajorProgram.mockResolvedValue({
      student_id: 6,
      program_id: 1,
      program_name: "Computer Science",
      catalog_year: 2025,
      program_type: "MAJOR",
    });

    mockFetchStudentCourseProgress.mockResolvedValue([
      {
        student_id: 6,
        course_id: 241,
        completed: true,
        progress_status: "COMPLETED",
      },
      {
        student_id: 6,
        course_id: 242,
        completed: false,
        progress_status: "ENROLLED",
      },
      {
        student_id: 6,
        course_id: 350,
        completed: false,
        progress_status: "WAITLIST",
      },
    ] as any);

    mockFetchProgramRequirements.mockResolvedValue([
      {
        id: 1,
        program_id: 1,
        name: "Major Core",
        credits_required: 6,
        courses: [
          {
            id: 241,
            subject: "CS",
            number: "241",
            title: "Intro to Programming",
            credits: 3,
          },
          {
            id: 242,
            subject: "CS",
            number: "242",
            title: "Data Structures",
            credits: 3,
          },
        ],
      },
      {
        id: 2,
        program_id: 1,
        name: "Major Electives",
        credits_required: 3,
        courses: [
          {
            id: 350,
            subject: "CS",
            number: "350",
            title: "Algorithms",
            credits: 3,
          },
        ],
      },
      {
        id: 3,
        program_id: 1,
        name: "Free Electives",
        credits_required: 3,
        courses: [
          {
            id: 101,
            subject: "MATH",
            number: "101",
            title: "College Algebra",
            credits: 3,
          },
        ],
      },
    ] as any);
  });

  it("renders heading and general education section, and toggling remaining courses is stable", async () => {
    render(
      <Provider>
        <RequirementsDashboard studentId={6} />
      </Provider>
    );

    expect(
      await screen.findByRole("heading", { name: "Degree Requirements" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "General Education" })).toBeInTheDocument();

    const showDetailsToggle = await screen.findByText(/show details/i);
    fireEvent.click(showDetailsToggle);

    expect(await screen.findByTestId("gen-ed-requirements")).toBeInTheDocument();

    const showRemainingToggle = await screen.findByRole("button", {
      name: /show remaining/i,
    });
    fireEvent.click(showRemainingToggle);

    await waitFor(() => {
      expect(screen.getByText(/MATH 101/i)).toBeInTheDocument();
    });
  });
});
