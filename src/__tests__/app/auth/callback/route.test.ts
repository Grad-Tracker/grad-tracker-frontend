import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockExchangeCodeForSession,
  mockGetUser,
  mockedCreateClient,
} = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockedCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockedCreateClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
      },
    });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
    });
  });

  it("redirects advisors to /admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });

    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=test-code")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("redirects students to the next param when provided", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?code=test-code&next=/dashboard/planner"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/planner"
    );
  });

  it("defaults students to /dashboard when next is missing", async () => {
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=test-code")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard"
    );
  });
});
