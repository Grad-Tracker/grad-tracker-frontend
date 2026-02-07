"use client";

import { Button, HStack, Steps } from "@chakra-ui/react";
import { LuArrowLeft, LuArrowRight, LuCheck } from "react-icons/lu";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;
  onComplete: () => void;
}

export default function WizardNavigation({
  currentStep,
  totalSteps,
  canProceed,
  onComplete,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <HStack justify="space-between" pt="8" mt="4" borderTopWidth="1px" borderColor="border.subtle">
      <Steps.PrevTrigger asChild>
        <Button
          variant="outline"
          disabled={isFirstStep}
          rounded="full"
          px="6"
          opacity={isFirstStep ? 0.5 : 1}
        >
          <LuArrowLeft />
          Previous
        </Button>
      </Steps.PrevTrigger>

      {isLastStep ? (
        <Button
          colorPalette="green"
          onClick={onComplete}
          rounded="full"
          px="6"
          fontWeight="600"
          _hover={{
            transform: "translateY(-2px)",
            boxShadow: "lg",
          }}
          transition="all 0.2s"
        >
          Complete Setup
          <LuCheck />
        </Button>
      ) : (
        <Steps.NextTrigger asChild>
          <Button
            colorPalette="green"
            disabled={!canProceed}
            rounded="full"
            px="6"
            fontWeight="600"
            opacity={canProceed ? 1 : 0.5}
            _hover={{
              transform: canProceed ? "translateY(-2px)" : "none",
              boxShadow: canProceed ? "lg" : "none",
            }}
            transition="all 0.2s"
          >
            Next
            <LuArrowRight />
          </Button>
        </Steps.NextTrigger>
      )}
    </HStack>
  );
}
