import React, { createContext, useContext, useMemo, useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockUsePathname, mockUseSearchParams } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockUseSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
}));

const DialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

vi.mock("@/components/ui/dialog", () => {
  function DialogRoot({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const value = useMemo(() => ({ open, setOpen }), [open]);
    return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
  }

  function DialogTrigger({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) {
    const ctx = useContext(DialogContext)!;
    const child = React.cloneElement(children, {
      onClick: () => ctx.setOpen(true),
    });
    return asChild ? child : child;
  }

  function DialogContent({ children }: { children: React.ReactNode }) {
    const ctx = useContext(DialogContext)!;
    return ctx.open ? <div>{children}</div> : null;
  }

  return {
    DialogRoot,
    DialogTrigger,
    DialogContent,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogCloseTrigger: () => <button type="button">Close</button>,
  };
});

import ComparePlanPicker from "@/components/shared-plans/ComparePlanPicker";

describe("ComparePlanPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/shared/plan/shared-1");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("foo=bar"));
  });

  it("builds compare links from the current pathname and search params", () => {
    renderWithChakra(
      <ComparePlanPicker
        plans={[
          {
            planId: 11,
            planName: "My Plan",
            description: null,
            programNames: ["B.S. Computer Science"],
            totalPlannedCredits: 15,
            termCount: 2,
          },
        ]}
        selectedPlanId={11}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /compare with my plan/i }));

    expect(screen.getByText("Choose a plan to compare")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue comparing with my plan/i })).toHaveAttribute(
      "href",
      "/shared/plan/shared-1?foo=bar&myPlan=11"
    );
    expect(screen.getByRole("link", { name: /stop comparing plans/i })).toHaveAttribute(
      "href",
      "/shared/plan/shared-1?foo=bar"
    );
  });

  it("uses the provided base path and fallback program label", () => {
    renderWithChakra(
      <ComparePlanPicker
        plans={[
          {
            planId: 21,
            planName: "Alternative Plan",
            description: null,
            programNames: [],
            totalPlannedCredits: 12,
            termCount: 1,
          },
        ]}
        basePath="/shared/plan/custom-token"
        triggerLabel="Compare Plans"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /compare plans/i }));

    expect(screen.getByText("Program details unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compare with alternative plan/i })).toHaveAttribute(
      "href",
      "/shared/plan/custom-token?foo=bar&myPlan=21"
    );
    expect(screen.queryByRole("link", { name: /stop comparing plans/i })).not.toBeInTheDocument();
  });
});
