import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockFrom, mockSelect, mockOrder, mockEq, mockRequireAdvisorAccess } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockOrder: vi.fn(),
    mockEq: vi.fn(),
    mockRequireAdvisorAccess: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/app/admin/(protected)/programs/server-helpers", () => ({
  requireAdvisorAccess: mockRequireAdvisorAccess,
}));

vi.mock("@/app/admin/(protected)/assignments/AssignmentsClient", () => ({
  default: ({
    programs,
    initialAssignedIds,
    advisorId,
  }: {
    programs: unknown[];
    initialAssignedIds: number[];
    advisorId: number;
  }) => (
    <div data-testid="assignments-client">
      <span data-testid="program-count">{programs.length}</span>
      <span data-testid="assigned-count">{initialAssignedIds.length}</span>
      <span data-testid="advisor-id">{advisorId}</span>
    </div>
  ),
}));

import AssignmentsPage from "@/app/admin/(protected)/assignments/page";

describe("AssignmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdvisorAccess.mockResolvedValue({ staffId: 7 });

    const programsChain = { order: mockOrder };
    mockSelect.mockReturnValue(programsChain);
    mockOrder
      .mockReturnValueOnce({ order: mockOrder })
      .mockResolvedValueOnce({ data: [], error: null });

    mockEq.mockResolvedValue({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "programs") return { select: mockSelect };
      return { select: () => ({ eq: mockEq }) };
    });
  });

  it("renders AssignmentsClient", async () => {
    const page = await AssignmentsPage();
    renderWithChakra(page as React.ReactElement);
    expect(screen.getByTestId("assignments-client")).toBeInTheDocument();
  });

  it("passes mapped programs and assigned IDs", async () => {
    mockOrder.mockReset();
    mockOrder
      .mockReturnValueOnce({ order: mockOrder })
      .mockResolvedValueOnce({
        data: [{ id: "10", name: "Computer Science", program_type: "MAJOR", catalog_year: 2024 }],
        error: null,
      });
    mockEq.mockResolvedValueOnce({ data: [{ program_id: "10" }], error: null });

    const page = await AssignmentsPage();
    renderWithChakra(page as React.ReactElement);

    expect(screen.getByTestId("program-count").textContent).toBe("1");
    expect(screen.getByTestId("assigned-count").textContent).toBe("1");
    expect(screen.getByTestId("advisor-id").textContent).toBe("7");
  });

  it("throws when programs query fails", async () => {
    mockOrder.mockReset();
    mockOrder
      .mockReturnValueOnce({ order: mockOrder })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "programs failed" },
      });

    await expect(AssignmentsPage()).rejects.toThrow(
      "Failed to load programs: programs failed"
    );
  });

  it("throws when assignments query fails", async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: "assignments failed" },
    });

    await expect(AssignmentsPage()).rejects.toThrow(
      "Failed to load advisor assignments: assignments failed"
    );
  });
});

