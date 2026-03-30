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
  DB_TABLES: {
    programs: "programs",
    programRequirementBlocks: "program_requirement_blocks",
  },
}));

vi.mock("@/app/dashboard/requirements/[id]/ProgramDetailClient", () => ({
  default: (props: any) => (
    <div>
      DETAIL CLIENT program={props.program.name} blocks={props.blocks.length}
    </div>
  ),
}));

import ProgramDetailPage from "@/app/dashboard/requirements/[id]/page";

const mockProgram = {
  id: "42",
  name: "Computer Science",
  catalog_year: 2024,
  program_type: "MAJOR",
};

const mockBlock = {
  id: 10,
  name: "Major Core",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  program_requirement_courses: [
    {
      courses: {
        id: 241,
        subject: "CSCI",
        number: "241",
        title: "Software Engineering",
        credits: 3,
        description: "Course description",
        course_req_sets: [{ set_type: "PREREQ", note: "CSCI 240" }],
      },
    },
  ],
};

function makeClient(
  programResult: any,
  overrides: {
    blocksResult?: any;
    crossListingsResult?: any;
    reqSetsResult?: any;
    atomRowsResult?: any;
  } = {}
) {
  const {
    blocksResult = { data: [], error: null },
    crossListingsResult = { data: [], error: null },
    reqSetsResult = { data: [], error: null },
    atomRowsResult = { data: [], error: null },
  } = overrides;

  mockFrom.mockImplementation((table: string) => {
    if (table === "programs") {
      return createChainMock({
        single: vi.fn().mockResolvedValue(programResult),
      });
    }
    if (table === "program_requirement_blocks") {
      return createChainMock({
        order: vi.fn().mockResolvedValue(blocksResult),
      });
    }
    if (table === "course_crosslistings") {
      return createChainMock({
        in: vi.fn().mockResolvedValue(crossListingsResult),
      });
    }
    if (table === "program_req_sets") {
      return createChainMock({
        in: vi.fn().mockResolvedValue(reqSetsResult),
      });
    }
    if (table === "program_req_atoms") {
      return createChainMock({
        in: vi.fn().mockResolvedValue(atomRowsResult),
      });
    }

    return createChainMock({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
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

  it("calls notFound when program query returns programError", async () => {
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

  it("queries the programs table with the correct id", async () => {
    makeClient({ data: mockProgram, error: null });

    await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });

    expect(mockFrom).toHaveBeenCalledWith("programs");
    const programsChain = mockFrom.mock.results[0].value;
    expect(programsChain.eq).toHaveBeenCalledWith("id", "42");
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

  it("throws when loading cross-listings fails for block courses", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: { data: [mockBlock], error: null },
        crossListingsResult: {
          data: null,
          error: { message: "cross-listings failed" },
        },
      }
    );

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "42" }) })
    ).rejects.toThrow("Failed to load cross-listings: cross-listings failed");
  });

  it("throws when loading requirement sets fails for existing blocks", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: { data: [mockBlock], error: null },
        reqSetsResult: { data: null, error: { message: "req sets failed" } },
      }
    );

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "42" }) })
    ).rejects.toThrow("Failed to load requirement sets: req sets failed");
  });

  it("throws when loading requirement atoms fails for existing req nodes", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: { data: [mockBlock], error: null },
        reqSetsResult: {
          data: [
            {
              id: 1,
              block_id: 10,
              program_req_nodes: [
                { id: 100, node_type: "ATOM", parent_id: null, sort_order: 1 },
              ],
            },
          ],
          error: null,
        },
        atomRowsResult: { data: null, error: { message: "atoms failed" } },
      }
    );

    await expect(
      ProgramDetailPage({ params: Promise.resolve({ id: "42" }) })
    ).rejects.toThrow("Failed to load requirement atoms: atoms failed");
  });

  it("renders a populated block when all requirement queries succeed", async () => {
    makeClient(
      { data: mockProgram, error: null },
      {
        blocksResult: { data: [mockBlock], error: null },
        crossListingsResult: { data: [], error: null },
        reqSetsResult: {
          data: [
            {
              id: 1,
              block_id: 10,
              program_req_nodes: [
                { id: 100, node_type: "ATOM", parent_id: null, sort_order: 1 },
              ],
            },
          ],
          error: null,
        },
        atomRowsResult: {
          data: [
            { node_id: 100, atom_type: "COURSE", required_course_id: 241 },
          ],
          error: null,
        },
      }
    );

    const el = await ProgramDetailPage({ params: Promise.resolve({ id: "42" }) });
    render(el as React.ReactElement);

    expect(
      screen.getByText("DETAIL CLIENT program=Computer Science blocks=1")
    ).toBeInTheDocument();
  });
});
