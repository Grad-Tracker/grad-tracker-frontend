import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

import AdminProgramsClient from "@/app/admin/(protected)/programs/AdminProgramsClient";
import type { AdminProgramSummary } from "@/app/admin/(protected)/programs/server-helpers";

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const programs: AdminProgramSummary[] = [
  {
    id: 1,
    name: "Biology",
    catalog_year: 2023,
    program_type: "MAJOR",
    blockCount: 2,
    courseCount: 12,
  },
  {
    id: 2,
    name: "Computer Science",
    catalog_year: 2025,
    program_type: "MAJOR",
    blockCount: 5,
    courseCount: 18,
  },
  {
    id: 3,
    name: "Data Science MS",
    catalog_year: 2024,
    program_type: "GRADUATE",
    blockCount: 4,
    courseCount: 10,
  },
  {
    id: 4,
    name: "Applied Science MS",
    catalog_year: 2026,
    program_type: "GRADUATE",
    blockCount: 3,
    courseCount: 22,
  },
  {
    id: 5,
    name: "Chemistry",
    catalog_year: 2024,
    program_type: "MAJOR",
    blockCount: 7,
    courseCount: 9,
  },
];

function getGroupProgramTitles(groupType: string) {
  return within(screen.getByTestId(`program-group-${groupType}`))
    .getAllByTestId(/program-card-/)
    .map((card) => within(card).getByRole("heading").textContent);
}

describe("AdminProgramsClient", () => {
  it("filters program cards by name and shows an empty state when nothing matches", () => {
    renderWithChakra(<AdminProgramsClient programs={programs} />);

    expect(screen.getByText("Showing 5 of 5 assigned programs")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search programs");
    fireEvent.change(searchInput, { target: { value: "computer" } });

    expect(screen.getByRole("link", { name: /computer science/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /biology/i })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 5 assigned programs")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "no-match" } });

    expect(screen.getByText("No programs match your search.")).toBeInTheDocument();
  });

  it("sorts programs by name A-Z within a group", () => {
    renderWithChakra(<AdminProgramsClient programs={programs} />);

    const sortSelect = screen.getByLabelText("Sort programs");

    fireEvent.change(sortSelect, { target: { value: "name-asc" } });
    expect(getGroupProgramTitles("MAJOR")).toEqual(["Biology", "Chemistry", "Computer Science"]);
    expect(getGroupProgramTitles("GRADUATE")).toEqual(["Applied Science MS", "Data Science MS"]);
  });

  it("sorts programs by requirement blocks most to least within a group", () => {
    renderWithChakra(<AdminProgramsClient programs={programs} />);

    const sortSelect = screen.getByLabelText("Sort programs");

    fireEvent.change(sortSelect, { target: { value: "blocks-most" } });
    expect(getGroupProgramTitles("MAJOR")).toEqual(["Chemistry", "Computer Science", "Biology"]);
    expect(getGroupProgramTitles("GRADUATE")).toEqual(["Data Science MS", "Applied Science MS"]);
  });

  it("preserves grouping while filtering and sorting", () => {
    renderWithChakra(<AdminProgramsClient programs={programs} />);

    fireEvent.change(screen.getByLabelText("Search programs"), {
      target: { value: "science" },
    });
    fireEvent.change(screen.getByLabelText("Sort programs"), {
      target: { value: "name-desc" },
    });

    expect(screen.getByRole("heading", { name: "Majors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Graduate Programs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /computer science/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /data science ms/i })).toBeInTheDocument();
  });

  it("does not match program type text when searching", () => {
    renderWithChakra(<AdminProgramsClient programs={programs} />);

    fireEvent.change(screen.getByLabelText("Search programs"), {
      target: { value: "graduate" },
    });

    expect(screen.getByText("No programs match your search.")).toBeInTheDocument();
  });
});
