import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluatePrereqsForCourses } from "@/lib/prereq";

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ---------------------------------------------------------------------------
// Helper: create a chainable mock that resolves to { data, error }
// ---------------------------------------------------------------------------
function makeResolvingChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  // Make the chain thenable so `await supabase.from(...).select(...).eq(...)` works
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    resolve({ data, error })
  );
  return chain;
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const STUDENT_ID = 42;
const COURSE_ID = 101;

/** Set up mockFrom for the full happy path:
 *   1. course_req_sets
 *   2. course_req_nodes
 *   3. course_req_atoms  (Promise.all first branch)
 *   4. v_student_course_progress (Promise.all second branch)
 */
function setupMocks(
  reqSets: unknown[],
  reqNodes: unknown[],
  reqAtoms: unknown[],
  historyRows: unknown[]
) {
  mockFrom
    .mockReturnValueOnce(makeResolvingChain(reqSets))        // course_req_sets
    .mockReturnValueOnce(makeResolvingChain(reqNodes))       // course_req_nodes
    .mockReturnValueOnce(makeResolvingChain(reqAtoms))       // course_req_atoms
    .mockReturnValueOnce(makeResolvingChain(historyRows));   // v_student_course_progress
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluatePrereqsForCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Empty input
  it("returns empty Map immediately when courseIds is empty (no DB calls)", async () => {
    const result = await evaluatePrereqsForCourses([], STUDENT_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // 2. No req sets for course → defaults to unlocked=true
  it("returns unlocked=true when course has no prereq sets", async () => {
    mockFrom.mockReturnValueOnce(makeResolvingChain([])); // course_req_sets returns empty

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
    // Should only call from() once (course_req_sets), then return early
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  // 3. COURSE atom — student completed course → unlocked=true
  it("returns unlocked=true when student has completed the required course", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }],
      [{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: null }],
      [{ course_id: 50, grade: "A", completed: true }]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
  });

  // 4. COURSE atom — student has NOT completed → unlocked=false, summary present
  it("returns unlocked=false when student has NOT completed the required course", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }],
      [{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: null }],
      [] // no history
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);
    const evaluation = result.get(COURSE_ID);

    expect(evaluation?.unlocked).toBe(false);
    expect(evaluation?.summary).toContain("Requires course 50");
  });

  // 5. COURSE atom with min_grade="B", student grade="A" → unlocked (meets minimum)
  it("returns unlocked=true when student grade meets the minimum grade requirement", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }],
      [{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: "B" }],
      [{ course_id: 50, grade: "A", completed: true }]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
  });

  // 6. COURSE atom with min_grade="B", student grade="C" → locked (C < B)
  it("returns unlocked=false when student grade is below the minimum grade requirement", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }],
      [{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: "B" }],
      [{ course_id: 50, grade: "C", completed: true }]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);
    const evaluation = result.get(COURSE_ID);

    expect(evaluation?.unlocked).toBe(false);
    expect(evaluation?.summary).toContain("Requires course 50 (B or better)");
  });

  // 7. CONSENT atom → locked, summary=["Instructor consent required"]
  it("returns unlocked=false with consent message for CONSENT atom type", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }],
      [{ id: 100, node_id: 10, atom_type: "CONSENT", required_course_id: null, min_grade: null }],
      []
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);
    const evaluation = result.get(COURSE_ID);

    expect(evaluation?.unlocked).toBe(false);
    expect(evaluation?.summary).toEqual(["Instructor consent required"]);
  });

  // 8. AND node with 2 children: both pass → unlocked=true
  it("AND node returns unlocked=true when all children pass", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [
        { id: 10, req_set_id: 1, node_type: "AND", parent_id: null },
        { id: 11, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
        { id: 12, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
      ],
      [
        { id: 100, node_id: 11, atom_type: "COURSE", required_course_id: 50, min_grade: null },
        { id: 101, node_id: 12, atom_type: "COURSE", required_course_id: 60, min_grade: null },
      ],
      [
        { course_id: 50, grade: "A", completed: true },
        { course_id: 60, grade: "B", completed: true },
      ]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
  });

  // 9. AND node with 2 children: one fails → locked
  it("AND node returns unlocked=false when one child fails", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [
        { id: 10, req_set_id: 1, node_type: "AND", parent_id: null },
        { id: 11, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
        { id: 12, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
      ],
      [
        { id: 100, node_id: 11, atom_type: "COURSE", required_course_id: 50, min_grade: null },
        { id: 101, node_id: 12, atom_type: "COURSE", required_course_id: 60, min_grade: null },
      ],
      [
        { course_id: 50, grade: "A", completed: true },
        // course 60 NOT completed
      ]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);
    const evaluation = result.get(COURSE_ID);

    expect(evaluation?.unlocked).toBe(false);
    expect(evaluation?.summary).toContain("Requires course 60");
    // course 50 was completed — should NOT appear in summary
    expect(evaluation?.summary).not.toContain("Requires course 50");
  });

  // 10. OR node with 2 children: one passes → unlocked=true
  it("OR node returns unlocked=true when at least one child passes", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [
        { id: 10, req_set_id: 1, node_type: "OR", parent_id: null },
        { id: 11, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
        { id: 12, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
      ],
      [
        { id: 100, node_id: 11, atom_type: "COURSE", required_course_id: 50, min_grade: null },
        { id: 101, node_id: 12, atom_type: "COURSE", required_course_id: 60, min_grade: null },
      ],
      [
        { course_id: 50, grade: "A", completed: true },
        // course 60 NOT completed — but OR only needs one
      ]
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);

    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
  });

  // 11. OR node with 2 children: both fail → locked
  it("OR node returns unlocked=false when all children fail", async () => {
    setupMocks(
      [{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }],
      [
        { id: 10, req_set_id: 1, node_type: "OR", parent_id: null },
        { id: 11, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
        { id: 12, req_set_id: 1, node_type: "ATOM", parent_id: 10 },
      ],
      [
        { id: 100, node_id: 11, atom_type: "COURSE", required_course_id: 50, min_grade: null },
        { id: 101, node_id: 12, atom_type: "COURSE", required_course_id: 60, min_grade: null },
      ],
      [] // neither course completed
    );

    const result = await evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID);
    const evaluation = result.get(COURSE_ID);

    expect(evaluation?.unlocked).toBe(false);
    expect(evaluation?.summary.length).toBeGreaterThan(0);
  });

  // 12. DB error on course_req_sets → throws
  it("throws when course_req_sets DB query returns an error", async () => {
    const dbError = { message: "DB connection failed", code: "500" };
    mockFrom.mockReturnValueOnce(makeResolvingChain(null, dbError));

    await expect(evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID)).rejects.toEqual(dbError);
  });

  // Bonus: multiple courses, only one has prereqs
  it("handles multiple courses where only one has prereq sets", async () => {
    const COURSE_ID_2 = 202;

    mockFrom
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }]) // only course 101 has a set
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }])
      )
      .mockReturnValueOnce(
        makeResolvingChain([{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: null }])
      )
      .mockReturnValueOnce(makeResolvingChain([])); // no history

    const result = await evaluatePrereqsForCourses([COURSE_ID, COURSE_ID_2], STUDENT_ID);

    // Course 101 should be locked (prereq not met)
    expect(result.get(COURSE_ID)?.unlocked).toBe(false);
    // Course 202 has no req set — should default to unlocked=true
    expect(result.get(COURSE_ID_2)).toEqual({ unlocked: true, summary: [] });
  });

  // Bonus: student progress query errors are surfaced
  it("throws when student course progress query returns an error", async () => {
    const columnError = { message: "column does not exist", code: "42703" };

    mockFrom
      .mockReturnValueOnce(makeResolvingChain([{ id: 1, course_id: COURSE_ID, set_type: "PREREQ" }]))
      .mockReturnValueOnce(makeResolvingChain([{ id: 10, req_set_id: 1, node_type: "ATOM", parent_id: null }]))
      .mockReturnValueOnce(makeResolvingChain([{ id: 100, node_id: 10, atom_type: "COURSE", required_course_id: 50, min_grade: null }]))
      // v_student_course_progress returns an error
      .mockReturnValueOnce(makeResolvingChain(null, columnError));

    await expect(evaluatePrereqsForCourses([COURSE_ID], STUDENT_ID)).rejects.toEqual(columnError);
  });

  // Bonus: duplicate course IDs in input are deduplicated
  it("deduplicates course IDs passed as input", async () => {
    mockFrom.mockReturnValueOnce(makeResolvingChain([])); // no req sets

    const result = await evaluatePrereqsForCourses([COURSE_ID, COURSE_ID, COURSE_ID], STUDENT_ID);

    // Result should have exactly one entry
    expect(result.size).toBe(1);
    expect(result.get(COURSE_ID)).toEqual({ unlocked: true, summary: [] });
    // Only one DB call (course_req_sets) since no sets found
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
