import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createChainMock } from "../../../helpers/mocks";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/queries/schema", () => ({
  DB_VIEWS: { courseCatalog: "v_course_catalog" },
}));

vi.mock("@/app/dashboard/courses/CoursesClient", () => ({
  default: (props: any) => (
    <div>
      <div data-testid="subjects">{props.subjects.join(",")}</div>
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
  course_id: 1,
  subject: "CS",
  number: "201",
  title: "Data Structures",
  credits: 3,
  description: "Learn DS.",
  prereq_text: "CS 101",
};

const rawCourseNoPrereq = {
  course_id: 2,
  subject: "CS",
  number: "101",
  title: "Intro to CS",
  credits: 3,
  description: "Intro.",
  prereq_text: null,
};

const rawCourseNullReqSets = {
  course_id: 3,
  subject: "MATH",
  number: "221",
  title: "Calculus I",
  credits: 4,
  description: null,
  prereq_text: null,
};

describe("CoursesPage server component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses prereq_text provided by the course catalog view", async () => {
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

  it("passes null prereq_text when the catalog view returns null", async () => {
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

  it("passes null prereq_text for rows with no prerequisite text", async () => {
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

  it("passes unique sorted subjects to the client", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({
            data: [
              { ...rawCourseWithPrereq, subject: "CS" },
              { ...rawCourseNoPrereq, subject: "CS" },
              { ...rawCourseNullReqSets, subject: "MATH" },
            ],
            error: null,
          })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);

    expect(screen.getByTestId("subjects")).toHaveTextContent("CS,MATH");
  });

  it("passes an empty course list when the query returns null rows", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: null, error: null })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);

    expect(screen.getByTestId("subjects")).toHaveTextContent("");
    expect(screen.queryByText(/prereq=/)).not.toBeInTheDocument();
  });

  it("handles query errors gracefully and still renders the client", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFrom.mockReturnValue(
      createChainMock({
        then: vi.fn().mockImplementation((resolve: any) =>
          resolve({ data: null, error: { message: "DB error" } })
        ),
      })
    );

    const el = await CoursesPage();
    render(el as React.ReactElement);

    expect(errorSpy).toHaveBeenCalledWith("Error fetching courses:", { message: "DB error" });
    expect(screen.getByTestId("subjects")).toHaveTextContent("");

    errorSpy.mockRestore();
  });
});
