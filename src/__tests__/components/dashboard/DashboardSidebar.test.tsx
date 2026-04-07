import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), signOut: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })) })),
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
  })),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));

vi.mock("@/components/ui/menu", () => ({
  MenuContent: ({ children }: any) => <div>{children}</div>,
  MenuItem: ({ children }: any) => <div>{children}</div>,
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
});
