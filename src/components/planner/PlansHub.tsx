"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuArrowRight, LuPlus, LuSparkles, LuLayoutGrid, LuShare2 } from "react-icons/lu";
import type { PlanWithMeta } from "@/types/planner";
import type { SharedPlanSummary } from "@/types/shared-plan";
import { EmptyState } from "@/components/ui/empty-state";
import PlanCard from "./PlanCard";

interface PlansHubProps {
  plans: PlanWithMeta[];
  onOpenPlan: (planId: number) => void;
  onCreatePlan: () => void;
  onRenamePlan: (planId: number, newName: string) => Promise<void>;
  onDeletePlan: (planId: number) => void;
  canEdit?: boolean;
}

function handleKeyboardActivate(
  e: React.KeyboardEvent,
  onActivate: () => void
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
}

export default function PlansHub({
  plans,
  onOpenPlan,
  onCreatePlan,
  onRenamePlan,
  onDeletePlan,
  canEdit = true,
}: PlansHubProps) {
  const totalCredits = plans.reduce((s, p) => s + p.total_credits, 0);
  const totalCourses = plans.reduce((s, p) => s + p.course_count, 0);
  const [sharedPlans, setSharedPlans] = useState<SharedPlanSummary[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadSharedPlans() {
      try {
        const response = await fetch("/api/shared-plans?limit=3", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { plans?: SharedPlanSummary[] };
        if (alive) {
          setSharedPlans(data.plans ?? []);
        }
      } catch {
        if (alive) {
          setSharedPlans([]);
        }
      }
    }

    loadSharedPlans();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <Box
      flex="1"
      overflowY="auto"
      px={{ base: "5", md: "10", xl: "16" }}
      py={{ base: "6", md: "10" }}
    >
      {/* Hero section */}
      <Flex
        justify="space-between"
        align="start"
        mb={{ base: "8", md: "12" }}
        flexWrap="wrap"
        gap="4"
        className="plan-card-enter"
      >
        <Box>
          <HStack gap="3" mb="2">
            <Box
              w="10"
              h="10"
              borderRadius="xl"
              bg="blue.subtle"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon color="blue.fg" boxSize="5">
                <LuLayoutGrid />
              </Icon>
            </Box>
            <Heading
              size="2xl"
              fontFamily="var(--font-outfit), sans-serif"
              fontWeight="400"
              letterSpacing="-0.03em"
            >
              Your Plans
            </Heading>
          </HStack>
          <Text color="fg.muted" fontSize="sm" maxW="480px">
            Create different graduation scenarios to explore your options.
            Each plan tracks its own semesters, courses, and progress independently.
          </Text>
        </Box>

        {canEdit && (
          <Button
            aria-label="Create a new plan"
            colorPalette="blue"
            borderRadius="xl"
            size="lg"
            onClick={onCreatePlan}
            boxShadow="0 2px 12px rgba(37, 99, 235, 0.2)"
            _hover={{
              boxShadow: "0 4px 20px rgba(37, 99, 235, 0.3)",
              transform: "translateY(-1px)",
            }}
            transition="all 0.2s"
          >
            <LuPlus size={18} />
            New Plan
          </Button>
        )}
      </Flex>

      {/* Quick stats */}
      {plans.length > 0 && (
        <HStack
          gap="6"
          mb="8"
          px="1"
          className="plan-card-enter"
          style={{ animationDelay: "60ms" }}
        >
          <HStack gap="2">
            <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
              {plans.length}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {plans.length === 1 ? "plan" : "plans"}
            </Text>
          </HStack>
          <Box w="1px" h="6" bg="border.subtle" />
          <HStack gap="2">
            <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
              {totalCourses}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              total courses
            </Text>
          </HStack>
          <Box w="1px" h="6" bg="border.subtle" />
          <HStack gap="2">
            <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
              {totalCredits}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              total credits
            </Text>
          </HStack>
        </HStack>
      )}

      {/* Plans grid */}
      {plans.length === 0 ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          py="20"
          className="plan-card-enter"
        >
          <EmptyState
            icon={<LuSparkles />}
            title="No plans yet"
            description="Create your first graduation plan to start mapping out your semesters and courses."
            mb="6"
          />
          {canEdit && (
            <Button
              aria-label="Create your first plan"
              colorPalette="blue"
              borderRadius="xl"
              size="lg"
              onClick={onCreatePlan}
            >
              <LuPlus size={18} />
              Create Your First Plan
            </Button>
          )}
        </Flex>
      ) : (
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
            xl: "repeat(3, 1fr)",
          }}
          gap="5"
        >
          {plans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onOpen={onOpenPlan}
              onRename={onRenamePlan}
              onDelete={onDeletePlan}
              canDelete={plans.length > 1}
              index={i}
              canEdit={canEdit}
            />
          ))}

          {/* New Plan card */}
          {canEdit && (
            <Box
              role="button"
              tabIndex={0}
              aria-label="Create a new plan"
              borderRadius="2xl"
              borderWidth="2px"
              borderStyle="dashed"
              borderColor="border.subtle"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minH="200px"
              cursor="pointer"
              transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              _hover={{
                borderColor: "blue.300",
                bg: "blue.subtle",
                transform: "translateY(-2px)",
              }}
              onClick={onCreatePlan}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCreatePlan();
                }
              }}
              className="plan-card-enter"
              style={{ animationDelay: `${plans.length * 80}ms` }}
            >
              <Box
                w="12"
                h="12"
                borderRadius="2xl"
                bg="bg.subtle"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mb="3"
                transition="all 0.2s"
                _groupHover={{ bg: "blue.subtle" }}
              >
                <LuPlus size={24} color="var(--chakra-colors-fg-muted)" />
              </Box>
              <Text fontWeight="600" fontSize="sm" color="fg.muted">
                Create New Plan
              </Text>
              <Text fontSize="xs" color="fg.subtle" mt="1">
                Explore a different scenario
              </Text>
            </Box>
          )}
        </Grid>
      )}

      <Flex
        justify="space-between"
        align="start"
        mt={{ base: "10", md: "14" }}
        mb={{ base: "6", md: "8" }}
        flexWrap="wrap"
        gap="4"
        className="plan-card-enter"
        style={{ animationDelay: "120ms" }}
      >
        <Box>
          <HStack gap="3" mb="2">
            <Box
              w="10"
              h="10"
              borderRadius="xl"
              bg="blue.subtle"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon color="blue.fg" boxSize="5">
                <LuShare2 />
              </Icon>
            </Box>
            <Heading
              size="2xl"
              fontFamily="var(--font-outfit), sans-serif"
              fontWeight="400"
              letterSpacing="-0.03em"
            >
              Shared Plans
            </Heading>
          </HStack>
          <Text color="fg.muted" fontSize="sm" maxW="560px">
            Browse public degree plans shared by students and advisors. Open a read-only version
            to compare semester pacing, course sequencing, and overall progress.
          </Text>
        </Box>

        <Button asChild colorPalette="blue" borderRadius="xl" size="lg" aria-label="Browse shared plans">
          <Link href="/shared/plans">
            <LuShare2 size={18} />
            View Shared Plans
          </Link>
        </Button>
      </Flex>

      {sharedPlans.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="5">
          {sharedPlans.map((plan, index) => (
            <Card.Root
              key={plan.shareToken}
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              bg="bg"
              overflow="hidden"
              transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              _hover={{
                borderColor: "blue.300",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
                transform: "translateY(-4px)",
              }}
              className="plan-card-enter"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Box h="3px" bg="blue.500" />
              <Card.Body p="5">
                <VStack align="start" gap="4">
                  <Stack gap="1.5">
                    <HStack gap="2" flexWrap="wrap">
                      <Badge colorPalette="blue" variant="subtle">
                        {plan.studentFirstName}'s plan
                      </Badge>
                      <Badge colorPalette="gray" variant="surface">
                        {plan.termCount} semester{plan.termCount === 1 ? "" : "s"}
                      </Badge>
                    </HStack>
                    <Heading
                      size="md"
                      fontFamily="var(--font-outfit), sans-serif"
                      fontWeight="400"
                      letterSpacing="-0.02em"
                    >
                      {plan.planName}
                    </Heading>
                    <Text fontSize="sm" color="fg.muted" lineClamp="2">
                      {plan.programNames.length > 0
                        ? plan.programNames.join(" / ")
                        : "Program details unavailable"}
                    </Text>
                  </Stack>

                  <HStack gap="4">
                    <Box>
                      <Text fontSize="lg" fontWeight="700" lineHeight="1">
                        {plan.totalPlannedCredits}
                      </Text>
                      <Text fontSize="2xs" color="fg.muted">
                        credits
                      </Text>
                    </Box>
                    <Box w="1px" h="8" bg="border.subtle" />
                    <Box>
                      <Text fontSize="lg" fontWeight="700" lineHeight="1">
                        {plan.termCount}
                      </Text>
                      <Text fontSize="2xs" color="fg.muted">
                        semesters
                      </Text>
                    </Box>
                  </HStack>
                </VStack>
              </Card.Body>

              <Flex
                px="5"
                py="3"
                borderTopWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
                align="center"
                justify="space-between"
              >
                <Text fontSize="xs" color="fg.muted">
                  Recommended shared plan
                </Text>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  colorPalette="blue"
                  borderRadius="lg"
                  aria-label={`Open shared plan ${plan.planName}`}
                >
                  <Link href={`/shared/plan/${plan.shareToken}`}>
                    Open
                    <LuArrowRight size={14} />
                  </Link>
                </Button>
              </Flex>
            </Card.Root>
          ))}
        </SimpleGrid>
      ) : null}
    </Box>
  );
}
