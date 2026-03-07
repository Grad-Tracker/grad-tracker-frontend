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
  catalog_year: "2024",
  program_type: "MAJOR",
};

function makeClient(programResult: any, blocksResult: any = { data: [], error: null }) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "programs") {
      return createChainMock({
        single: vi.fn().mockResolvedValue(programResult),
      });
    }
    // program_requirement_blocks + any other table (crosslistings, req_sets, atoms)
    return createChainMock({
      then: vi.fn().mockImplementation((resolve: any) => resolve(blocksResult)),
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
  });
});
