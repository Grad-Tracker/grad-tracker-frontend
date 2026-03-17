import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockRedirect, mockedCreateClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockedCreateClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockedCreateClient,
}));

vi.mock("@/app/admin/programs/[programId]/ProgramAdminDetailClient", () => ({
  default: (props: any) => (
    <div>
      PROGRAM={props.initialProgram.name} BLOCKS={props.initialBlocks.length} FIRST=
      {props.initialBlocks[0]?.name ?? "none"}
    </div>
  ),
}));

import AdminProgramDetailPage from "@/app/admin/programs/[programId]/page";

function makeAwaitable(result: any) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
}

function createServerClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "advisor-auth-1", user_metadata: { role: "advisor" } } },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "staff") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: { id: 7 }, error: null })),
        };
      }

      if (table === "program_advisors") {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(),
        };
        let eqCount = 0;
        chain.eq.mockImplementation(() => {
          eqCount += 1;
          return eqCount >= 2
            ? makeAwaitable({ data: [{ program_id: 1 }], error: null })
            : chain;
        });
        return chain;
      }

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
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(),
        };
        let orderCount = 0;
        chain.order.mockImplementation(() => {
          orderCount += 1;
          return orderCount >= 2
            ? makeAwaitable({
                data: [
                  {
                    id: 10,
                    program_id: 1,
                    name: "Core",
                    rule: "ALL_OF",
                    n_required: null,
                    credits_required: null,
                    display_order: 1,
                    program_requirement_courses: [
                      {
                        course_id: 101,
                        courses: {
                          id: 101,
                          subject: "CS",
                          number: "101",
                          title: "Intro",
                          credits: 3,
                        },
                      },
                    ],
                  },
                ],
                error: null,
              })
            : chain;
        });
        return chain;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("/admin/programs/[programId] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the detail client with fetched blocks", async () => {
    mockedCreateClient.mockResolvedValue(createServerClient());

    const el = await AdminProgramDetailPage({
      params: Promise.resolve({ programId: "1" }),
    });
    render(el as React.ReactElement);

    expect(screen.getByText("PROGRAM=Computer Science BLOCKS=1 FIRST=Core")).toBeInTheDocument();
  });

  it("redirects students to /dashboard", async () => {
    const client = createServerClient();
    client.auth.getUser = vi.fn(async () => ({
      data: { user: { id: "student-1", user_metadata: { role: "student" } } },
    }));
    mockedCreateClient.mockResolvedValue(client);

    await expect(
      AdminProgramDetailPage({ params: Promise.resolve({ programId: "1" }) })
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
