import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { GraduateTrack } from "@/types/planner";
import GraduateTrackSelector from "@/components/planner/GraduateTrackSelector";

const makeTracks = (): GraduateTrack[] => [
  { blockId: 10, name: "Data Science", courseCount: 5, totalCredits: 15 },
  { blockId: 20, name: "Cybersecurity", courseCount: 4, totalCredits: 12 },
  { blockId: 30, name: "Software Engineering", courseCount: 6, totalCredits: 18 },
];

describe("GraduateTrackSelector", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when tracks array is empty", () => {
    const { container } = renderWithChakra(
      <GraduateTrackSelector
        tracks={[]}
        selectedTrackId={null}
        onSelect={mockOnSelect}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders each track name", () => {
    const tracks = makeTracks();
    renderWithChakra(
      <GraduateTrackSelector
        tracks={tracks}
        selectedTrackId={null}
        onSelect={mockOnSelect}
      />
    );
    for (const track of tracks) {
      expect(screen.getAllByText(track.name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows course count for each track", () => {
    const tracks = makeTracks();
    renderWithChakra(
      <GraduateTrackSelector
        tracks={tracks}
        selectedTrackId={null}
        onSelect={mockOnSelect}
      />
    );
    for (const track of tracks) {
      const label = `${track.courseCount} courses`;
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("calls onSelect with the track blockId when a track button is clicked", () => {
    const tracks = makeTracks();
    renderWithChakra(
      <GraduateTrackSelector
        tracks={tracks}
        selectedTrackId={null}
        onSelect={mockOnSelect}
      />
    );
    // Click the second track
    const trackElements = screen.getAllByText("Cybersecurity");
    fireEvent.click(trackElements[0]);
    expect(mockOnSelect).toHaveBeenCalledWith(20);
  });

  it("shows selected visual state when selectedTrackId matches a track", () => {
    const tracks = makeTracks();
    renderWithChakra(
      <GraduateTrackSelector
        tracks={tracks}
        selectedTrackId={10}
        onSelect={mockOnSelect}
      />
    );
    // When selected, the header text should say "Concentration" instead of "Choose a concentration"
    expect(screen.getAllByText("Concentration").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Choose a concentration").length).toBe(0);
  });

  it("shows informational text when no track is selected", () => {
    const tracks = makeTracks();
    renderWithChakra(
      <GraduateTrackSelector
        tracks={tracks}
        selectedTrackId={null}
        onSelect={mockOnSelect}
      />
    );
    expect(
      screen.getAllByText("Choose a concentration").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        "Select your specialization track to see the relevant courses."
      ).length
    ).toBeGreaterThanOrEqual(1);
  });
});
