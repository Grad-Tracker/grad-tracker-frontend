import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePrereqsForCourses } from "@/lib/prereq";

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

const STUDENT_ID = 42;
const COURSE_ID = 101;

describe("evaluatePrereqsForCourses additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
  });

  it("returns unlocked when prereq sets exist but none have a valid id", async () => {
    mockFrom.mockReturnValueOnce(
      makeResolvingChain([{ id: undefined, course_id: COURSE_ID, set_type: "PREREQ" }])
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("throws when course_req_nodes query fails", async () => {
    const dbError = { message: "nodes failed" };

    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(makeResolvingChain(null, dbError));

    await expect(
      evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID)
    ).rejects.toEqual(dbError);
  });

  it("throws when course_req_atoms query fails", async () => {
    const dbError = { message: "atoms failed" };

    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(makeResolvingChain(null, dbError))
      .mockReturnValueOnce(makeResolvingChain([]));

    await expect(
      evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID)
    ).rejects.toEqual(dbError);
  });

  it("throws when both student history column lookups fail", async () => {
    const historyError = { message: "history failed" };

    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([
          { id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50 },
        ])
      )
      .mockReturnValueOnce(makeResolvingChain(null, historyError))
      .mockReturnValueOnce(makeResolvingChain(null, historyError));

    await expect(
      evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID)
    ).rejects.toEqual(historyError);
  });

  it("treats a prereq set with no nodes as unlocked", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(makeResolvingChain([]))
      .mockReturnValueOnce(makeResolvingChain([]))
      .mockReturnValueOnce(makeResolvingChain([]));

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
  });

  it("uses fallback roots when all nodes point to missing parents", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: 999 }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([
          { id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50 },
        ])
      )
      .mockReturnValueOnce(makeResolvingChain([]))
      .mockReturnValueOnce(
        makeResolvingChain([{ course_id: 50, subject: "CSCI", number: "240" }])
      );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({
      unlocked: false,
      summary: ["Requires CSCI 240"],
    });
  });

  it("fails safely for unsupported atom types", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 100, node_id: 10, atom_type: "GPA" }])
      )
      .mockReturnValueOnce(makeResolvingChain([]));

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({
      unlocked: false,
      summary: ["Unsupported prerequisite requirement"],
    });
  });

  it("fails safely when a COURSE atom is missing its required course id", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 100, node_id: 10, atom_type: "COURSE" }])
      )
      .mockReturnValueOnce(makeResolvingChain([]));

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({
      unlocked: false,
      summary: ["Missing prerequisite course mapping"],
    });
  });

  it("fails safely when an ATOM node has no atoms", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(makeResolvingChain([]))
      .mockReturnValueOnce(makeResolvingChain([]));

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({
      unlocked: false,
      summary: ["Missing prerequisite atom"],
    });
  });
});
