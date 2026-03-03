import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockedServerClient, mockGetUser, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn(async () => ({ data: { id: 6 }, error: null }));
  const eq = vi.fn(() => ({ single: mockSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const mockGetUser = vi.fn(async () => ({
    data: { user: { id: "auth-user-123" } },
    error: null,
  }));

  return {
    mockGetUser,
    mockSingle,
    mockedServerClient: {
      auth: {
        getUser: mockGetUser,
      },
      from,
    },
  };
});

vi.mock("@/app/utils/supabase/server", () => ({
  createClient: async () => mockedServerClient,
}));

vi.mock("@/components/requirements/RequirementsDashboard", () => ({
  default: (props: any) => <div>REQ DASH {props.studentId}</div>,
}));

import RequirementsPage from "@/app/dashboard/requirements/page";

describe("/dashboard/requirements page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-123" } },
      error: null,
    });
    mockSingle.mockResolvedValue({ data: { id: 6 }, error: null });
  });

  it("returns null when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const el = await RequirementsPage();
    expect(el).toBeNull();
  });

  it("renders requirements dashboard when student id is resolved", async () => {
    const el = await RequirementsPage();
    render(el as React.ReactElement);

    expect(screen.getByText("REQ DASH 6")).toBeInTheDocument();
  });

  it("renders fallback message when no student profile is found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const el = await RequirementsPage();
    render(el as React.ReactElement);

    expect(
      screen.getByText("No student profile found for this account.")
    ).toBeInTheDocument();
  });
});
