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
});
