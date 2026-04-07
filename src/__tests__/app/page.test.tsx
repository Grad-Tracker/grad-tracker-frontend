import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/LandingPage", () => ({
  default: () => <div>LANDING PAGE</div>,
}));

import Page from "@/app/page";

describe("app root page", () => {
  it("renders the landing page component", async () => {
    const element = await Page();
    render(element as React.ReactElement);

    expect(screen.getByText("LANDING PAGE")).toBeInTheDocument();
  });
});
