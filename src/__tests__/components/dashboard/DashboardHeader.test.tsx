import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

const mockCreateSignedUrl = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

mockEq.mockImplementation(() => ({
  maybeSingle: mockMaybeSingle,
}));

mockSelect.mockImplementation(() => ({
  eq: mockEq,
}));

mockFrom.mockImplementation(() => ({
  select: mockSelect,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  })),
}));

vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => <button data-testid="color-mode-btn">Theme</button>,
}));

import DashboardHeader from "@/components/dashboard/DashboardHeader";

describe("DashboardHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockMaybeSingle.mockReset();
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockCreateSignedUrl.mockReset();
  });

  it("renders notification bell button", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("renders color mode button", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });
    expect(screen.getByTestId("color-mode-btn")).toBeInTheDocument();
  });

  it("renders avatar with user name when loaded", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        first_name: "John",
        last_name: "Doe",
        avatar_path: null,
      },
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: { first_name: "John", last_name: "Doe" },
        },
      },
    });
    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });
    await waitFor(() => {
      expect(screen.getAllByText("JD").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders avatar fallback when no user metadata", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });
    // Fallback name is "User" when no userName is set
    expect(screen.getAllByText("U").length).toBeGreaterThanOrEqual(1);
  });

  it("handles user with only first name", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        first_name: "Alice",
        last_name: "",
        avatar_path: null,
      },
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          user_metadata: { first_name: "Alice", last_name: "" },
        },
      },
    });
    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });
    await waitFor(() => {
      expect(screen.getAllByText("A").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders profile image when avatar path exists", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        first_name: "Jamie",
        last_name: "Smith",
        avatar_path: "students/user-3/avatar.png",
      },
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/avatar.png" },
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          user_metadata: { first_name: "Jamie", last_name: "Smith" },
        },
      },
    });

    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });

    await waitFor(() => {
      expect(screen.getByAltText("Jamie Smith")).toHaveAttribute(
        "src",
        "https://example.com/avatar.png"
      );
    });
  });

  it("falls back to a staff record when no student record exists", async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle:
            table === "students"
              ? vi.fn().mockResolvedValue({ data: null })
              : vi.fn().mockResolvedValue({
                  data: {
                    first_name: "Staff",
                    last_name: "Member",
                    avatar_path: null,
                  },
                }),
        }),
      }),
    }));

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "staff-1",
          user_metadata: { first_name: "Fallback", last_name: "Name" },
        },
      },
    });

    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("SM").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders a staff avatar image when the staff record has an avatar path", async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle:
            table === "students"
              ? vi.fn().mockResolvedValue({ data: null })
              : vi.fn().mockResolvedValue({
                  data: {
                    first_name: "Taylor",
                    last_name: "Admin",
                    avatar_path: "staff/staff-2/avatar.png",
                  },
                }),
        }),
      }),
    }));

    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/staff-avatar.png" },
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "staff-2",
          user_metadata: { first_name: "Taylor", last_name: "Admin" },
        },
      },
    });

    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });

    await waitFor(() => {
      expect(screen.getByAltText("Taylor Admin")).toHaveAttribute(
        "src",
        "https://example.com/staff-avatar.png"
      );
    });
  });

  it("keeps the fallback avatar initials when signed URL creation fails", async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle:
            table === "students"
              ? vi.fn().mockResolvedValue({
                  data: {
                    first_name: "Jamie",
                    last_name: "Smith",
                    avatar_path: "students/user-3/avatar.png",
                  },
                })
              : vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }));
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: new Error("signed url failed"),
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          user_metadata: { first_name: "Jamie", last_name: "Smith" },
        },
      },
    });

    await act(async () => {
      renderWithChakra(<DashboardHeader />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("JS").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByAltText("Jamie Smith")).not.toBeInTheDocument();
  });
});
