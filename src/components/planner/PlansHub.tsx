"use client";

import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
  Button,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuArrowRight, LuPlus, LuSparkles, LuLayoutGrid, LuShare2 } from "react-icons/lu";
import type { PlanWithMeta } from "@/types/planner";
import PlanCard from "./PlanCard";

interface PlansHubProps {
  plans: PlanWithMeta[];
  onOpenPlan: (planId: number) => void;
  onCreatePlan: () => void;
  onRenamePlan: (planId: number, newName: string) => Promise<void>;
  onDeletePlan: (planId: number) => void;
}

export default function PlansHub({
  plans,
  onOpenPlan,
  onCreatePlan,
  onRenamePlan,
  onDeletePlan,
}: PlansHubProps) {
  const totalCredits = plans.reduce((s, p) => s + p.total_credits, 0);
  const totalCourses = plans.reduce((s, p) => s + p.course_count, 0);

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
              bg="green.subtle"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon color="green.fg" boxSize="5">
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

        <Button
          colorPalette="green"
          borderRadius="xl"
          size="lg"
          onClick={onCreatePlan}
          boxShadow="0 2px 12px rgba(34, 139, 34, 0.2)"
          _hover={{
            boxShadow: "0 4px 20px rgba(34, 139, 34, 0.3)",
            transform: "translateY(-1px)",
          }}
          transition="all 0.2s"
        >
          <LuPlus size={18} />
          New Plan
        </Button>
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
          <Box
            w="20"
            h="20"
            borderRadius="3xl"
            bg="green.subtle"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mb="6"
          >
            <LuSparkles size={40} color="var(--chakra-colors-green-fg)" />
          </Box>
          <Heading
            size="lg"
            mb="3"
            fontFamily="var(--font-outfit), sans-serif"
            fontWeight="400"
            letterSpacing="-0.02em"
          >
            No plans yet
          </Heading>
          <Text color="fg.muted" fontSize="sm" mb="6" textAlign="center" maxW="360px">
            Create your first graduation plan to start mapping out your semesters and courses.
          </Text>
          <Button
            colorPalette="green"
            borderRadius="xl"
            size="lg"
            onClick={onCreatePlan}
          >
            <LuPlus size={18} />
            Create Your First Plan
          </Button>
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
            />
          ))}

          {/* New Plan card */}
          <Box
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
              borderColor: "green.300",
              bg: "green.subtle",
              transform: "translateY(-2px)",
            }}
            onClick={onCreatePlan}
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
              _groupHover={{ bg: "green.subtle" }}
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
        </Grid>
      )}

      <Card.Root
        mt="8"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="linear-gradient(135deg, var(--chakra-colors-bg) 0%, var(--chakra-colors-green-subtle) 100%)"
        className="plan-card-enter"
        style={{ animationDelay: "120ms" }}
      >
        <Card.Body p={{ base: "5", md: "6" }}>
          <Flex
            gap="4"
            align={{ base: "start", md: "center" }}
            justify="space-between"
            direction={{ base: "column", md: "row" }}
          >
            <HStack gap="3" align="start">
              <Box
                w="11"
                h="11"
                borderRadius="2xl"
                bg="bg"
                borderWidth="1px"
                borderColor="border.subtle"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                <Icon color="green.fg" boxSize="5">
                  <LuShare2 />
                </Icon>
              </Box>
              <VStack align="start" gap="1">
                <Heading
                  size="md"
                  fontFamily="var(--font-outfit), sans-serif"
                  fontWeight="400"
                  letterSpacing="-0.02em"
                >
                  Shared Plans
                </Heading>
                <Text fontSize="sm" color="fg.muted" maxW="620px">
                  Browse public degree plans shared by students and advisors. Open a read-only
                  version to compare semester pacing, course sequencing, and overall progress.
                </Text>
              </VStack>
            </HStack>

            <Button asChild colorPalette="green" variant="solid" borderRadius="xl" size="md">
              <Link href="/shared/plans">
                View Plans
                <LuArrowRight size={16} />
              </Link>
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
