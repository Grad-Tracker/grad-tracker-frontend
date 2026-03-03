import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem, Steps } from "@chakra-ui/react";
import React from "react";

import WizardNavigation from "@/components/onboarding/WizardNavigation";

/**
 * Render a WizardNavigation component inside both ChakraProvider and
 * Steps.Root (required because WizardNavigation uses Steps.PrevTrigger /
 * Steps.NextTrigger compound components that rely on Steps context).
 */
function renderWizardNav(props: {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;
  onComplete: () => void;
  initialStep?: number;
}) {
  const { initialStep = props.currentStep, ...navProps } = props;
  return render(
    <ChakraProvider value={defaultSystem}>
      <Steps.Root
        step={initialStep}
        count={navProps.totalSteps}
        onStepChange={() => {}}
      >
        <WizardNavigation {...navProps} />
      </Steps.Root>
    </ChakraProvider>
  );
}

describe("WizardNavigation", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Previous button", () => {
    renderWizardNav({
      currentStep: 1,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });
    expect(screen.getAllByText("Previous").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Next button on non-last steps", () => {
    renderWizardNav({
      currentStep: 0,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });
    expect(screen.getAllByText("Next").length).toBeGreaterThanOrEqual(1);
  });

  it("disables (opacity 0.5) the Previous button on the first step", () => {
    renderWizardNav({
      currentStep: 0,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });
    const prevBtns = screen.getAllByText("Previous").map((el) => el.closest("button"));
    // At least one Previous button should be rendered disabled on step 0
    const hasDisabled = prevBtns.some((btn) => btn?.hasAttribute("disabled") || btn?.getAttribute("data-disabled") !== null);
    expect(hasDisabled).toBe(true);
  });

  it("shows Complete Setup button on the last step instead of Next", () => {
    renderWizardNav({
      currentStep: 2,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });
    expect(screen.getAllByText("Complete Setup").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("calls onComplete when Complete Setup is clicked on the last step", async () => {
    renderWizardNav({
      currentStep: 2,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });

    const completeBtn = screen.getAllByText("Complete Setup")[0];
    await act(async () => {
      fireEvent.click(completeBtn);
    });

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it("does not show Complete Setup button on non-last steps", () => {
    renderWizardNav({
      currentStep: 0,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
    });
    expect(screen.queryByText("Complete Setup")).toBeNull();
  });

  it("renders Next button as disabled when canProceed is false", () => {
    renderWizardNav({
      currentStep: 0,
      totalSteps: 3,
      canProceed: false,
      onComplete: mockOnComplete,
    });
    const nextBtns = screen.getAllByText("Next").map((el) => el.closest("button"));
    const hasDisabled = nextBtns.some(
      (btn) => btn?.hasAttribute("disabled") || btn?.getAttribute("data-disabled") !== null
    );
    expect(hasDisabled).toBe(true);
  });

  it("Previous button is not disabled on a middle step", () => {
    renderWizardNav({
      currentStep: 1,
      totalSteps: 3,
      canProceed: true,
      onComplete: mockOnComplete,
      initialStep: 1,
    });
    const prevBtns = screen.getAllByText("Previous").map((el) => el.closest("button"));
    // On step 1 the button should NOT be disabled
    const allDisabled = prevBtns.every(
      (btn) => btn?.hasAttribute("disabled") || btn?.getAttribute("aria-disabled") === "true"
    );
    expect(allDisabled).toBe(false);
  });
});
