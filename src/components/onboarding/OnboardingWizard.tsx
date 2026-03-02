"use client";

import { useState, useEffect, useCallback } from "react";
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
  Spinner,
} from "@chakra-ui/react";
import { LuTarget, LuBookOpen, LuClipboardCheck, LuSparkles } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPrograms,
  fetchProgramRequirements,
  fetchCertificatesForMajor,
  getOrCreateStudent,
  saveOnboardingSelections,
  fetchCoursesByIds,
} from "@/lib/supabase/queries/onboarding";
import type {
  OnboardingState,
  Program,
  RequirementBlock,
  CourseRow,
} from "@/types/onboarding";
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
    expectedGradSemester: null,
    expectedGradYear: null,
  });

  // Data fetched from Supabase
  const [majors, setMajors] = useState<Program[]>([]);
  const [certificates, setCertificates] = useState<Program[]>([]);
  const [requirementBlocks, setRequirementBlocks] = useState<RequirementBlock[]>([]);
  const [reviewClasses, setReviewClasses] = useState<CourseRow[]>([]);

  // Loading states
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch majors on mount
  useEffect(() => {
    async function loadMajors() {
      try {
        const majorsData = await fetchPrograms("MAJOR");
        setMajors(majorsData);
      } catch {
        toaster.error({
          title: "Failed to load programs",
          description: "Please try refreshing the page.",
        });
      } finally {
        setLoadingPrograms(false);
      }
    }
    loadMajors();
  }, []);

  // Fetch certificates and requirement blocks when major changes
  useEffect(() => {
    if (!state.selectedMajor) {
      setCertificates([]);
      setRequirementBlocks([]);
      return;
    }

    async function loadMajorData() {
      setLoadingCertificates(true);
      setLoadingRequirements(true);
      try {
        const [certs, blocks] = await Promise.all([
          fetchCertificatesForMajor(state.selectedMajor!),
          fetchProgramRequirements(state.selectedMajor!),
        ]);
        setCertificates(certs);
        setRequirementBlocks(blocks);
      } catch {
        toaster.error({
          title: "Failed to load program data",
          description: "Please try selecting your major again.",
        });
      } finally {
        setLoadingCertificates(false);
        setLoadingRequirements(false);
      }
    }
    loadMajorData();
  }, [state.selectedMajor]);

  // Resolve course details for review step when moving to step 2
  useEffect(() => {
    if (state.currentStep !== 2 || state.selectedClasses.length === 0) {
      setReviewClasses([]);
      return;
    }

    async function loadReviewClasses() {
      try {
        const courses = await fetchCoursesByIds(state.selectedClasses);
        setReviewClasses(courses);
      } catch {
        // Fall back to what we have from requirement blocks
        const allCourses = requirementBlocks.flatMap((b) => b.courses);
        const selected = allCourses.filter((c) =>
          state.selectedClasses.includes(c.id)
        );
        setReviewClasses(selected);
      }
    }
    loadReviewClasses();
  }, [state.currentStep, state.selectedClasses, requirementBlocks]);

  const setMajor = useCallback((majorId: number | null) => {
    setState((prev) => ({
      ...prev,
      selectedMajor: majorId,
      // Reset class and certificate selections when major changes
      selectedClasses: [],
      selectedCertificates: [],
    }));
  }, []);

  const setCertificatesSelected = useCallback((certificateIds: number[]) => {
    setState((prev) => ({ ...prev, selectedCertificates: certificateIds }));
  }, []);

  const setClasses = useCallback((classIds: number[]) => {
    setState((prev) => ({ ...prev, selectedClasses: classIds }));
  }, []);

  const setStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const setGraduation = useCallback(
    (semester: string | null, year: number | null) => {
      setState((prev) => ({
        ...prev,
        expectedGradSemester: semester,
        expectedGradYear: year,
      }));
    },
    []
  );

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

  const handleComplete = async () => {
    if (!state.selectedMajor) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toaster.error({
          title: "Not authenticated",
          description: "Please sign in and try again.",
        });
        router.push("/signin");
        return;
      }

      const student = await getOrCreateStudent(
        user.id,
        user.email ?? "",
        user.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ""}`.trim()
          : user.email ?? ""
      );

      await saveOnboardingSelections(
        student.id,
        state.selectedMajor,
        state.selectedCertificates,
        state.selectedClasses,
        state.expectedGradSemester,
        state.expectedGradYear
      );

      toaster.success({
        title: "Setup complete!",
        description: "Your graduation tracker is ready.",
      });

      router.push("/dashboard");
    } catch {
      toaster.error({
        title: "Failed to save selections",
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingPrograms) {
    return (
      <Box minH="100vh" bg="bg" display="flex" alignItems="center" justifyContent="center">
        <VStack gap="4">
          <Spinner size="xl" colorPalette="green" />
          <Text color="fg.muted">Loading programs...</Text>
        </VStack>
      </Box>
    );
  }

  const selectedMajorData = majors.find((m) => m.id === state.selectedMajor) ?? null;
  const selectedCertificatesData = certificates.filter((c) =>
    state.selectedCertificates.includes(c.id)
  );

  return (
    <Box minH="100vh" bg="bg" fontFamily="var(--font-plus-jakarta), sans-serif">
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
              fontFamily="var(--font-outfit), sans-serif"
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
                  majors={majors}
                  certificates={loadingCertificates ? [] : certificates}
                  selectedMajor={state.selectedMajor}
                  selectedCertificates={state.selectedCertificates}
                  onMajorChange={setMajor}
                  onCertificatesChange={setCertificatesSelected}
                  expectedGradSemester={state.expectedGradSemester}
                  expectedGradYear={state.expectedGradYear}
                  onGradChange={setGraduation}
                />
              </Steps.Content>

              <Steps.Content index={1}>
                {loadingRequirements ? (
                  <VStack py="12" gap="4">
                    <Spinner size="lg" colorPalette="green" />
                    <Text color="fg.muted">Loading courses...</Text>
                  </VStack>
                ) : (
                  <ClassSelectionStep
                    requirementBlocks={requirementBlocks}
                    selectedClasses={state.selectedClasses}
                    onClassesChange={setClasses}
                  />
                )}
              </Steps.Content>

              <Steps.Content index={2}>
                <ReviewStep
                  major={selectedMajorData}
                  certificates={selectedCertificatesData}
                  classes={reviewClasses}
                  expectedGradSemester={state.expectedGradSemester}
                  expectedGradYear={state.expectedGradYear}
                  onEditStep={setStep}
                />
              </Steps.Content>

              <WizardNavigation
                currentStep={state.currentStep}
                totalSteps={steps.length}
                canProceed={canProceedFromCurrentStep() && !saving}
                onComplete={handleComplete}
              />
            </Steps.Root>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
