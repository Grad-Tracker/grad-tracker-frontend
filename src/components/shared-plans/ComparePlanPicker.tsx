"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Badge,
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
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OwnPlanSummary } from "@/types/shared-plan";

type ComparePlanPickerProps = {
  plans: OwnPlanSummary[];
  selectedPlanId?: number | null;
  basePath?: string;
  triggerLabel?: string;
};

export default function ComparePlanPicker({
  plans,
  selectedPlanId = null,
  basePath,
  triggerLabel = "Compare with My Plan",
}: ComparePlanPickerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (planId?: number | null) => {
    const destination = basePath ?? pathname;
    const params = new URLSearchParams(searchParams.toString());

    if (planId) {
      params.set("myPlan", String(planId));
    } else {
      params.delete("myPlan");
    }

    const query = params.toString();
    return query ? `${destination}?${query}` : destination;
  };

  return (
    <HStack gap="3" flexWrap="wrap" justify={{ base: "stretch", lg: "end" }}>
      <DialogRoot size="xl">
        <DialogTrigger asChild>
          <Button colorPalette="green" borderRadius="xl">
            {triggerLabel}
          </Button>
        </DialogTrigger>

        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle fontFamily="var(--font-outfit), sans-serif">
              Choose a plan to compare
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody pb="6">
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.planId;

                return (
                  <Card.Root
                    key={plan.planId}
                    borderRadius="2xl"
                    borderWidth="1px"
                    borderColor={isSelected ? "green.300" : "border.subtle"}
                    bg={isSelected ? "green.subtle" : "bg"}
                  >
                    <Card.Body p="5">
                      <Stack gap="4">
                        <Stack gap="1.5">
                          <HStack gap="2" flexWrap="wrap">
                            <Badge colorPalette={isSelected ? "green" : "gray"} variant="subtle">
                              {plan.termCount} semester{plan.termCount === 1 ? "" : "s"}
                            </Badge>
                            <Badge colorPalette="gray" variant="surface">
                              {plan.totalPlannedCredits} credits
                            </Badge>
                          </HStack>
                          <Text fontWeight="700">{plan.planName}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {plan.programNames.length > 0
                              ? plan.programNames.join(" / ")
                              : "Program details unavailable"}
                          </Text>
                        </Stack>

                        <Button asChild colorPalette="green" borderRadius="xl" size="sm">
                          <Link href={buildHref(plan.planId)}>
                            {isSelected ? "Currently Comparing" : "Compare This Plan"}
                          </Link>
                        </Button>
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                );
              })}
            </SimpleGrid>
          </DialogBody>
        </DialogContent>
      </DialogRoot>

      {selectedPlanId ? (
        <Button asChild variant="outline" borderRadius="xl">
          <Link href={buildHref(null)}>Stop Comparing</Link>
        </Button>
      ) : null}
    </HStack>
  );
}
