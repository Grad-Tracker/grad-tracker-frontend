import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createChainMock } from "../../../helpers/mocks";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/queries/schema", () => ({
  DB_TABLES: { courses: "courses" },
}));

vi.mock("@/app/dashboard/courses/CoursesClient", () => ({
  default: (props: any) => (
    <div>
      {props.initialCourses.map((c: any) => (
        <div key={c.id}>
          {c.subject} {c.number} prereq={String(c.prereq_text)}
        </div>
      ))}
    </div>
  ),
}));

import CoursesPage from "@/app/dashboard/courses/page";

const rawCourseWithPrereq = {
  id: 1,
  subject: "CS",
  number: "201",
  title: "Data Structures",
  credits: 3,
  description: "Learn DS.",
  course_req_sets: [
    { set_type: "PREREQ", note: "CS 101" },
    { set_type: "COREQ", note: "MATH 221" },
  ],
};

const rawCourseNoPrereq = {
  id: 2,
  subject: "CS",
  number: "101",
  title: "Intro to CS",
  credits: 3,
  description: "Intro.",
  course_req_sets: [],
};

const rawCourseNullReqSets = {
  id: 3,
  subject: "MATH",
  number: "221",
  title: "Calculus I",
  credits: 4,
  description: null,
  course_req_sets: null,
};

describe("CoursesPage server component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts prereq_text from the PREREQ set_type", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: [rawCourseWithPrereq], error: null })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);
    expect(screen.getByText("CS 201 prereq=CS 101")).toBeInTheDocument();
  });

  it("passes null for prereq_text when course_req_sets has no PREREQ entry", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: [rawCourseNoPrereq], error: null })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);
    expect(screen.getByText("CS 101 prereq=null")).toBeInTheDocument();
  });

  it("passes null for prereq_text when course_req_sets is null", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: [rawCourseNullReqSets], error: null })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);
    expect(screen.getByText("MATH 221 prereq=null")).toBeInTheDocument();
  });
});
