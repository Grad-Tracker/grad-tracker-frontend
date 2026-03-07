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
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Mathematics Minor")).toBeInTheDocument();
    expect(screen.queryByText("Software Engineering MS")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Science Certificate")).not.toBeInTheDocument();
  });

  it("shows GRADUATE programs when grad tab is clicked", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const gradTexts = screen.getAllByText(/^Grad$/);
    const gradButton = gradTexts[0].closest("button") ?? gradTexts[0];
    fireEvent.click(gradButton);
    await waitFor(() => {
      expect(screen.getByText("Software Engineering MS")).toBeInTheDocument();
      expect(screen.queryByText("Computer Science")).not.toBeInTheDocument();
    });
  });

  it("shows CERTIFICATE programs when certificates tab is clicked", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const certTexts = screen.getAllByText(/Certificates/);
    const certButton = certTexts[0].closest("button") ?? certTexts[0];
    fireEvent.click(certButton);
    await waitFor(() => {
      expect(screen.getByText("Data Science Certificate")).toBeInTheDocument();
      expect(screen.queryByText("Computer Science")).not.toBeInTheDocument();
    });
  });

  it("filters programs by search text (case-insensitive)", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "computer" } });
    await waitFor(() => {
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
      expect(screen.queryByText("Mathematics Minor")).not.toBeInTheDocument();
    });
  });

  it("shows all programs when search is cleared", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "computer" } });
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
      expect(screen.getByText("Mathematics Minor")).toBeInTheDocument();
    });
  });

  it("shows 'No programs found' when search has no results", async () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const input = screen.getByPlaceholderText("Search programs by name...");
    fireEvent.change(input, { target: { value: "ZZZZZ" } });
    await waitFor(() => {
      expect(screen.getByText("No programs found")).toBeInTheDocument();
    });
  });

  it("shows database empty message when programs array is empty", () => {
    renderWithChakra(<ProgramsClient programs={[]} />);
    expect(
      screen.getByText("No programs have been added to the database yet.")
    ).toBeInTheDocument();
  });

  it("shows programs found count for current tab", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    // 2 undergrad programs (MAJOR + MINOR)
    expect(screen.getByText("2 programs found")).toBeInTheDocument();
  });

  it("ProgramCard renders a link to /dashboard/requirements/[id]", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    const links = screen.getAllByRole("link");
    const csLink = links.find((l) => l.getAttribute("href") === "/dashboard/requirements/1");
    expect(csLink).toBeDefined();
  });

  it("groups undergrad programs under Majors and Minors headings", () => {
    renderWithChakra(<ProgramsClient programs={mockPrograms} />);
    expect(screen.getAllByText(/Majors/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Minors/i).length).toBeGreaterThanOrEqual(1);
  });
});
