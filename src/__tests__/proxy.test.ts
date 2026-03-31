import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

import { proxy } from "@/proxy";

function makeRequest(path: string, cookie?: string) {
  const url = new URL(`http://localhost:3000${path}`);
  const cookieMap = new Map<string, string>();

  if (cookie) {
    cookie.split(";").forEach((entry) => {
      const [name, value] = entry.trim().split("=");
      if (name && value) {
        cookieMap.set(name, value);
      }
    });
  }

  return {
    headers: new Headers(cookie ? { cookie } : undefined),
    cookies: {
      get: (name: string) => {
        const value = cookieMap.get(name);
        return value ? { name, value } : undefined;
      },
      getAll: () =>
        Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => {
        cookieMap.set(name, value);
      },
    },
    nextUrl: Object.assign(url, {
      clone: () => new URL(url.toString()),
    }),
  } as any;
}

describe("proxy advisor signup gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
    });
  });

  it("redirects /admin/signup to /signup when advisor gate cookie is missing", async () => {
    const request = makeRequest("/admin/signup");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/signup?advisor=1"
    );
  });

  it("allows /admin/signup when advisor gate cookie is present", async () => {
    const request = makeRequest("/admin/signup", "advisor_signup_ok=1");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows /admin/signin without advisor gate cookie", async () => {
    const request = makeRequest("/admin/signin");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
