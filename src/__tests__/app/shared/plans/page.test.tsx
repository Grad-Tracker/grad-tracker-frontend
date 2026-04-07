import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const {
  mockFetchPublicSharedPlans,
  mockFetchStudentPlanSummariesForUser,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockFetchPublicSharedPlans: vi.fn(),
  mockFetchStudentPlanSummariesForUser: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/shared-plans", () => ({
  fetchPublicSharedPlans: mockFetchPublicSharedPlans,
  fetchStudentPlanSummariesForUser: mockFetchStudentPlanSummariesForUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/app/dashboard/planner/shared", () => ({
  SharedPlansIndex: ({ plans, ownPlans }: { plans: unknown[]; ownPlans: unknown[] }) => (
    <div>
      INDEX plans={plans.length} ownPlans={ownPlans.length}
    </div>
  ),
}));

import SharedPlansPage from "@/app/shared/plans/page";

describe("/shared/plans page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPublicSharedPlans.mockResolvedValue([{ shareToken: "shared-1" }]);
    mockFetchStudentPlanSummariesForUser.mockResolvedValue([{ planId: 1 }]);
  });

  it("passes public plans and signed-in user plans to the index", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });

    const element = await SharedPlansPage();
    render(element as React.ReactElement);

    expect(mockFetchPublicSharedPlans).toHaveBeenCalled();
    expect(mockFetchStudentPlanSummariesForUser).toHaveBeenCalledWith(
      expect.anything(),
      "user-1"
    );
    expect(screen.getByText("INDEX plans=1 ownPlans=1")).toBeInTheDocument();
  });

  it("falls back to no own plans when auth loading fails", async () => {
    mockCreateClient.mockRejectedValue(new Error("boom"));

    const element = await SharedPlansPage();
    render(element as React.ReactElement);

    expect(screen.getByText("INDEX plans=1 ownPlans=0")).toBeInTheDocument();
  });
});
