import { describe, it, expect } from "vitest";
import { computeProgressPct } from "@/lib/supabase/queries/advisor-students";

describe("computeProgressPct", () => {
  it("returns 0 when there are no required courses", () => {
    expect(computeProgressPct(new Set([1, 2]), new Set())).toBe(0);
  });

  it("returns 100 when all required courses are completed", () => {
    expect(computeProgressPct(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(100);
  });

  it("returns the rounded percentage of intersection", () => {
    // 2 of 3 required completed (one extra completed course is ignored)
    expect(computeProgressPct(new Set([1, 2, 99]), new Set([1, 2, 3]))).toBe(67);
  });

  it("returns 0 when there is no intersection", () => {
    expect(computeProgressPct(new Set([4, 5]), new Set([1, 2, 3]))).toBe(0);
  });
});

import { vi } from "vitest";
import { listStudentsForAdvisor } from "@/lib/supabase/queries/advisor-students";

function makeSupabase(handlers: Record<string, () => any>) {
  return {
    from: vi.fn((table: string) => {
      const handler = handlers[table];
      if (!handler) throw new Error(`Unexpected table: ${table}`);
      return handler();
    }),
  };
}

function chain(rows: unknown[]) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.then = (resolve: any) => resolve({ data: rows, error: null });
  return c;
}

describe("listStudentsForAdvisor", () => {
  it("returns empty array when advisor has no assigned programs", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([]),
    });
    const result = await listStudentsForAdvisor(supabase as any, 1);
    expect(result).toEqual([]);
  });

  it("returns one row per student with computed progress", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () =>
        chain([
          { student_id: 1, program_id: 10 },
          { student_id: 2, program_id: 10 },
        ]),
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
            breadth_package_id: "PKG_A",
          },
          {
            id: 2,
            first_name: "Alan",
            last_name: "Turing",
            email: "alan@example.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      programs: () =>
        chain([
          { id: 10, name: "Computer Science", program_type: "MAJOR" },
        ]),
      program_requirement_blocks: () =>
        chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
        ]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 1000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () => chain([]),
    });

    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      primaryProgramName: "Computer Science",
      majorProgressPct: 50, // 1 of 2
    });
    expect(rows[1].majorProgressPct).toBe(0); // Alan has no completed courses
  });

  it("falls back to advisor_id when staff_id column is missing", async () => {
    let call = 0;
    const supabase = makeSupabase({
      program_advisors: () => {
        call++;
        if (call === 1) {
          const c: any = chain([]);
          c.then = (resolve: any) =>
            resolve({
              data: null,
              error: { message: 'column "staff_id" does not exist' },
            });
          return c;
        }
        return chain([{ program_id: 10 }]);
      },
      student_programs: () => chain([]),
    });

    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows).toEqual([]);
  });

  it("throws when advisor assignment query fails for reasons other than missing staff_id column", async () => {
    const supabase = makeSupabase({
      program_advisors: () => {
        const c: any = chain([]);
        c.then = (resolve: any) =>
          resolve({
            data: null,
            error: { message: "permission denied" },
          });
        return c;
      },
    });

    await expect(listStudentsForAdvisor(supabase as any, 1)).rejects.toThrow(
      /Failed to load advisor assignments: permission denied/
    );
  });

  it("throws when both staff_id and advisor_id assignment lookups fail", async () => {
    let call = 0;
    const supabase = makeSupabase({
      program_advisors: () => {
        call++;
        const c: any = chain([]);
        if (call === 1) {
          c.then = (resolve: any) =>
            resolve({
              data: null,
              error: { message: 'column "staff_id" does not exist' },
            });
          return c;
        }

        c.then = (resolve: any) =>
          resolve({
            data: null,
            error: { message: "legacy lookup failed" },
          });
        return c;
      },
    });

    await expect(listStudentsForAdvisor(supabase as any, 1)).rejects.toThrow(
      /Failed to load advisor assignments: legacy lookup failed/
    );
  });
});

import { getStudentOverview } from "@/lib/supabase/queries/advisor-students";

describe("getStudentOverview", () => {
  it("returns profile, programs, gen-ed progress and plans", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            expected_graduation_semester: "Spring",
            expected_graduation_year: 2027,
            breadth_package_id: "PKG_A",
          },
        ]),
      student_programs: () =>
        chain([{ student_id: 1, program_id: 10 }]),
      programs: () =>
        chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () =>
        chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
        ]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 1000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () => chain([]),
      plans: () =>
        chain([
          {
            id: 50,
            name: "Plan A",
            description: "first try",
            created_at: "2026-04-01",
            updated_at: "2026-04-10",
          },
        ]),
      student_term_plan: () => chain([{ plan_id: 50, term_id: 7 }]),
    });

    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.profile.firstName).toBe("Ada");
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toMatchObject({
      id: 10,
      name: "CS",
      progressPct: 50,
      completedReqs: 1,
      totalReqs: 2,
    });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]).toMatchObject({ id: 50, name: "Plan A" });
  });
});

// ── Branch coverage — edge paths in both query functions ───────────────────────

describe("listStudentsForAdvisor branch paths", () => {
  it("returns empty array when advisor has programs but no students enrolled", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () => chain([]),
    });
    const result = await listStudentsForAdvisor(supabase as any, 1);
    expect(result).toEqual([]);
  });

  it("honours explicit completed=false in student_course_history", async () => {
    // Student with one completed row (completed=true) and one non-completed (false)
    // — only the true one should count toward progress.
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () => chain([{ student_id: 1, program_id: 10 }]),
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "X",
            email: "a@x.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      programs: () => chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () => chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
        ]),
      student_course_history: () =>
        chain([
          { student_id: 1, course_id: 1000, completed: true },
          { student_id: 1, course_id: 1001, completed: false },
        ]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () => chain([]),
    });
    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows[0].majorProgressPct).toBe(50); // 1 of 2
  });

  it("counts planned IN_PROGRESS and COMPLETED statuses, ignores others", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () => chain([{ student_id: 1, program_id: 10 }]),
      students: () =>
        chain([
          {
            id: 1,
            first_name: "Ada",
            last_name: "X",
            email: "a@x.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      programs: () => chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () => chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
          { block_id: 100, course_id: 1002 },
        ]),
      student_course_history: () => chain([]),
      student_planned_courses: () =>
        chain([
          { student_id: 1, course_id: 1000, status: "COMPLETED" },
          { student_id: 1, course_id: 1001, status: "IN_PROGRESS" },
          { student_id: 1, course_id: 1002, status: "PLANNED" }, // ignored
        ]),
      gen_ed_bucket_courses: () => chain([]),
    });
    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows[0].majorProgressPct).toBe(67); // 2 of 3
  });

  it("fetches gen-ed bucket courses only when at least one student has a breadth package", async () => {
    const supabase = makeSupabase({
      program_advisors: () => chain([{ program_id: 10 }]),
      student_programs: () => chain([{ student_id: 1, program_id: 10 }]),
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: "PKG_X",
          },
        ]),
      programs: () => chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () => chain([]),
      program_requirement_courses: () => chain([]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 2000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () =>
        chain([
          { bucket_id: 1, course_id: 2000 },
          { bucket_id: 1, course_id: 2001 },
        ]),
    });
    const rows = await listStudentsForAdvisor(supabase as any, 1);
    expect(rows[0].genEdProgressPct).toBe(50); // 1 of 2
  });
});

describe("getStudentOverview branch paths", () => {
  it("throws when the student row is not found", async () => {
    const supabase = makeSupabase({
      students: () => chain([]),
    });
    await expect(
      getStudentOverview(supabase as any, 1, 999)
    ).rejects.toThrow(/Student 999 not found/);
  });

  it("returns empty programs/gen-ed/plans for a student with no enrollments and no breadth package", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      student_programs: () => chain([]),
      student_course_history: () => chain([]),
      student_planned_courses: () => chain([]),
      plans: () => chain([]),
    });
    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.programs).toEqual([]);
    expect(result.genEdProgress).toEqual({ progressPct: 0, completed: 0, total: 0 });
    expect(result.plans).toEqual([]);
  });

  it("skips history rows with completed=false and counts planned IN_PROGRESS/COMPLETED", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      student_programs: () => chain([{ program_id: 10 }]),
      programs: () => chain([{ id: 10, name: "CS", program_type: "MAJOR" }]),
      program_requirement_blocks: () => chain([{ id: 100, program_id: 10 }]),
      program_requirement_courses: () =>
        chain([
          { block_id: 100, course_id: 1000 },
          { block_id: 100, course_id: 1001 },
          { block_id: 100, course_id: 1002 },
          { block_id: 100, course_id: 1003 },
        ]),
      student_course_history: () =>
        chain([
          { student_id: 1, course_id: 1000, completed: true },
          { student_id: 1, course_id: 9999, completed: false }, // skipped
        ]),
      student_planned_courses: () =>
        chain([
          { student_id: 1, course_id: 1001, status: "COMPLETED" },
          { student_id: 1, course_id: 1002, status: "IN_PROGRESS" },
          { student_id: 1, course_id: 1003, status: "PLANNED" }, // ignored
        ]),
      plans: () => chain([]),
    });
    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.programs[0]).toMatchObject({
      progressPct: 75,
      completedReqs: 3,
      totalReqs: 4,
    });
  });

  it("hydrates gen-ed progress when the student has a breadth package and completed matches", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: "PKG_X",
          },
        ]),
      student_programs: () => chain([]),
      student_course_history: () =>
        chain([{ student_id: 1, course_id: 2000, completed: true }]),
      student_planned_courses: () => chain([]),
      gen_ed_bucket_courses: () =>
        chain([
          { course_id: 2000 },
          { course_id: 2001 },
          { course_id: 2002 },
          { course_id: 2003 },
        ]),
      plans: () => chain([]),
    });
    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.genEdProgress).toEqual({
      progressPct: 25,
      completed: 1,
      total: 4,
    });
  });

  it("handles null data fallbacks on programs, requirement blocks, and plans", async () => {
    // Every intermediate query returns { data: null } — exercises the
    // `?? []` fallbacks on lines 228/236/320/338 of advisor-students.ts.
    function nullChain() {
      const c: any = {};
      c.select = vi.fn().mockReturnValue(c);
      c.eq = vi.fn().mockReturnValue(c);
      c.in = vi.fn().mockReturnValue(c);
      c.order = vi.fn().mockReturnValue(c);
      c.then = (resolve: any) => resolve({ data: null, error: null });
      return c;
    }
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      student_programs: () => chain([{ program_id: 10 }]),
      programs: () => nullChain(),
      program_requirement_blocks: () => nullChain(),
      program_requirement_courses: () => nullChain(),
      student_course_history: () => nullChain(),
      student_planned_courses: () => nullChain(),
      plans: () => nullChain(),
    });
    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.programs).toEqual([]);
    expect(result.plans).toEqual([]);
  });

  it("falls back to termCount=0 when a plan has no term_plan entries", async () => {
    const supabase = makeSupabase({
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      student_programs: () => chain([]),
      student_course_history: () => chain([]),
      student_planned_courses: () => chain([]),
      plans: () =>
        chain([
          {
            id: 50,
            name: "Plan A",
            description: null,
            created_at: "2026-04-01",
            updated_at: "2026-04-10",
          },
        ]),
      student_term_plan: () => chain([]), // no term entries for the plan
    });
    const result = await getStudentOverview(supabase as any, 1, 1);
    expect(result.plans[0].termCount).toBe(0);
  });

  it("omits term_plan lookup when the student has no plans", async () => {
    const fromSpy = vi.fn();
    const handlers: Record<string, () => any> = {
      students: () =>
        chain([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            email: "a@b.com",
            expected_graduation_semester: null,
            expected_graduation_year: null,
            breadth_package_id: null,
          },
        ]),
      student_programs: () => chain([]),
      student_course_history: () => chain([]),
      student_planned_courses: () => chain([]),
      plans: () => chain([]),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        fromSpy(table);
        const handler = handlers[table];
        if (!handler) throw new Error(`Unexpected table: ${table}`);
        return handler();
      }),
    };
    await getStudentOverview(supabase as any, 1, 1);
    expect(fromSpy).not.toHaveBeenCalledWith("student_term_plan");
  });
});
