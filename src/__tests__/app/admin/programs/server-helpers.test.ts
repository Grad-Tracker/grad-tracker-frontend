import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import {
  fetchAssignedPrograms,
  fetchProgramWithBlocks,
  requireAdvisorAccess,
  requireAssignedProgram,
} from "@/app/admin/(protected)/programs/server-helpers";

function makeAwaitable(result: any) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
}

describe("admin program server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to /signin", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
      from: vi.fn(),
    };

    await expect(requireAdvisorAccess(supabase as any)).rejects.toThrow("REDIRECT:/signin");
    expect(mockRedirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects non-advisors to /dashboard", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "student-1", user_metadata: { role: "student" } } },
        })),
      },
      from: vi.fn(),
    };

    await expect(requireAdvisorAccess(supabase as any)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns advisor info when auth and staff lookup succeed", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "advisor-1", user_metadata: { role: "advisor" } } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { id: 12 }, error: null })),
      })),
    };

    await expect(requireAdvisorAccess(supabase as any)).resolves.toEqual({
      user: { id: "advisor-1", user_metadata: { role: "advisor" } },
      staffId: 12,
    });
  });

  it("redirects advisors without a staff row to /dashboard", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "advisor-1", user_metadata: { role: "advisor" } } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: null, error: { message: "missing" } })),
      })),
    };

    await expect(requireAdvisorAccess(supabase as any)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns an empty program list when advisor has no assignments and falls back to advisor_id", async () => {
    const supabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn((table: string) => {
        if (table !== "program_advisors") {
          throw new Error(`Unexpected table ${table}`);
        }

        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(),
        };
        let callCount = 0;
        chain.eq.mockImplementation(() => {
          callCount += 1;
          if (callCount === 1) {
            return chain;
          }
          if (callCount === 2) {
            return makeAwaitable({
              data: null,
              error: { message: 'column "staff_id" does not exist' },
            });
          }
          if (callCount === 3) {
            return chain;
          }
          return makeAwaitable({ data: [], error: null });
        });
        return chain;
      }),
    };

    await expect(fetchAssignedPrograms(supabase as any, 5)).resolves.toEqual([]);
  });

  it("throws when advisor assignments query fails with a real error", async () => {
    const supabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue(makeAwaitable({ data: null, error: { message: "boom" } })),
      })),
    };

    await expect(fetchAssignedPrograms(supabase as any, 5)).rejects.toThrow(
      "Failed to load advisor assignments: boom"
    );
  });

  it("redirects when advisor is not assigned to the requested program", async () => {
    const supabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(),
        };
        let callCount = 0;
        chain.eq.mockImplementation(() => {
          callCount += 1;
          return callCount >= 2 ? makeAwaitable({ data: [], error: null }) : chain;
        });
        return chain;
      }),
    };

    await expect(requireAssignedProgram(supabase as any, 7, 1)).rejects.toThrow(
      "REDIRECT:/admin/programs"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/admin/programs");
  });

  it("falls back when display_order is missing while loading program blocks", async () => {
    const from = vi.fn((table: string) => {
      if (table === "programs") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({
            data: { id: 1, name: "Computer Science", catalog_year: 2024, program_type: "MAJOR" },
            error: null,
          })),
        };
      }

      if (table === "program_requirement_blocks") {
        let selectCount = 0;
        return {
          select: vi.fn().mockImplementation(() => {
            selectCount += 1;
            const chain: any = {
              eq: vi.fn().mockReturnThis(),
              order: vi.fn(),
            };

            if (selectCount === 1) {
              let orderCount = 0;
              chain.order.mockImplementation(() => {
                orderCount += 1;
                if (orderCount === 1) return chain;
                return makeAwaitable({
                  data: null,
                  error: { message: 'column "display_order" does not exist' },
                });
              });
            } else {
              chain.order.mockReturnValue(makeAwaitable({ data: [], error: null }));
            }

            return chain;
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = {
      auth: { getUser: vi.fn() },
      from,
    };

    const result = await fetchProgramWithBlocks(supabase as any, 1);

    expect(result.program).toMatchObject({
      id: 1,
      name: "Computer Science",
      catalog_year: 2024,
      program_type: "MAJOR",
    });
    expect(result.blocks).toEqual([]);
    expect(from).toHaveBeenCalledTimes(3);
  });
});
