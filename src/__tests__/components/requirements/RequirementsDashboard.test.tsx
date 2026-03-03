import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Provider } from "@/components/ui/provider";
import RequirementsDashboard from "@/components/requirements/RequirementsDashboard";
import { DB_TABLES, PROGRAM_TYPES } from "@/lib/supabase/queries/schema";

const { fromMock, mockedClient } = vi.hoisted(() => {
  const fromMock = vi.fn();
  return {
    fromMock,
    mockedClient: { from: fromMock },
  };
});

vi.mock("@/lib/prereq", () => ({
  evaluatePrereqsForCourses: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockedClient,
}));

vi.mock("@/components/requirements/GenEdRequirements", () => ({
  default: () => <div data-testid="gen-ed-requirements">GenEd content</div>,
}));

type QueryState = {
  eq: Record<string, unknown>;
  in: Record<string, unknown[]>;
};

function buildResponse(table: string, state: QueryState) {
  if (table === DB_TABLES.studentPrograms) {
    return { data: [{ program_id: 1 }], error: null };
  }

  if (table === DB_TABLES.programs) {
    const selectedType = state.eq.program_type;
    const selectedIds = state.in.id;
    const isMajor = selectedType === PROGRAM_TYPES.major;
    const includesTarget = Array.isArray(selectedIds) && selectedIds.includes(1);

    return isMajor && includesTarget
      ? {
          data: { id: 1, name: "Computer Science", program_type: "major" },
          error: null,
        }
      : { data: null, error: null };
  }

  if (table === DB_TABLES.studentCourseHistory) {
    return { data: [{ course_id: 241 }], error: null };
  }

  if (table === DB_TABLES.studentPlannedCourses) {
    return {
      data: [
        { course_id: 242, status: "enrolled" },
        { course_id: 350, status: "waitlist" },
      ],
      error: null,
    };
  }

  if (table === DB_TABLES.programRequirementBlocks) {
    return {
      data: [
        {
          id: 1,
          name: "Major Core",
          credits_required: 6,
          program_requirement_courses: [
            {
              course_id: 241,
              courses: {
                id: 241,
                subject: "CS",
                number: "241",
                title: "Intro to Programming",
                credits: 3,
              },
            },
            {
              course_id: 242,
              courses: {
                id: 242,
                subject: "CS",
                number: "242",
                title: "Data Structures",
                credits: 3,
              },
            },
          ],
        },
        {
          id: 2,
          name: "Major Electives",
          credits_required: 3,
          program_requirement_courses: [
            {
              course_id: 350,
              courses: {
                id: 350,
                subject: "CS",
                number: "350",
                title: "Algorithms",
                credits: 3,
              },
            },
          ],
        },
        {
          id: 3,
          name: "Free Electives",
          credits_required: 3,
          program_requirement_courses: [
            {
              course_id: 101,
              courses: {
                id: 101,
                subject: "MATH",
                number: "101",
                title: "College Algebra",
                credits: 3,
              },
            },
          ],
        },
      ],
      error: null,
    };
  }

  return { data: [], error: null };
}

function createQueryBuilder(table: string) {
  const state: QueryState = { eq: {}, in: {} };

  const builder: any = {
    select: vi.fn().mockReturnValue(null),
    eq: vi.fn().mockReturnValue(null),
    in: vi.fn().mockReturnValue(null),
    maybeSingle: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation((column: string, value: unknown) => {
    state.eq[column] = value;
    return builder;
  });
  builder.in.mockImplementation((column: string, values: unknown[]) => {
    state.in[column] = values;
    return builder;
  });

  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(buildResponse(table, state)).then(resolve, reject);

  builder.maybeSingle.mockImplementation(async () => buildResponse(table, state));

  return builder;
}

describe("RequirementsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => createQueryBuilder(table));
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

    const showRemainingToggle = await screen.findByRole("button", {
      name: /show remaining/i,
    });
    fireEvent.click(showRemainingToggle);

    await waitFor(() => {
      expect(screen.getByText(/MATH 101/i)).toBeInTheDocument();
    });
  });
});
