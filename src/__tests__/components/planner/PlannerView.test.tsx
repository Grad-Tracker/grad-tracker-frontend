// src/__tests__/components/planner/PlannerView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
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
});
