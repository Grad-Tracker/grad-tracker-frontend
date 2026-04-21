import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../../helpers/mocks";

import {
  serverGetOrCreateTerm,
  serverVerifyPlanOwnership,
  serverCreatePlan,
  serverAddCourseToPlan,
  serverMoveCourseInPlan,
  serverRemoveCourseFromPlan,
  serverAddCourseToHistory,
  serverRenamePlan,
  serverClearPlanTerm,
  serverDuplicatePlan,
  serverDeletePlan,
  serverRemoveStudentProgram,
  serverListStudentPlans,
  serverGetStudentProgramCount,
  serverGetEnrolledProgramById,
  serverAddStudentProgram,
  serverRemoveCourseFromHistory,
  serverUpdateCourseHistory,
} from "@/lib/ai-advisor/plan-mutations";

type ChainSetup = (chain: ReturnType<typeof createChainMock>) => void;

function makeSupabase(tableHandlers: Record<string, ChainSetup | ChainSetup[]>) {
  const callCounts: Record<string, number> = {};
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const chain = createChainMock();
      const handlers = tableHandlers[table];
      if (!handlers) return chain;
      if (typeof handlers === "function") {
        handlers(chain);
      } else {
        const idx = callCounts[table] ?? 0;
        callCounts[table] = idx + 1;
        if (handlers[idx]) handlers[idx](chain);
      }
      return chain;
    }),
  };
}

function okThen(chain: ReturnType<typeof createChainMock>, data: unknown = null) {
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data, error: null }));
}

function errThen(chain: ReturnType<typeof createChainMock>, msg: string) {
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
    r({ data: null, error: new Error(msg) })
  );
}

// ---------------------------------------------------------------------------
// serverGetOrCreateTerm
// ---------------------------------------------------------------------------

describe("serverGetOrCreateTerm", () => {
  it("returns existing term id when term found", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
    });
    const result = await serverGetOrCreateTerm(supabase as any, "Fall", 2025);
    expect(result).toBe(5);
  });

  it("creates and returns new term id when not found", async () => {
    const supabase = makeSupabase({
      terms: [
        (chain) => {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        },
        (chain) => {
          chain.single = vi.fn().mockResolvedValue({ data: { id: 10 }, error: null });
        },
      ],
    });
    const result = await serverGetOrCreateTerm(supabase as any, "Spring", 2026);
    expect(result).toBe(10);
  });

  it("throws when select query errors", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") });
      },
    });
    await expect(serverGetOrCreateTerm(supabase as any, "Fall", 2025)).rejects.toThrow("DB error");
  });

  it("throws when insert fails", async () => {
    const supabase = makeSupabase({
      terms: [
        (chain) => {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        },
        (chain) => {
          chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("insert fail") });
        },
      ],
    });
    await expect(serverGetOrCreateTerm(supabase as any, "Fall", 2025)).rejects.toThrow("insert fail");
  });
});

// ---------------------------------------------------------------------------
// serverVerifyPlanOwnership
// ---------------------------------------------------------------------------

describe("serverVerifyPlanOwnership", () => {
  it("returns true when plan belongs to student", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
    });
    expect(await serverVerifyPlanOwnership(supabase as any, 1, 42)).toBe(true);
  });

  it("returns false when plan not found for student", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    expect(await serverVerifyPlanOwnership(supabase as any, 99, 42)).toBe(false);
  });

  it("throws when query errors", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("ownership check failed") });
      },
    });
    await expect(serverVerifyPlanOwnership(supabase as any, 1, 42)).rejects.toThrow("ownership check failed");
  });
});

// ---------------------------------------------------------------------------
// serverCreatePlan
// ---------------------------------------------------------------------------

describe("serverCreatePlan", () => {
  it("creates plan with no programs", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.single = vi.fn().mockResolvedValue({ data: { id: 7 }, error: null });
      },
    });
    const result = await serverCreatePlan(supabase as any, 1, "My Plan", []);
    expect(result).toEqual({ planId: 7 });
  });

  it("trims name and defaults empty to 'My Plan'", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.single = vi.fn().mockResolvedValue({ data: { id: 8 }, error: null });
      },
    });
    const result = await serverCreatePlan(supabase as any, 1, "   ", []);
    expect(result).toEqual({ planId: 8 });
  });

  it("creates plan with enrolled programs", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        okThen(chain, [{ program_id: 10 }, { program_id: 20 }]);
      },
      plans: (chain) => {
        chain.single = vi.fn().mockResolvedValue({ data: { id: 9 }, error: null });
      },
      plan_programs: (chain) => {
        okThen(chain, null);
      },
    });
    const result = await serverCreatePlan(supabase as any, 1, "Plan A", [10, 20]);
    expect(result).toEqual({ planId: 9 });
  });

  it("throws when program not enrolled", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        okThen(chain, [{ program_id: 10 }]); // only 10, not 20
      },
    });
    await expect(
      serverCreatePlan(supabase as any, 1, "Plan A", [10, 20])
    ).rejects.toThrow("do not belong to this student");
  });

  it("throws when plan insert fails", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("insert error") });
      },
    });
    await expect(serverCreatePlan(supabase as any, 1, "Plan", [])).rejects.toThrow("insert error");
  });
});

// ---------------------------------------------------------------------------
// serverAddCourseToPlan
// ---------------------------------------------------------------------------

describe("serverAddCourseToPlan", () => {
  it("returns alreadyPlanned: false when course is added successfully", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); // owned
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }); // exists
      },
      student_planned_courses: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); }, // no dup
        (chain) => { okThen(chain); }, // insert ok
      ],
      student_term_plan: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { term_id: 5 }, error: null }); }, // already linked
      ],
    });
    const result = await serverAddCourseToPlan(supabase as any, 1, 1, 100, "Fall", 2025);
    expect(result).toEqual({ alreadyPlanned: false });
  });

  it("returns alreadyPlanned: true when course already in plan/term", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_planned_courses: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { course_id: 100 }, error: null }); // dup
      },
    });
    const result = await serverAddCourseToPlan(supabase as any, 1, 1, 100, "Fall", 2025);
    expect(result).toEqual({ alreadyPlanned: true });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); // not owned
      },
    });
    await expect(
      serverAddCourseToPlan(supabase as any, 1, 99, 100, "Fall", 2025)
    ).rejects.toThrow("does not belong");
  });

  it("inserts term-plan link when not yet linked, then adds course", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_planned_courses: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); },
        (chain) => { okThen(chain); },
      ],
      student_term_plan: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); }, // not linked
        (chain) => { okThen(chain); }, // insert
      ],
    });
    const result = await serverAddCourseToPlan(supabase as any, 1, 1, 200, "Fall", 2025);
    expect(result).toEqual({ alreadyPlanned: false });
  });
});

// ---------------------------------------------------------------------------
// serverMoveCourseInPlan
// ---------------------------------------------------------------------------

describe("serverMoveCourseInPlan", () => {
  it("returns moved: false when course not in plan", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: (chain) => {
        okThen(chain, []); // not found
      },
    });
    const result = await serverMoveCourseInPlan(supabase as any, 1, 1, 100, "Spring", 2026);
    expect(result).toEqual({ moved: false });
  });

  it("returns moved: true when course already in target term", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: (chain) => {
        okThen(chain, [{ id: 50, term_id: 5 }]); // found
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }); // same term
      },
    });
    const result = await serverMoveCourseInPlan(supabase as any, 1, 1, 100, "Spring", 2026);
    expect(result).toEqual({ moved: true });
  });

  it("updates course term when moving to new term", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: [
        (chain) => { okThen(chain, [{ id: 50, term_id: 3 }]); }, // found in old term
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); }, // no dup in target
        (chain) => { okThen(chain); }, // update
      ],
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }); // different term
      },
      student_term_plan: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { term_id: 7 }, error: null }); }, // linked
      ],
    });
    const result = await serverMoveCourseInPlan(supabase as any, 1, 1, 100, "Fall", 2026);
    expect(result).toEqual({ moved: true });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(
      serverMoveCourseInPlan(supabase as any, 1, 99, 100, "Fall", 2025)
    ).rejects.toThrow("does not belong");
  });

  it("consolidates when duplicate exists in target term", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: [
        (chain) => { okThen(chain, [{ id: 50, term_id: 3 }]); }, // found in term 3
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 60 }, error: null }); }, // dup in target
        (chain) => { okThen(chain); }, // delete old term entries
      ],
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 7 }, error: null });
      },
      student_term_plan: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { term_id: 7 }, error: null }); },
      ],
    });
    const result = await serverMoveCourseInPlan(supabase as any, 1, 1, 100, "Fall", 2026);
    expect(result).toEqual({ moved: true });
  });
});

// ---------------------------------------------------------------------------
// serverRemoveCourseFromPlan
// ---------------------------------------------------------------------------

describe("serverRemoveCourseFromPlan", () => {
  it("returns removed: true when course is deleted", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: (chain) => {
        okThen(chain, [{ course_id: 100 }]);
      },
    });
    const result = await serverRemoveCourseFromPlan(supabase as any, 1, 1, 100);
    expect(result).toEqual({ removed: true });
  });

  it("returns removed: false when no rows deleted", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      student_planned_courses: (chain) => {
        okThen(chain, []);
      },
    });
    const result = await serverRemoveCourseFromPlan(supabase as any, 1, 1, 999);
    expect(result).toEqual({ removed: false });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverRemoveCourseFromPlan(supabase as any, 1, 99, 100)).rejects.toThrow("does not belong");
  });
});

// ---------------------------------------------------------------------------
// serverAddCourseToHistory
// ---------------------------------------------------------------------------

describe("serverAddCourseToHistory", () => {
  it("adds course to history successfully", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_course_history: (chain) => {
        okThen(chain);
      },
    });
    const result = await serverAddCourseToHistory(supabase as any, 1, 100, "Fall", 2024);
    expect(result).toEqual({ added: true, alreadyExists: false });
  });

  it("returns alreadyExists: true on duplicate constraint (23505)", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_course_history: (chain) => {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: { code: "23505", message: "duplicate" } })
        );
      },
    });
    const result = await serverAddCourseToHistory(supabase as any, 1, 100, "Fall", 2024);
    expect(result).toEqual({ added: false, alreadyExists: true });
  });

  it("throws on non-duplicate insert error", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_course_history: (chain) => {
        errThen(chain, "insert failed");
      },
    });
    await expect(
      serverAddCourseToHistory(supabase as any, 1, 100, "Fall", 2024)
    ).rejects.toThrow("insert failed");
  });

  it("trims and uppercases grade", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_course_history: (chain) => {
        okThen(chain);
      },
    });
    const result = await serverAddCourseToHistory(supabase as any, 1, 100, "Fall", 2024, "  a+  ");
    expect(result).toEqual({ added: true, alreadyExists: false });
  });

  it("handles null grade", async () => {
    const supabase = makeSupabase({
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_course_history: (chain) => {
        okThen(chain);
      },
    });
    const result = await serverAddCourseToHistory(supabase as any, 1, 100, "Fall", 2024, null, false);
    expect(result).toEqual({ added: true, alreadyExists: false });
  });
});

// ---------------------------------------------------------------------------
// serverRenamePlan
// ---------------------------------------------------------------------------

describe("serverRenamePlan", () => {
  it("renames plan successfully", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); },
        (chain) => { okThen(chain); },
      ],
    });
    const result = await serverRenamePlan(supabase as any, 1, 1, "New Name");
    expect(result).toEqual({ renamed: true });
  });

  it("throws when name is empty after trim", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
    });
    await expect(serverRenamePlan(supabase as any, 1, 1, "   ")).rejects.toThrow("cannot be empty");
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverRenamePlan(supabase as any, 1, 99, "New Name")).rejects.toThrow("does not belong");
  });
});

// ---------------------------------------------------------------------------
// serverClearPlanTerm
// ---------------------------------------------------------------------------

describe("serverClearPlanTerm", () => {
  it("clears courses in a term and returns count", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 5 }, error: null });
      },
      student_planned_courses: (chain) => {
        okThen(chain, [{ course_id: 100 }, { course_id: 200 }]);
      },
    });
    const result = await serverClearPlanTerm(supabase as any, 1, 1, "Fall", 2025);
    expect(result).toEqual({ cleared: true, coursesRemoved: 2 });
  });

  it("returns cleared: false when term not found", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      },
      terms: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    const result = await serverClearPlanTerm(supabase as any, 1, 1, "Summer", 2030);
    expect(result).toEqual({ cleared: false, coursesRemoved: 0 });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(
      serverClearPlanTerm(supabase as any, 1, 99, "Fall", 2025)
    ).rejects.toThrow("does not belong");
  });
});

// ---------------------------------------------------------------------------
// serverDuplicatePlan
// ---------------------------------------------------------------------------

describe("serverDuplicatePlan", () => {
  it("duplicates plan with no courses", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); }, // ownership
        (chain) => { chain.single = vi.fn().mockResolvedValue({ data: { id: 20 }, error: null }); }, // create new
      ],
      plan_programs: [
        (chain) => { okThen(chain, []); }, // no programs
      ],
      student_planned_courses: (chain) => {
        okThen(chain, []); // no courses
      },
    });
    const result = await serverDuplicatePlan(supabase as any, 1, 1, "Copy");
    expect(result).toEqual({ planId: 20, coursesCloned: 0 });
  });

  it("defaults empty name to 'Copy of plan'", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); },
        (chain) => { chain.single = vi.fn().mockResolvedValue({ data: { id: 21 }, error: null }); },
      ],
      plan_programs: (chain) => { okThen(chain, []); },
      student_planned_courses: (chain) => { okThen(chain, []); },
    });
    const result = await serverDuplicatePlan(supabase as any, 1, 1, "   ");
    expect(result.planId).toBe(21);
  });

  it("clones courses to new plan", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); },
        (chain) => { chain.single = vi.fn().mockResolvedValue({ data: { id: 22 }, error: null }); },
      ],
      plan_programs: [
        (chain) => { okThen(chain, [{ program_id: 10 }]); }, // source has program
        (chain) => { okThen(chain); }, // link programs to new plan
      ],
      student_planned_courses: [
        (chain) => { okThen(chain, [{ course_id: 100, term_id: 5, status: "PLANNED" }]); }, // source courses
        (chain) => { okThen(chain); }, // insert clone
      ],
      student_term_plan: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); }, // not linked
        (chain) => { okThen(chain); }, // insert link
      ],
    });
    const result = await serverDuplicatePlan(supabase as any, 1, 1, "My Copy");
    expect(result).toEqual({ planId: 22, coursesCloned: 1 });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverDuplicatePlan(supabase as any, 1, 99, "Copy")).rejects.toThrow("does not belong");
  });
});

// ---------------------------------------------------------------------------
// serverDeletePlan
// ---------------------------------------------------------------------------

describe("serverDeletePlan", () => {
  it("deletes plan and returns deleted: true", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); },
        (chain) => { okThen(chain); }, // delete plans row
      ],
      student_planned_courses: (chain) => { okThen(chain); },
      student_term_plan: (chain) => { okThen(chain); },
      plan_programs: (chain) => { okThen(chain); },
    });
    const result = await serverDeletePlan(supabase as any, 1, 1);
    expect(result).toEqual({ deleted: true });
  });

  it("throws when plan not owned", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverDeletePlan(supabase as any, 1, 99)).rejects.toThrow("does not belong");
  });

  it("throws when final delete errors", async () => {
    const supabase = makeSupabase({
      plans: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }); },
        (chain) => { errThen(chain, "delete failed"); },
      ],
      student_planned_courses: (chain) => { okThen(chain); },
      student_term_plan: (chain) => { okThen(chain); },
      plan_programs: (chain) => { okThen(chain); },
    });
    await expect(serverDeletePlan(supabase as any, 1, 1)).rejects.toThrow("delete failed");
  });
});

// ---------------------------------------------------------------------------
// serverRemoveStudentProgram
// ---------------------------------------------------------------------------

describe("serverRemoveStudentProgram", () => {
  it("removes program when enrolled", async () => {
    const supabase = makeSupabase({
      student_programs: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { student_id: 1 }, error: null }); }, // enrolled check
        (chain) => { okThen(chain); }, // delete enrollment
      ],
      plans: (chain) => { okThen(chain, [{ id: 5 }]); }, // student plans
      plan_programs: (chain) => { okThen(chain, [{ plan_id: 5 }]); }, // unlink plans from program
    });
    const result = await serverRemoveStudentProgram(supabase as any, 1, 10);
    expect(result.removed).toBe(true);
    expect(result.programId).toBe(10);
    expect(result.plansUnlinked).toBe(1);
  });

  it("throws when not enrolled", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverRemoveStudentProgram(supabase as any, 1, 99)).rejects.toThrow("not enrolled");
  });

  it("handles student with no plans", async () => {
    const supabase = makeSupabase({
      student_programs: [
        (chain) => { chain.maybeSingle = vi.fn().mockResolvedValue({ data: { student_id: 1 }, error: null }); },
        (chain) => { okThen(chain); }, // delete enrollment
      ],
      plans: (chain) => { okThen(chain, []); }, // no plans
    });
    const result = await serverRemoveStudentProgram(supabase as any, 1, 10);
    expect(result.plansUnlinked).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// serverListStudentPlans
// ---------------------------------------------------------------------------

describe("serverListStudentPlans", () => {
  it("returns mapped plans sorted by updated_at", async () => {
    const supabase = makeSupabase({
      plans: (chain) => {
        okThen(chain, [
          { id: 1, name: "Plan A", updated_at: "2025-01-01" },
          { id: 2, name: "Plan B", updated_at: "2025-02-01" },
        ]);
      },
    });
    const result = await serverListStudentPlans(supabase as any, 1);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, name: "Plan A", updatedAt: "2025-01-01" });
    expect(result[1]).toEqual({ id: 2, name: "Plan B", updatedAt: "2025-02-01" });
  });

  it("returns empty array when no plans", async () => {
    const supabase = makeSupabase({
      plans: (chain) => { okThen(chain, []); },
    });
    const result = await serverListStudentPlans(supabase as any, 1);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const supabase = makeSupabase({
      plans: (chain) => { errThen(chain, "list failed"); },
    });
    await expect(serverListStudentPlans(supabase as any, 1)).rejects.toThrow("list failed");
  });
});

// ---------------------------------------------------------------------------
// serverGetStudentProgramCount
// ---------------------------------------------------------------------------

describe("serverGetStudentProgramCount", () => {
  it("returns the program count", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ count: 3, data: null, error: null })
        );
      },
    });
    const result = await serverGetStudentProgramCount(supabase as any, 1);
    expect(result).toBe(3);
  });

  it("returns 0 when count is null", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ count: null, data: null, error: null })
        );
      },
    });
    const result = await serverGetStudentProgramCount(supabase as any, 1);
    expect(result).toBe(0);
  });

  it("throws when query errors", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ count: null, data: null, error: new Error("count failed") })
        );
      },
    });
    await expect(serverGetStudentProgramCount(supabase as any, 1)).rejects.toThrow("count failed");
  });
});

// ---------------------------------------------------------------------------
// serverGetEnrolledProgramById
// ---------------------------------------------------------------------------

describe("serverGetEnrolledProgramById", () => {
  it("returns program details when enrolled", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            program_id: 10,
            programs: { id: 10, name: "Computer Science", program_type: "MAJOR" },
          },
          error: null,
        });
      },
    });
    const result = await serverGetEnrolledProgramById(supabase as any, 1, 10);
    expect(result).toEqual({ id: 10, name: "Computer Science", programType: "MAJOR" });
  });

  it("returns null when not enrolled", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    const result = await serverGetEnrolledProgramById(supabase as any, 1, 99);
    expect(result).toBeNull();
  });

  it("returns null when programs join is null", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { program_id: 10, programs: null },
          error: null,
        });
      },
    });
    const result = await serverGetEnrolledProgramById(supabase as any, 1, 10);
    expect(result).toBeNull();
  });

  it("throws when query errors", async () => {
    const supabase = makeSupabase({
      student_programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("lookup failed") });
      },
    });
    await expect(serverGetEnrolledProgramById(supabase as any, 1, 10)).rejects.toThrow("lookup failed");
  });
});

// ---------------------------------------------------------------------------
// serverAddStudentProgram
// ---------------------------------------------------------------------------

describe("serverAddStudentProgram", () => {
  it("adds program when it exists in catalog", async () => {
    const supabase = makeSupabase({
      programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 10 }, error: null });
      },
      student_programs: (chain) => {
        okThen(chain);
      },
    });
    const result = await serverAddStudentProgram(supabase as any, 1, 10);
    expect(result).toEqual({ added: true, alreadyEnrolled: false, programId: 10 });
  });

  it("returns alreadyEnrolled: true on duplicate (23505)", async () => {
    const supabase = makeSupabase({
      programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 10 }, error: null });
      },
      student_programs: (chain) => {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: { code: "23505", message: "dup" } })
        );
      },
    });
    const result = await serverAddStudentProgram(supabase as any, 1, 10);
    expect(result).toEqual({ added: false, alreadyEnrolled: true, programId: 10 });
  });

  it("throws when program does not exist in catalog", async () => {
    const supabase = makeSupabase({
      programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      },
    });
    await expect(serverAddStudentProgram(supabase as any, 1, 999)).rejects.toThrow("does not exist");
  });

  it("throws on non-duplicate insert error", async () => {
    const supabase = makeSupabase({
      programs: (chain) => {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 10 }, error: null });
      },
      student_programs: (chain) => {
        errThen(chain, "insert error");
      },
    });
    await expect(serverAddStudentProgram(supabase as any, 1, 10)).rejects.toThrow("insert error");
  });
});

// ---------------------------------------------------------------------------
// serverRemoveCourseFromHistory
// ---------------------------------------------------------------------------

describe("serverRemoveCourseFromHistory", () => {
  it("removes course from history", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { okThen(chain); },
    });
    const result = await serverRemoveCourseFromHistory(supabase as any, 1, 100);
    expect(result).toEqual({ removed: true });
  });

  it("throws when delete errors", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { errThen(chain, "delete failed"); },
    });
    await expect(serverRemoveCourseFromHistory(supabase as any, 1, 100)).rejects.toThrow("delete failed");
  });
});

// ---------------------------------------------------------------------------
// serverUpdateCourseHistory
// ---------------------------------------------------------------------------

describe("serverUpdateCourseHistory", () => {
  it("returns updated: false when no updates provided", async () => {
    const supabase = makeSupabase({});
    const result = await serverUpdateCourseHistory(supabase as any, 1, 100, {});
    expect(result).toEqual({ updated: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("updates grade (uppercase, trimmed)", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { okThen(chain); },
    });
    const result = await serverUpdateCourseHistory(supabase as any, 1, 100, { grade: " a+ " });
    expect(result).toEqual({ updated: true });
  });

  it("sets grade to null when grade is empty string", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { okThen(chain); },
    });
    const result = await serverUpdateCourseHistory(supabase as any, 1, 100, { grade: "" });
    expect(result).toEqual({ updated: true });
  });

  it("updates completed flag", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { okThen(chain); },
    });
    const result = await serverUpdateCourseHistory(supabase as any, 1, 100, { completed: false });
    expect(result).toEqual({ updated: true });
  });

  it("throws when update errors", async () => {
    const supabase = makeSupabase({
      student_course_history: (chain) => { errThen(chain, "update failed"); },
    });
    await expect(
      serverUpdateCourseHistory(supabase as any, 1, 100, { completed: true })
    ).rejects.toThrow("update failed");
  });
});
