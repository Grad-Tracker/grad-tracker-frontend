import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";

const { mockPush, mockRouter, mockSignOut, mockToaster } = vi.hoisted(() => {
  const mockPush = vi.fn();
  return {
    mockPush,
    mockRouter: { push: mockPush },
    mockSignOut: vi.fn().mockResolvedValue({ error: null }),
    mockToaster: { create: vi.fn() },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => mockRouter,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({ auth: { signOut: mockSignOut } })),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

describe("DashboardSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("renders the GradTracker logo", () => {
    renderWithChakra(<DashboardSidebar />);
    expect(screen.getAllByText("GradTracker").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all 5 navigation items", () => {
    renderWithChakra(<DashboardSidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Planner").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reports").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Settings link", () => {
    renderWithChakra(<DashboardSidebar />);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Sign Out button", () => {
    renderWithChakra(<DashboardSidebar />);
    expect(screen.getAllByText("Sign Out").length).toBeGreaterThanOrEqual(1);
  });

  it("nav links have correct hrefs", () => {
    renderWithChakra(<DashboardSidebar />);
    const links = document.querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/dashboard/courses");
    expect(hrefs).toContain("/dashboard/requirements");
    expect(hrefs).toContain("/dashboard/planner");
  });

  it("calls signOut and redirects to signin on Sign Out click", async () => {
    renderWithChakra(<DashboardSidebar />);
    const signOutBtn = screen.getAllByText("Sign Out")[0];
    await act(async () => {
      fireEvent.click(signOutBtn);
    });
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("shows success toaster after sign out", async () => {
    renderWithChakra(<DashboardSidebar />);
    const signOutBtn = screen.getAllByText("Sign Out")[0];
    await act(async () => {
      fireEvent.click(signOutBtn);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" })
      );
    });
  });
});
