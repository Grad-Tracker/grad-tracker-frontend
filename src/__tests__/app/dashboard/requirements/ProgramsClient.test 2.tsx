import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import ProgramsClient from "@/app/dashboard/requirements/ProgramsClient";
import type { Program } from "@/app/dashboard/requirements/ProgramsClient";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => null,
}));

const mockPrograms: Program[] = [
  { id: "1", name: "Computer Science", catalog_year: 2024, program_type: "MAJOR" },
  { id: "2", name: "Mathematics Minor", catalog_year: null, program_type: "MINOR" },
  { id: "3", name: "Software Engineering MS", catalog_year: 2024, program_type: "GRADUATE" },
  { id: "4", name: "Data Science Certificate", catalog_year: null, program_type: "CERTIFICATE" },
];

describe("ProgramsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'All Programs' heading", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    expect(screen.getAllByText("All Programs").length).toBeGreaterThanOrEqual(1);
  });

  it("shows MAJOR and MINOR programs on undergrad tab by default", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mathematics Minor").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Software Engineering MS")).toHaveLength(0);
    expect(screen.queryAllByText("Data Science Certificate")).toHaveLength(0);
  });

  it("shows GRADUATE programs when grad tab is clicked", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const gradText = screen.getAllByText(/^Grad$/);
    const gradTab = gradText[0].closest('[role="tab"]') ?? gradText[0];
    fireEvent.click(gradTab);
    await waitFor(() => {
      expect(screen.getAllByText("Software Engineering MS").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText("Computer Science")).toHaveLength(0);
    });
  });

  it("shows CERTIFICATE programs when certificates tab is clicked", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const certText = screen.getAllByText(/Certificates/);
    const certTab = certText[0].closest('[role="tab"]') ?? certText[0];
    fireEvent.click(certTab);
    await waitFor(() => {
      expect(screen.getAllByText("Data Science Certificate").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText("Computer Science")).toHaveLength(0);
    });
  });

  it("filters programs by search text (case-insensitive)", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "computer" } });
    await waitFor(() => {
      expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText("Mathematics Minor")).toHaveLength(0);
    });
  });

  it("shows all programs when search is cleared", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "computer" } });
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Mathematics Minor").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No programs found' when search has no results", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "ZZZZZ" } });
    await waitFor(() => {
      expect(screen.getAllByText("No programs found").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows database empty message when programs array is empty", () => {
    renderWithChakra(<ProgramsClient programs={[]} />);
    expect(
      screen.getAllByText("No programs have been added to the database yet.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows programs found count for current tab", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    // 2 undergrad programs (MAJOR + MINOR)
    expect(screen.getAllByText("2 programs found").length).toBeGreaterThanOrEqual(1);
  });

  it("ProgramCard renders a link to /dashboard/requirements/[id]", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const links = screen.getAllByRole("link");
    const csLink = links.find((l) => l.getAttribute("href") === "/dashboard/requirements/1");
    expect(csLink).toBeInTheDocument();
  });

  it("groups undergrad programs under Majors and Minors headings", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    expect(screen.getAllByText(/Majors/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Minors/i).length).toBeGreaterThanOrEqual(1);
  });
});
