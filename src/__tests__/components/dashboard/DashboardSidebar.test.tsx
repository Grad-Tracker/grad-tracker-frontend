import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render } from "@testing-library/react";

const { mockUseUserProfile, mockSignOutAndRedirect } = vi.hoisted(() => ({
  mockUseUserProfile: vi.fn(),
  mockSignOutAndRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/lib/hooks/useUserProfile", () => ({
  useUserProfile: mockUseUserProfile,
}));

vi.mock("@/lib/auth-helpers", () => ({
  signOutAndRedirect: (...args: any[]) => mockSignOutAndRedirect(...args),
}));

vi.mock("@/components/ui/menu", () => ({
  MenuContent: ({ children }: any) => <div>{children}</div>,
  MenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  MenuItemText: ({ children }: any) => <span>{children}</span>,
  MenuRoot: ({ children }: any) => <div>{children}</div>,
  MenuSeparator: () => <hr />,
  MenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

function renderSidebar() {
  return render(
    React.createElement(
      ChakraProvider,
      { value: defaultSystem },
      React.createElement(DashboardSidebar)
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUserProfile.mockReturnValue({ userName: "", avatarUrl: "", loading: false });
});

describe("DashboardSidebar", () => {

  it("renders the GradTracker logo", () => {
    renderSidebar();
    expect(screen.getAllByText("GradTracker").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation items", () => {
    renderSidebar();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Planner").length).toBeGreaterThanOrEqual(1);
  });

  it("nav links have correct hrefs", () => {
    renderSidebar();
    const links = document.querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/dashboard/courses");
    expect(hrefs).toContain("/dashboard/requirements");
    expect(hrefs).toContain("/dashboard/planner");
  });

  it("renders account section with Settings and Sign Out", () => {
    renderSidebar();
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sign Out").length).toBeGreaterThanOrEqual(1);
  });

  it("calls signOutAndRedirect when Sign Out is clicked", () => {
    renderSidebar();
    const signOutItems = screen.getAllByText("Sign Out");
    fireEvent.click(signOutItems[0]);
    expect(mockSignOutAndRedirect).toHaveBeenCalled();
  });

  it("renders Avatar.Image elements when avatarUrl is provided", () => {
    mockUseUserProfile.mockReturnValue({
      userName: "Jane Doe",
      avatarUrl: "https://example.com/jane.jpg",
      loading: false,
    });
    const { container } = renderSidebar();
    const imgs = container.querySelectorAll("img[src*='jane.jpg']");
    expect(imgs.length).toBeGreaterThan(0);
  });
});
