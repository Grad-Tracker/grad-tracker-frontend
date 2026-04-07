import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const {
  mockFetchSharedPlanByToken,
  mockFetchStudentPlanSummariesForUser,
  mockFetchOwnedPlanForUser,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockFetchSharedPlanByToken: vi.fn(),
  mockFetchStudentPlanSummariesForUser: vi.fn(),
  mockFetchOwnedPlanForUser: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/shared-plans", () => ({
  fetchSharedPlanByToken: mockFetchSharedPlanByToken,
  fetchStudentPlanSummariesForUser: mockFetchStudentPlanSummariesForUser,
  fetchOwnedPlanForUser: mockFetchOwnedPlanForUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/app/dashboard/planner/shared", () => ({
  SharedPlanUnavailable: () => <div>UNAVAILABLE</div>,
  SharedPlanView: ({ plan, ownPlans, comparisonPlan, showPlannerCta }: any) => (
    <div>
      SHARED PLAN VIEW token={plan.shareToken} name={plan.planName} ownPlans={ownPlans.length} cta=
      {String(showPlannerCta)} comparison={comparisonPlan?.planId ?? "none"}
    </div>
  ),
}));

import SharedPlanPage, { generateMetadata } from "@/app/shared/plan/[shareToken]/page";

describe("/shared/plan/[shareToken] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    mockFetchStudentPlanSummariesForUser.mockResolvedValue([]);
    mockFetchOwnedPlanForUser.mockResolvedValue(null);
  });

  it("renders the shared plan when params is a promise", async () => {
    mockFetchSharedPlanByToken.mockResolvedValue({
      shareToken: "abc123",
      planId: 7,
      planName: "Sample Plan",
      description: null,
      ownerLabel: "Shared plan",
      studentFirstName: "Avery",
      programNames: ["B.S. Computer Science"],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
      completedCredits: 0,
      expiresAt: null,
    });

    const element = await SharedPlanPage({
      params: Promise.resolve({ shareToken: "abc123" }),
      searchParams: Promise.resolve({}),
    });

    render(element as React.ReactElement);

    expect(mockFetchSharedPlanByToken).toHaveBeenCalledWith("abc123");
    expect(
      screen.getByText("SHARED PLAN VIEW token=abc123 name=Sample Plan ownPlans=0 cta=false comparison=none")
    ).toBeInTheDocument();
  });

  it("returns unavailable when the shared plan cannot be found", async () => {
    mockFetchSharedPlanByToken.mockResolvedValue(null);

    const element = await SharedPlanPage({
      params: Promise.resolve({ shareToken: "missing-token" }),
      searchParams: Promise.resolve({}),
    });

    render(element as React.ReactElement);

    expect(screen.getByText("UNAVAILABLE")).toBeInTheDocument();
  });

  it("generates metadata using the promised share token", async () => {
    mockFetchSharedPlanByToken.mockResolvedValue({
      shareToken: "abc123",
      planId: 7,
      planName: "Sample Plan",
      description: null,
      ownerLabel: "Shared plan",
      studentFirstName: "Avery",
      programNames: ["B.S. Computer Science"],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
      completedCredits: 0,
      expiresAt: null,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ shareToken: "abc123" }),
    });

    expect(mockFetchSharedPlanByToken).toHaveBeenCalledWith("abc123");
    expect(metadata.title).toBe("Sample Plan | Shared Plan | Grad Tracker");
  });

  it("renders planner comparison controls when the signed-in user has plans", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    });
    mockFetchSharedPlanByToken.mockResolvedValue({
      shareToken: "abc123",
      planId: 7,
      planName: "Sample Plan",
      description: null,
      ownerLabel: "Shared plan",
      studentFirstName: "Avery",
      programNames: ["B.S. Computer Science"],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
      completedCredits: 0,
      expiresAt: null,
    });
    mockFetchStudentPlanSummariesForUser.mockResolvedValue([{ planId: 12 }]);
    mockFetchOwnedPlanForUser.mockResolvedValue({ planId: 12 });

    const element = await SharedPlanPage({
      params: Promise.resolve({ shareToken: "abc123" }),
      searchParams: Promise.resolve({ myPlan: "12" }),
    });

    render(element as React.ReactElement);

    expect(mockFetchStudentPlanSummariesForUser).toHaveBeenCalledWith(expect.anything(), "user-123");
    expect(mockFetchOwnedPlanForUser).toHaveBeenCalledWith(expect.anything(), "user-123", 12);
    expect(
      screen.getByText("SHARED PLAN VIEW token=abc123 name=Sample Plan ownPlans=1 cta=true comparison=12")
    ).toBeInTheDocument();
  });

  it("falls back to no user-specific data when session lookup throws", async () => {
    mockCreateClient.mockRejectedValue(new Error("session failed"));
    mockFetchSharedPlanByToken.mockResolvedValue({
      shareToken: "abc123",
      planId: 7,
      planName: "Sample Plan",
      description: null,
      ownerLabel: "Shared plan",
      studentFirstName: "Avery",
      programNames: ["B.S. Computer Science"],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
      completedCredits: 0,
      expiresAt: null,
    });

    const element = await SharedPlanPage({
      params: Promise.resolve({ shareToken: "abc123" }),
      searchParams: Promise.resolve({ myPlan: "not-a-number" }),
    });

    render(element as React.ReactElement);

    expect(
      screen.getByText("SHARED PLAN VIEW token=abc123 name=Sample Plan ownPlans=0 cta=false comparison=none")
    ).toBeInTheDocument();
  });

  it("returns unavailable metadata when the shared plan is missing", async () => {
    mockFetchSharedPlanByToken.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ shareToken: "missing-token" }),
    });

    expect(metadata.title).toBe("Shared Plan Not Available | Grad Tracker");
  });
});
