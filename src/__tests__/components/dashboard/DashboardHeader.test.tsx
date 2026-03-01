import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => <button data-testid="color-mode-btn">Theme</button>,
}));

import DashboardHeader from "@/components/dashboard/DashboardHeader";

describe("DashboardHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockGetUser.mockResolvedValue({
      data: {
        user: {
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
    mockGetUser.mockResolvedValue({
      data: {
        user: {
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
});
