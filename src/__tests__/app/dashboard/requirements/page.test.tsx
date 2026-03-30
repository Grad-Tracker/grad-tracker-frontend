import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createChainMock } from "../../../helpers/mocks";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/queries/schema", () => ({
  DB_TABLES: { programs: "programs" },
}));

vi.mock("@/app/dashboard/requirements/ProgramsClient", () => ({
  default: (props: any) => (
    <div>PROGRAMS CLIENT count={props.programs.length}</div>
  ),
}));

import RequirementsPage from "@/app/dashboard/requirements/page";

const mockPrograms = [
  { id: "1", name: "Computer Science", catalog_year: 2024, program_type: "MAJOR" },
  { id: "2", name: "Mathematics Minor", catalog_year: null, program_type: "MINOR" },
];

describe("/dashboard/requirements page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ProgramsClient with fetched programs", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        order: vi.fn().mockResolvedValue({ data: mockPrograms, error: null }),
      })
    );

    const el = await RequirementsPage();
    render(el as React.ReactElement);
    expect(screen.getByText("PROGRAMS CLIENT count=2")).toBeInTheDocument();
  });

  it("passes empty array when Supabase returns an error", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      })
    );

    const el = await RequirementsPage();
    render(el as React.ReactElement);
    expect(screen.getByText("PROGRAMS CLIENT count=0")).toBeInTheDocument();
  });

  it("queries the programs table with name ordering", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
    );

    await RequirementsPage();
    expect(mockFrom).toHaveBeenCalledWith("programs");
    const chain = mockFrom.mock.results[0].value;
    expect(chain.order).toHaveBeenCalledWith("name", { ascending: true });
  });
});
