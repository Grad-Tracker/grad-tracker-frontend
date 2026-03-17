import React, { createContext, useContext, useMemo, useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithChakra, createMockRouter } from "@/__tests__/helpers/mocks";

const { mockUseRouter } = vi.hoisted(() => ({
  mockUseRouter: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
}));

const DialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

vi.mock("@/components/ui/dialog", () => {
  function DialogRoot({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (event: { open: boolean }) => void;
  }) {
    const [internalOpen, setInternalOpen] = useState(Boolean(open));
    const actualOpen = open ?? internalOpen;
    const setOpen = (nextOpen: boolean) => {
      setInternalOpen(nextOpen);
      onOpenChange?.({ open: nextOpen });
    };

    const value = useMemo(() => ({ open: actualOpen, setOpen }), [actualOpen]);
    return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
  }

  function DialogTrigger({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) {
    const ctx = useContext(DialogContext)!;
    const child = React.cloneElement(children, {
      onClick: () => ctx.setOpen(true),
    });
    return asChild ? child : <button onClick={() => ctx.setOpen(true)}>{children}</button>;
  }

  function DialogContent({ children }: { children: React.ReactNode }) {
    const ctx = useContext(DialogContext)!;
    return ctx.open ? <div>{children}</div> : null;
  }

  function DialogCloseTrigger() {
    const ctx = useContext(DialogContext)!;
    return <button onClick={() => ctx.setOpen(false)}>Close Dialog</button>;
  }

  return {
    DialogRoot,
    DialogTrigger,
    DialogContent,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogCloseTrigger,
  };
});

import SharedPlanComparePicker from "@/components/shared-plans/SharedPlanComparePicker";

describe("SharedPlanComparePicker", () => {
  const router = createMockRouter();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue(router);
  });

  it("lets the user select plans and navigate to the comparison view", () => {
    renderWithChakra(
      <SharedPlanComparePicker
        sharedPlans={[
          {
            shareToken: "shared-1",
            planId: 1,
            planName: "Accounting Major 4 Year Plan",
            description: null,
            studentFirstName: "Shared",
            programNames: ["B.S. Accounting"],
            termCount: 8,
            totalPlannedCredits: 120,
            updatedAt: null,
          },
        ]}
        ownPlans={[
          {
            planId: 9,
            planName: "My Plan",
            description: null,
            programNames: ["B.S. Accounting"],
            totalPlannedCredits: 15,
            termCount: 2,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /compare plans/i }));
    fireEvent.click(screen.getByText("Accounting Major 4 Year Plan"));
    fireEvent.click(screen.getByText("My Plan"));

    expect(
      screen.getByText("Comparing Accounting Major 4 Year Plan with My Plan")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /compare selected plans/i }));

    expect(router.push).toHaveBeenCalledWith("/shared/plan/shared-1?myPlan=9");
  });

  it("allows selected cards to be toggled off and resets when reopened", () => {
    renderWithChakra(
      <SharedPlanComparePicker
        sharedPlans={[
          {
            shareToken: "shared-1",
            planId: 1,
            planName: "Computer Science Major 4 Year Plan",
            description: null,
            studentFirstName: "Shared",
            programNames: [],
            termCount: 8,
            totalPlannedCredits: 120,
            updatedAt: null,
          },
        ]}
        ownPlans={[
          {
            planId: 5,
            planName: "My Plan",
            description: null,
            programNames: [],
            totalPlannedCredits: 12,
            termCount: 2,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /compare plans/i }));
    fireEvent.click(screen.getByText("Computer Science Major 4 Year Plan"));
    fireEvent.click(screen.getByText("My Plan"));

    expect(
      screen.getByText(/Comparing Computer Science Major 4 Year Plan with My Plan/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Computer Science Major 4 Year Plan"));
    fireEvent.click(screen.getByText("My Plan"));

    expect(
      screen.getByText("Select one shared plan and one of your plans to continue.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare selected plans/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    fireEvent.click(screen.getByRole("button", { name: /compare plans/i }));

    expect(
      screen.getByText("Select one shared plan and one of your plans to continue.")
    ).toBeInTheDocument();
  });
});
