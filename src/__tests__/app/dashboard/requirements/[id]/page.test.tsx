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
});
