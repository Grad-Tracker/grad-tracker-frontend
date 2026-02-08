"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Badge,
  Icon,
  Steps,
} from "@chakra-ui/react";
import { LuTarget, LuBookOpen, LuClipboardCheck, LuSparkles } from "react-icons/lu";
import { OnboardingState } from "@/types/onboarding";
import ProgramSelectionStep from "./ProgramSelectionStep";
import ClassSelectionStep from "./ClassSelectionStep";
import ReviewStep from "./ReviewStep";
import WizardNavigation from "./WizardNavigation";

const steps = [
  { title: "Program", description: "Select your degree", icon: LuTarget },
  { title: "Classes", description: "Add your courses", icon: LuBookOpen },
  { title: "Review", description: "Confirm selections", icon: LuClipboardCheck },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    selectedMajor: null,
    selectedCertificates: [],
    selectedClasses: [],
  });

  const setMajor = (majorId: string | null) => {
    setState((prev) => ({ ...prev, selectedMajor: majorId }));
  };

  const setCertificates = (certificateIds: string[]) => {
    setState((prev) => ({ ...prev, selectedCertificates: certificateIds }));
  };

  const setClasses = (classIds: string[]) => {
    setState((prev) => ({ ...prev, selectedClasses: classIds }));
  };

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  const canProceedFromCurrentStep = (): boolean => {
    switch (state.currentStep) {
      case 0:
        return state.selectedMajor !== null;
      case 1:
        return true;
      default:
        return true;
    }
  };

  const handleStepChange = (details: { step: number }) => {
    if (details.step < state.currentStep) {
      setStep(details.step);
    } else if (canProceedFromCurrentStep()) {
      setStep(details.step);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(
      "onboardingData",
      JSON.stringify({
        major: state.selectedMajor,
        certificates: state.selectedCertificates,
        completedClasses: state.selectedClasses,
        completedAt: new Date().toISOString(),
      })
    );
    router.push("/dashboard");
  };

  return (
    <Box minH="100vh" bg="bg" fontFamily="'Plus Jakarta Sans', sans-serif">
      <Container maxW="4xl" mx="auto" px={{ base: "4", md: "8" }} py="8">
        <VStack gap="8" align="stretch">
          {/* Header */}
          <VStack gap="3" textAlign="center" className="animate-fade-up">
            <Badge
              colorPalette="green"
              variant="surface"
              size="lg"
              px="4"
              py="2"
              rounded="full"
            >
              <Icon mr="2">
                <LuSparkles />
              </Icon>
              Setup Wizard
            </Badge>
            <Heading
              fontFamily="'DM Serif Display', serif"
              size={{ base: "2xl", md: "3xl" }}
              letterSpacing="-0.02em"
              fontWeight="400"
            >
              Let&apos;s Get You Started
            </Heading>
            <Text fontSize="md" color="fg.muted" maxW="lg">
              Complete these steps to personalize your graduation tracking
              experience.
            </Text>
          </VStack>

          {/* Steps Component */}
          <Box className="animate-fade-up-delay-1">
            <Steps.Root
              step={state.currentStep}
              onStepChange={handleStepChange}
              count={steps.length}
              colorPalette="green"
              size="sm"
            >
              <Steps.List mb="8">
                {steps.map((step, index) => (
                  <Steps.Item key={index} index={index}>
                    <Steps.Trigger>
                      <Steps.Indicator>
                        <Steps.Status
                          complete={<Icon as={step.icon} />}
                          incomplete={<Steps.Number />}
                          current={<Icon as={step.icon} />}
                        />
                      </Steps.Indicator>
                      <Box textAlign="left" display={{ base: "none", md: "block" }}>
                        <Steps.Title>{step.title}</Steps.Title>
                        <Steps.Description>{step.description}</Steps.Description>
                      </Box>
                    </Steps.Trigger>
                    <Steps.Separator />
                  </Steps.Item>
                ))}
              </Steps.List>

              <Steps.Content index={0}>
                <ProgramSelectionStep
                  selectedMajor={state.selectedMajor}
                  selectedCertificates={state.selectedCertificates}
                  onMajorChange={setMajor}
                  onCertificatesChange={setCertificates}
                />
              </Steps.Content>

              <Steps.Content index={1}>
                <ClassSelectionStep
                  selectedClasses={state.selectedClasses}
                  onClassesChange={setClasses}
                />
              </Steps.Content>

              <Steps.Content index={2}>
                <ReviewStep
                  selectedMajor={state.selectedMajor}
                  selectedCertificates={state.selectedCertificates}
                  selectedClasses={state.selectedClasses}
                  onEditStep={setStep}
                />
              </Steps.Content>

              <WizardNavigation
                currentStep={state.currentStep}
                totalSteps={steps.length}
                canProceed={canProceedFromCurrentStep()}
                onComplete={handleComplete}
              />
            </Steps.Root>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
