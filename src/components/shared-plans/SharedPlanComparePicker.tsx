"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OwnPlanSummary, SharedPlanSummary } from "@/types/shared-plan";

type SharedPlanComparePickerProps = {
  sharedPlans: SharedPlanSummary[];
  ownPlans: OwnPlanSummary[];
};

function formatPrograms(programNames: string[]) {
  return programNames.length > 0 ? programNames.join(" / ") : "Program details unavailable";
}

export default function SharedPlanComparePicker({
  sharedPlans,
  ownPlans,
}: SharedPlanComparePickerProps) {
  const router = useRouter();
  const [selectedShareToken, setSelectedShareToken] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const selectedSharedPlan = useMemo(
    () => sharedPlans.find((plan) => plan.shareToken === selectedShareToken) ?? null,
    [sharedPlans, selectedShareToken]
  );
  const selectedOwnPlan = useMemo(
    () => ownPlans.find((plan) => plan.planId === selectedPlanId) ?? null,
    [ownPlans, selectedPlanId]
  );

  useEffect(() => {
    if (open) {
      setSelectedShareToken(null);
      setSelectedPlanId(null);
    }
  }, [open]);

  const canCompare = Boolean(selectedSharedPlan && selectedOwnPlan);

  const handleCompare = () => {
    if (!selectedSharedPlan || !selectedOwnPlan) {
      return;
    }

    setOpen(false);
    router.push(`/shared/plan/${selectedSharedPlan.shareToken}?myPlan=${selectedOwnPlan.planId}`);
  };

  const handleSharedPlanSelect = (shareToken: string) => {
    setSelectedShareToken((current) => (current === shareToken ? null : shareToken));
  };

  const handleOwnPlanSelect = (planId: number) => {
    setSelectedPlanId((current) => (current === planId ? null : planId));
  };

  return (
    <DialogRoot open={open} onOpenChange={(event) => setOpen(event.open)} size="cover">
      <DialogTrigger asChild>
        <Button colorPalette="blue" borderRadius="xl" aria-label="Open compare plans dialog">
          Compare Plans
        </Button>
      </DialogTrigger>

      <DialogContent
        backdrop
        bg="gray.950"
        borderWidth="1px"
        borderColor="blue.700"
        boxShadow="2xl"
        backdropFilter="none"
        maxH="calc(100vh - 2rem)"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        <DialogHeader>
          <DialogTitle fontFamily="var(--font-outfit), sans-serif">
            Choose plans to compare
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />

        <DialogBody pb="6" overflowY="auto" minH={0}>
          <Stack gap="6">
            <Box>
              <Text fontSize="sm" color="fg.muted" mb="3">
                1. Pick a shared plan
              </Text>
              <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
                {sharedPlans.map((plan) => {
                  const isSelected = plan.shareToken === selectedShareToken;

                  return (
                    <Card.Root
                      key={plan.shareToken}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select shared plan ${plan.planName}`}
                      borderRadius="2xl"
                      borderWidth="1px"
                      borderColor="blue.700"
                      bg={isSelected ? "blue.900" : "gray.900"}
                      cursor="pointer"
                      onClick={() => handleSharedPlanSelect(plan.shareToken)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSharedPlanSelect(plan.shareToken);
                        }
                      }}
                    >
                      <Card.Body p="5">
                        <Stack gap="3">
                          <HStack gap="2" flexWrap="wrap">
                            <Badge colorPalette={isSelected ? "blue" : "gray"} variant="subtle">
                              {plan.studentFirstName}'s shared plan
                            </Badge>
                            <Badge colorPalette="gray" variant="surface">
                              {plan.termCount} semester{plan.termCount === 1 ? "" : "s"}
                            </Badge>
                          </HStack>
                          <Text fontWeight="700">{plan.planName}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {formatPrograms(plan.programNames)}
                          </Text>
                        </Stack>
                      </Card.Body>
                    </Card.Root>
                  );
                })}
              </SimpleGrid>
            </Box>

            <Box>
              <Text fontSize="sm" color="fg.muted" mb="3">
                2. Pick one of my plans
              </Text>
              <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
                {ownPlans.map((plan) => {
                  const isSelected = plan.planId === selectedPlanId;

                  return (
                    <Card.Root
                      key={plan.planId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select my plan ${plan.planName}`}
                      borderRadius="2xl"
                      borderWidth="1px"
                      borderColor="blue.700"
                      bg={isSelected ? "blue.900" : "gray.900"}
                      cursor="pointer"
                      onClick={() => handleOwnPlanSelect(plan.planId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOwnPlanSelect(plan.planId);
                        }
                      }}
                    >
                      <Card.Body p="5">
                        <Stack gap="3">
                          <HStack gap="2" flexWrap="wrap">
                            <Badge colorPalette={isSelected ? "blue" : "gray"} variant="subtle">
                              {plan.termCount} semester{plan.termCount === 1 ? "" : "s"}
                            </Badge>
                            <Badge colorPalette="gray" variant="surface">
                              {plan.totalPlannedCredits} credits
                            </Badge>
                          </HStack>
                          <Text fontWeight="700">{plan.planName}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {formatPrograms(plan.programNames)}
                          </Text>
                        </Stack>
                      </Card.Body>
                    </Card.Root>
                  );
                })}
              </SimpleGrid>
            </Box>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <HStack gap="3" justify="space-between" w="full" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              {selectedSharedPlan && selectedOwnPlan
                ? `Comparing ${selectedSharedPlan.planName} with ${selectedOwnPlan.planName}`
                : "Select one shared plan and one of your plans to continue."}
            </Text>
            <Button
              colorPalette="blue"
              borderRadius="xl"
              onClick={handleCompare}
              disabled={!canCompare}
              aria-label="Compare the selected shared plan with the selected personal plan"
            >
              Compare Selected Plans
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
