import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockRedirect, mockedCreateClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockedCreateClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockedCreateClient,
}));

import AdminProgramsPage from "@/app/admin/(protected)/programs/page";

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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(
            makeAwaitable({
              data: [{ program_id: 1 }, { program_id: 2 }],
              error: null,
            })
          ),
        };
      }

      if (table === "programs") {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn(),
        };
        let orderCount = 0;
        chain.order.mockImplementation(() => {
          orderCount += 1;
          return orderCount >= 2
            ? makeAwaitable({
                data: [
                  { id: 1, name: "Computer Science", catalog_year: 2024, program_type: "MAJOR" },
                  { id: 2, name: "Cybersecurity", catalog_year: 2025, program_type: "GRADUATE" },
                ],
                error: null,
              })
            : chain;
        });
        return chain;
      }

      if (table === "program_requirement_blocks") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnValue(
            makeAwaitable({
              data: [
                { id: 10, program_id: 1 },
                { id: 11, program_id: 1 },
                { id: 20, program_id: 2 },
              ],
              error: null,
            })
          ),
        };
      }

      if (table === "program_requirement_courses") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnValue(
            makeAwaitable({
              data: [
                { block_id: 10, course_id: 101 },
                { block_id: 10, course_id: 102 },
                { block_id: 11, course_id: 103 },
                { block_id: 20, course_id: 201 },
                { block_id: 20, course_id: 202 },
              ],
              error: null,
            })
          ),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("/admin/programs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only programs assigned to the advisor", async () => {
    mockedCreateClient.mockResolvedValue(createServerClient());

    const el = await AdminProgramsPage();
    renderWithChakra(el as React.ReactElement);

    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Cybersecurity")).toBeInTheDocument();
    expect(screen.getByText("2 requirement blocks")).toBeInTheDocument();
    expect(screen.getByText("3 courses")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /computer science/i })).toHaveAttribute(
      "href",
      "/admin/programs/1"
    );
  });

  it("redirects students to /dashboard", async () => {
    const client = createServerClient();
    client.auth.getUser = vi.fn(async () => ({
      data: { user: { id: "student-1", user_metadata: { role: "student" } } },
    }));
    mockedCreateClient.mockResolvedValue(client);

    await expect(AdminProgramsPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
