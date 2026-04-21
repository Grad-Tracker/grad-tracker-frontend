"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuChevronDown, LuLayoutDashboard } from "react-icons/lu";
import type { AdvisorPlanSummary } from "@/types/ai-advisor";

interface PlanSwitcherProps {
  activePlanId: number | null;
  onPlanChange: (planId: number | null) => void;
  /** Called when a plan_created side effect arrives so the list can refresh. */
  refreshTrigger?: number;
}

export function PlanSwitcher({ activePlanId, onPlanChange, refreshTrigger }: PlanSwitcherProps) {
  const [plans, setPlans] = useState<AdvisorPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchPlans = useCallback(() => {
    setLoading(true);
    fetch("/api/ai-advisor/plans")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ plans: AdvisorPlanSummary[] }>;
      })
      .then((data) => {
        setPlans(data.plans);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Re-fetch whenever a plan is created mid-conversation.
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchPlans();
    }
  }, [refreshTrigger, fetchPlans]);

  // Auto-select the most recently updated plan when plans first load and none is selected.
  useEffect(() => {
    if (!loading && plans.length > 0 && activePlanId === null) {
      onPlanChange(plans[0]!.id);
    }
  }, [loading, plans, activePlanId, onPlanChange]);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (loading) {
    return (
      <HStack gap="1.5">
        <Spinner size="xs" color="fg.subtle" />
        <Text fontSize="xs" color="fg.subtle">Plans...</Text>
      </HStack>
    );
  }

  if (plans.length === 0) {
    return (
      <HStack gap="1.5">
        <LuLayoutDashboard size={12} color="var(--chakra-colors-fg-subtle)" />
        <Text fontSize="xs" color="fg.subtle">No plans</Text>
      </HStack>
    );
  }

  return (
    <Box position="relative" onMouseDown={(e) => e.stopPropagation()}>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active plan: ${activePlan?.name ?? "None"}`}
        maxW="160px"
      >
        <LuLayoutDashboard size={12} />
        <Text fontSize="xs" lineClamp={1} maxW="100px">
          {activePlan?.name ?? "Select plan"}
        </Text>
        <LuChevronDown size={10} />
      </Button>

      {open && (
        <Box
          position="absolute"
          bottom="calc(100% + 4px)"
          left="0"
          zIndex="popover"
          bg="bg"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xl"
          boxShadow="lg"
          minW="200px"
          maxW="260px"
          maxH="240px"
          overflowY="auto"
          py="1"
          role="listbox"
          aria-label="Select a plan"
        >
          <VStack align="stretch" gap="0">
            <Box px="3" py="1.5" borderBottomWidth="1px" borderColor="border.subtle">
              <Text fontSize="xs" fontWeight="700" color="fg.subtle" textTransform="uppercase" letterSpacing="wide">
                Your Plans
              </Text>
            </Box>

            {plans.map((plan) => {
              const isActive = plan.id === activePlanId;
              return (
                <Box
                  key={plan.id}
                  as="button"
                  w="100%"
                  textAlign="left"
                  px="3"
                  py="2"
                  role="option"
                  aria-selected={isActive}
                  bg={isActive ? "blue.50" : "transparent"}
                  _dark={{ bg: isActive ? "blue.900/30" : "transparent" }}
                  _hover={{ bg: isActive ? "blue.50" : "bg.subtle" }}
                  transition="background 0.1s"
                  onClick={() => {
                    onPlanChange(plan.id);
                    setOpen(false);
                  }}
                >
                  <HStack gap="2">
                    <Text fontSize="sm" fontWeight={isActive ? "600" : "400"} color={isActive ? "blue.fg" : "fg"} lineClamp={1} flex="1">
                      {plan.name}
                    </Text>
                    {isActive && (
                      <Badge size="xs" colorPalette="blue" variant="subtle" flexShrink={0}>
                        Active
                      </Badge>
                    )}
                  </HStack>
                </Box>
              );
            })}
          </VStack>
        </Box>
      )}
    </Box>
  );
}
