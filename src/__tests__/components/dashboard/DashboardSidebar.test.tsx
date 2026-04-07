import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
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
});
