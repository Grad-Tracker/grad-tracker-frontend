import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchPublicSharedPlans } = vi.hoisted(() => ({
  mockFetchPublicSharedPlans: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/shared-plans", () => ({
  fetchPublicSharedPlans: mockFetchPublicSharedPlans,
}));

import { GET } from "@/app/api/shared-plans/route";

describe("/api/shared-plans route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPublicSharedPlans.mockResolvedValue([{ shareToken: "shared-1" }]);
  });

  it("uses the provided limit when it is valid", async () => {
    const response = await GET(new Request("https://example.com/api/shared-plans?limit=5"));
    const body = await response.json();

    expect(mockFetchPublicSharedPlans).toHaveBeenCalledWith(5);
    expect(body).toEqual({ plans: [{ shareToken: "shared-1" }] });
  });

  it("falls back to the default limit when the query is invalid", async () => {
    await GET(new Request("https://example.com/api/shared-plans?limit=-1"));

    expect(mockFetchPublicSharedPlans).toHaveBeenCalledWith(3);
  });
});
