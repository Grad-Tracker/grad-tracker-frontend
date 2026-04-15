import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { redirect } from "next/navigation";
import { requireAdvisorCanViewStudent } from "@/app/admin/(protected)/students/server-helpers";

function makeSupabase(
  advisorProgramIds: unknown[],
  studentProgramOverlap: unknown[]
) {
  const createChain = (resolveValue: unknown[]) => {
    const chain: any = {
      select: vi.fn(function () {
        return chain;
      }),
      eq: vi.fn(function () {
        return chain;
      }),
      in: vi.fn(function () {
        return chain;
      }),
      limit: vi.fn(function () {
        return chain;
      }),
      then: function (onFulfilled: any) {
        return Promise.resolve({ data: resolveValue, error: null }).then(onFulfilled);
      },
    };
    return chain;
  };

  const fromMock = vi.fn((table: string) => {
    if (table === "program_advisors") {
      return createChain(advisorProgramIds);
    } else if (table === "student_programs") {
      return createChain(studentProgramOverlap);
    }
    return createChain([]);
  });

  return { from: fromMock };
}

describe("requireAdvisorCanViewStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns silently when the student is enrolled in one of the advisor's programs", async () => {
    const supabase = makeSupabase(
      [{ program_id: 7 }], // advisor has program 7
      [{ student_id: 42, program_id: 7 }] // student is in program 7
    );
    await requireAdvisorCanViewStudent(supabase as any, 1, 42);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /admin/students when student is not in any of the advisor's programs", async () => {
    const supabase = makeSupabase(
      [{ program_id: 7 }], // advisor has program 7
      [] // but student is not in any of them
    );
    await expect(
      requireAdvisorCanViewStudent(supabase as any, 1, 42)
    ).rejects.toThrow("REDIRECT:/admin/students");
  });

  it("falls back to the legacy advisor_id column when staff_id query errors", async () => {
    // Primary staff_id query returns an error; the helper must retry against
    // the legacy advisor_id column and succeed.
    let call = 0;
    const createChain = (resolveValue: unknown[], error: unknown = null) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (onFulfilled: any) =>
          Promise.resolve({ data: resolveValue, error }).then(onFulfilled),
      };
      return chain;
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "program_advisors") {
          call++;
          if (call === 1) return createChain([], new Error("missing staff_id column"));
          return createChain([{ program_id: 7 }]);
        }
        // student_programs: confirm overlap
        return createChain([{ student_id: 42, program_id: 7 }]);
      }),
    };
    await requireAdvisorCanViewStudent(supabase as any, 1, 42);
    expect(redirect).not.toHaveBeenCalled();
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it("redirects when both staff_id and advisor_id legacy query return no programs", async () => {
    const createChain = (resolveValue: unknown[], error: unknown = null) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (onFulfilled: any) =>
          Promise.resolve({ data: resolveValue, error }).then(onFulfilled),
      };
      return chain;
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "program_advisors") {
          return createChain([], new Error("missing column"));
        }
        return createChain([]);
      }),
    };
    await expect(
      requireAdvisorCanViewStudent(supabase as any, 1, 42)
    ).rejects.toThrow("REDIRECT:/admin/students");
  });
});
