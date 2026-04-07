import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createChainMock } from "../../../../helpers/mocks";

const { mockFrom, mockNotFound } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/queries/schema", () => ({
  DB_VIEWS: {
    programCatalog: "v_program_catalog",
    programRequirementDetail: "v_program_requirement_detail",
  },
}));

vi.mock("@/app/dashboard/requirements/[id]/ProgramDetailClient", () => ({
  default: (props: any) => (
    <div>
      DETAIL CLIENT program={props.program.name} blocks={props.blocks.length}
      <pre data-testid="program-json">{JSON.stringify(props.program)}</pre>
      <pre data-testid="blocks-json">{JSON.stringify(props.blocks)}</pre>
    </div>
  ),
}));

import ProgramDetailPage from "@/app/dashboard/requirements/[id]/page";

const mockProgram = {
  program_id: "42",
  program_name: "Computer Science",
  catalog_year: "2024",
  program_type: "MAJOR",
};

const mockBlock = {
  block_id: 10,
  block_name: "Major Core",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  courses: [
    {
      course_id: 241,
      subject: "CSCI",
      number: "241",
      title: "Software Engineering",
      credits: 3,
      description: "Course description",
      prereq_text: "CSCI 240",
    },
  ],
  cross_listings: [],
  req_nodes: [],
};

function makeClient(
  programResult: any,
  overrides: {
    blocksResult?: any;
  } = {}
) {
  const { blocksResult = { data: [], error: null } } = overrides;

  mockFrom.mockImplementation((table: string) => {
    if (table === "v_program_catalog") {
      return createChainMock({
        maybeSingle: vi.fn().mockResolvedValue(programResult),
      });
    }
    if (table === "v_program_requirement_detail") {
      return createChainMock({
        order: vi.fn().mockResolvedValue(blocksResult),
      });
    }
    return createChainMock({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });
}

describe("/dashboard/requirements/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when program is not found", async () => {
    makeClient({ data: null, error: { message: "not found" } });

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "42" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when program query returns error", async () => {
    makeClient({ data: null, error: { code: "PGRST116" } });

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "99" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders ProgramDetailClient with program data when found", async () => {
    makeClient({ data: mockProgram, error: null });

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });
    render(el as React.ReactElement);

    expect(
      screen.getByText("DETAIL CLIENT program=Computer Science blocks=0")
    ).toBeInTheDocument();
  });

  it("queries the program catalog view with the correct id", async () => {
    makeClient({ data: mockProgram, error: null });

    await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });

    expect(mockFrom).toHaveBeenCalledWith("v_program_catalog");
    const programsChain = mockFrom.mock.results[0].value;
    expect(programsChain.eq).toHaveBeenCalledWith("program_id", "42");
  });

  it("throws when loading requirement blocks fails", async () => {
    makeClient(
      { data: mockProgram, error: null },
      { blocksResult: { data: null, error: { message: "blocks failed" } } }
    );

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "42" }) })
    ).rejects.toThrow("Failed to load requirement blocks: blocks failed");
  });

  it("renders a populated block when requirement detail view succeeds", async () => {
    makeClient(
      { data: mockProgram, error: null },
      { blocksResult: { data: [mockBlock], error: null } }
    );

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });
    render(el as React.ReactElement);

    expect(
      screen.getByText("DETAIL CLIENT program=Computer Science blocks=1")
    ).toBeInTheDocument();
  });

  it("normalizes nullable program and course fields when building client props", async () => {
    makeClient(
      {
        data: {
          program_id: "77",
          program_name: "History",
          catalog_year: "",
          program_type: null,
        },
        error: null,
      },
      {
        blocksResult: {
          data: [
            {
              block_id: 12,
              block_name: "Electives",
              rule: "ALL_OF",
              n_required: null,
              credits_required: null,
              courses: [
                {
                  course_id: 400,
                  subject: null,
                  number: null,
                  title: null,
                  credits: null,
                  description: undefined,
                  prereq_text: undefined,
                },
              ],
              cross_listings: [],
              req_nodes: [],
            },
          ],
          error: null,
        },
      }
    );

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "77" }) });
    render(el as React.ReactElement);

    expect(screen.getByTestId("program-json")).toHaveTextContent(
      JSON.stringify({
        id: "77",
        name: "History",
        catalog_year: null,
        program_type: "",
      })
    );

    const blocks = JSON.parse(screen.getByTestId("blocks-json").textContent ?? "[]");
    expect(blocks[0].courses[0]).toEqual({
      id: 400,
      subject: "",
      number: "",
      title: "",
      credits: 0,
      description: null,
      prereq_text: null,
    });
  });

  it("builds option groups from OR trees with ATOM and AND children", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: {
          data: [
            {
              block_id: 21,
              block_name: "Choose One",
              rule: "ONE_OF",
              n_required: 1,
              credits_required: null,
              courses: [
                {
                  course_id: 101,
                  subject: "CSCI",
                  number: "101",
                  title: "Intro",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
                {
                  course_id: 201,
                  subject: "CSCI",
                  number: "201",
                  title: "Data Structures",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
                {
                  course_id: 202,
                  subject: "CSCI",
                  number: "202",
                  title: "Systems",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
              ],
              cross_listings: [],
              req_nodes: [
                { node_id: 1, node_type: "OR", parent_id: null, sort_order: 0, atom_type: null, required_course_id: null },
                { node_id: 2, node_type: "ATOM", parent_id: 1, sort_order: 0, atom_type: "COURSE", required_course_id: 101 },
                { node_id: 3, node_type: "AND", parent_id: 1, sort_order: 1, atom_type: null, required_course_id: null },
                { node_id: 4, node_type: "ATOM", parent_id: 3, sort_order: 0, atom_type: "COURSE", required_course_id: 201 },
                { node_id: 5, node_type: "ATOM", parent_id: 3, sort_order: 1, atom_type: "COURSE", required_course_id: 202 },
              ],
            },
          ],
          error: null,
        },
      }
    );

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });
    render(el as React.ReactElement);

    const blocks = JSON.parse(screen.getByTestId("blocks-json").textContent ?? "[]");
    expect(blocks[0].options).toEqual([
      [
        {
          id: 101,
          subject: "CSCI",
          number: "101",
          title: "Intro",
          credits: 3,
          description: null,
          prereq_text: null,
        },
      ],
      [
        {
          id: 201,
          subject: "CSCI",
          number: "201",
          title: "Data Structures",
          credits: 3,
          description: null,
          prereq_text: null,
        },
        {
          id: 202,
          subject: "CSCI",
          number: "202",
          title: "Systems",
          credits: 3,
          description: null,
          prereq_text: null,
        },
      ],
    ]);
  });

  it("keeps course order from the requirement tree and computes forward and reverse cross-list pairs", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: {
          data: [
            {
              block_id: 22,
              block_name: "Ordered Core",
              rule: "ALL_OF",
              n_required: null,
              credits_required: 9,
              courses: [
                {
                  course_id: 301,
                  subject: "CSCI",
                  number: "301",
                  title: "Databases",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
                {
                  course_id: 302,
                  subject: "MATH",
                  number: "302",
                  title: "Statistics",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
                {
                  course_id: 303,
                  subject: "DATA",
                  number: "303",
                  title: "Modeling",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
              ],
              cross_listings: [
                { course_id: 301, cross_subject: "MATH", cross_number: "302" },
                { course_id: 303, cross_subject: "STAT", cross_number: "303" },
              ],
              req_nodes: [
                { node_id: 1, node_type: "AND", parent_id: null, sort_order: 0, atom_type: null, required_course_id: null },
                { node_id: 2, node_type: "ATOM", parent_id: 1, sort_order: 0, atom_type: "COURSE", required_course_id: 302 },
                { node_id: 3, node_type: "ATOM", parent_id: 1, sort_order: 1, atom_type: "COURSE", required_course_id: 301 },
                { node_id: 4, node_type: "ATOM", parent_id: 1, sort_order: 2, atom_type: "COURSE", required_course_id: 303 },
                { node_id: 4, node_type: "ATOM", parent_id: 1, sort_order: 2, atom_type: "COURSE", required_course_id: 303 },
              ],
            },
            {
              block_id: 23,
              block_name: "Reverse Cross Listing",
              rule: "ALL_OF",
              n_required: null,
              credits_required: null,
              courses: [
                {
                  course_id: 401,
                  subject: "STAT",
                  number: "303",
                  title: "Applied Stats",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
                {
                  course_id: 303,
                  subject: "DATA",
                  number: "303",
                  title: "Modeling",
                  credits: 3,
                  description: null,
                  prereq_text: null,
                },
              ],
              cross_listings: [
                { course_id: 303, cross_subject: "STAT", cross_number: "303" },
              ],
              req_nodes: [],
            },
          ],
          error: null,
        },
      }
    );

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });
    render(el as React.ReactElement);

    const blocks = JSON.parse(screen.getByTestId("blocks-json").textContent ?? "[]");

    expect(blocks[0].courses.map((course: any) => course.id)).toEqual([302, 301, 303]);
    expect(blocks[0].crossPairs).toEqual([[302, 301]]);
    expect(blocks[1].crossPairs).toEqual([[401, 303]]);
    expect(blocks[1].options).toBeNull();
  });
});
