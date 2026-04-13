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
});
