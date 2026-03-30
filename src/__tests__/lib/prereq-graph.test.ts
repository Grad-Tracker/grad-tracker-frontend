import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

function makeResolvingChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    resolve({ data, error })
  );
  return chain;
}

import { extractPrereqEdges } from "@/lib/planner/prereq-graph";

describe("extractPrereqEdges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty Map and makes no DB calls for empty input", async () => {
    const result = await extractPrereqEdges([]);
    expect(result).toEqual(new Map());
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty Map when no req sets exist", async () => {
    const reqSetsChain = makeResolvingChain([], null);
    mockFrom.mockReturnValueOnce(reqSetsChain);

    const result = await extractPrereqEdges([101]);

    expect(result).toEqual(new Map());
    expect(mockFrom).toHaveBeenCalledWith("course_req_sets");
  });

  it("returns simple ATOM prereq edge", async () => {
    const reqSetsChain = makeResolvingChain(
      [{ id: 1, course_id: 201, set_type: "PREREQ" }],
      null
    );
    const reqNodesChain = makeResolvingChain(
      [{ id: 10, req_set_id: 1, parent_id: null, node_type: "ATOM" }],
      null
    );
    const reqAtomsChain = makeResolvingChain(
      [{ node_id: 10, atom_type: "COURSE", required_course_id: 101 }],
      null
    );

    mockFrom
      .mockReturnValueOnce(reqSetsChain)
      .mockReturnValueOnce(reqNodesChain)
      .mockReturnValueOnce(reqAtomsChain);

    const result = await extractPrereqEdges([101, 201]);

    expect(result.get(201)).toEqual(new Set([101]));
    expect(result.has(101)).toBe(false);
  });

  it("AND node unions all branches", async () => {
    const reqSetsChain = makeResolvingChain(
      [{ id: 1, course_id: 301, set_type: "PREREQ" }],
      null
    );
    const reqNodesChain = makeResolvingChain(
      [
        { id: 10, req_set_id: 1, parent_id: null, node_type: "AND" },
        { id: 11, req_set_id: 1, parent_id: 10, node_type: "ATOM" },
        { id: 12, req_set_id: 1, parent_id: 10, node_type: "ATOM" },
      ],
      null
    );
    const reqAtomsChain = makeResolvingChain(
      [
        { node_id: 11, atom_type: "COURSE", required_course_id: 101 },
        { node_id: 12, atom_type: "COURSE", required_course_id: 201 },
      ],
      null
    );

    mockFrom
      .mockReturnValueOnce(reqSetsChain)
      .mockReturnValueOnce(reqNodesChain)
      .mockReturnValueOnce(reqAtomsChain);

    const result = await extractPrereqEdges([101, 201, 301]);

    expect(result.get(301)).toEqual(new Set([101, 201]));
  });

  it("OR node picks the branch with fewest prereqs", async () => {
    const reqSetsChain = makeResolvingChain(
      [{ id: 1, course_id: 301, set_type: "PREREQ" }],
      null
    );
    const reqNodesChain = makeResolvingChain(
      [
        { id: 10, req_set_id: 1, parent_id: null, node_type: "OR" },
        { id: 11, req_set_id: 1, parent_id: 10, node_type: "ATOM" },
        { id: 12, req_set_id: 1, parent_id: 10, node_type: "AND" },
        { id: 13, req_set_id: 1, parent_id: 12, node_type: "ATOM" },
        { id: 14, req_set_id: 1, parent_id: 12, node_type: "ATOM" },
      ],
      null
    );
    const reqAtomsChain = makeResolvingChain(
      [
        { node_id: 11, atom_type: "COURSE", required_course_id: 101 },
        { node_id: 13, atom_type: "COURSE", required_course_id: 101 },
        { node_id: 14, atom_type: "COURSE", required_course_id: 201 },
      ],
      null
    );

    mockFrom
      .mockReturnValueOnce(reqSetsChain)
      .mockReturnValueOnce(reqNodesChain)
      .mockReturnValueOnce(reqAtomsChain);

    const result = await extractPrereqEdges([101, 201, 301]);

    // Branch A (node 11): ATOM → {101} (size 1)
    // Branch B (node 12): AND of 13+14 → {101, 201} (size 2)
    // OR picks A (fewer prereqs) → {101}
    expect(result.get(301)).toEqual(new Set([101]));
  });

  it("breaks cycles by removing the edge to the higher-numbered course", async () => {
    // course 101 requires 201, course 201 requires 101
    const reqSetsChain = makeResolvingChain(
      [
        { id: 1, course_id: 101, set_type: "PREREQ" },
        { id: 2, course_id: 201, set_type: "PREREQ" },
      ],
      null
    );
    const reqNodesChain = makeResolvingChain(
      [
        { id: 10, req_set_id: 1, parent_id: null, node_type: "ATOM" },
        { id: 20, req_set_id: 2, parent_id: null, node_type: "ATOM" },
      ],
      null
    );
    const reqAtomsChain = makeResolvingChain(
      [
        { node_id: 10, atom_type: "COURSE", required_course_id: 201 },
        { node_id: 20, atom_type: "COURSE", required_course_id: 101 },
      ],
      null
    );

    mockFrom
      .mockReturnValueOnce(reqSetsChain)
      .mockReturnValueOnce(reqNodesChain)
      .mockReturnValueOnce(reqAtomsChain);

    const result = await extractPrereqEdges([101, 201]);

    // Cycle: 101→{201} and 201→{101}
    // Iterating courseId=101, prereqId=201: courseId(101) < prereqId(201)
    // → else branch: reversePrereqs.delete(courseId) → delete 101 from 201's set
    // Result: 101→{201} remains, 201→{} (empty set)
    expect(result.get(101)).toEqual(new Set([201]));
    expect(result.get(201)?.size ?? 0).toBe(0);
  });
});
