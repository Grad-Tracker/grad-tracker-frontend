import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import { RequirementCard } from "@/components/shared/RequirementCard";

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ children, onCheckedChange }: any) =>
    React.createElement(
      "button",
      { type: "button", onClick: () => onCheckedChange?.({ checked: true }) },
      children
    ),
}));

const items = [
  { id: 1, subject: "CS", number: "101", title: "Intro to CS" },
  { id: 2, subject: "CS", number: "201", title: "Data Structures" },
];

describe("RequirementCard", () => {
  it("renders title and items", () => {
    renderWithChakra(
      <RequirementCard
        title="Core Requirements"
        badge={<span>6 cr</span>}
        items={items}
        completedIds={new Set()}
        onToggleItem={vi.fn()}
      />
    );
    expect(screen.getByText("Core Requirements")).toBeInTheDocument();
    expect(screen.getByText(/CS 101/)).toBeInTheDocument();
    expect(screen.getByText(/CS 201/)).toBeInTheDocument();
  });

  it("calls onToggleItem when a checkbox is changed", () => {
    const onToggleItem = vi.fn();
    renderWithChakra(
      <RequirementCard
        title="Core Requirements"
        badge={<span>6 cr</span>}
        items={items}
        completedIds={new Set()}
        onToggleItem={onToggleItem}
      />
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onToggleItem).toHaveBeenCalledWith(1, true);
  });
});
