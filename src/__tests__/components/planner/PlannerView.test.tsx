// src/__tests__/components/planner/PlannerView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ then: (r: any) => r({ data: [], error: null }) }) }),
    }),
  }),
}));

import PlannerView from "@/components/planner/PlannerView";

describe("PlannerView", () => {
  it("mounts in edit mode without throwing", () => {
    renderWithChakra(<PlannerView studentId={1} mode="edit" />);
    // Loading skeleton renders before data resolves
    expect(document.body).toBeTruthy();
  });

  it("mounts in readonly mode without throwing", () => {
    renderWithChakra(<PlannerView studentId={1} mode="readonly" />);
    expect(document.body).toBeTruthy();
  });

  it("readonly mode does not render Create Plan button", async () => {
    renderWithChakra(<PlannerView studentId={1} mode="readonly" />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /create plan/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /add semester/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /delete plan/i })).toBeNull();
    });
  });
});
