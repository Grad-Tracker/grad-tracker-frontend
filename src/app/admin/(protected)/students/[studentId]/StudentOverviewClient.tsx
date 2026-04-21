"use client";

import Link from "next/link";
import {
  Badge,
  Box,
  Card,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Progress,
} from "@chakra-ui/react";
import {
  BreadcrumbCurrentLink,
  BreadcrumbLink,
  BreadcrumbRoot,
} from "@/components/ui/breadcrumb";
import { getProgramColor } from "@/lib/program-colors";
import type { StudentOverview } from "@/lib/supabase/queries/advisor-students";

function progressColor(pct: number): string {
  if (pct >= 75) return "green";
  if (pct >= 40) return "yellow";
  return "red";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function StudentOverviewClient({
  overview,
}: {
  overview: StudentOverview;
}) {
  const { profile, programs, genEdProgress, plans } = overview;
  const fullName = `${profile.firstName} ${profile.lastName}`;

  return (
    <Stack gap="6">
      <BreadcrumbRoot size="sm">
        <BreadcrumbLink asChild>
          <Link href="/admin">Admin</Link>
        </BreadcrumbLink>
        <BreadcrumbLink asChild>
          <Link href="/admin/students">Students</Link>
        </BreadcrumbLink>
        <BreadcrumbCurrentLink>{fullName}</BreadcrumbCurrentLink>
      </BreadcrumbRoot>

      <Card.Root borderWidth="1px" borderColor="border.subtle">
        <Card.Body p="6">
          <Heading
            fontSize="2xl"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="700"
            letterSpacing="-0.02em"
          >
            {fullName}
          </Heading>
          <Text color="fg.muted" fontSize="sm" mt="1">
            {profile.email}
          </Text>
          {(profile.expectedGradSemester || profile.expectedGradYear) && (
            <Text mt="2" fontSize="sm">
              Expected graduation:{" "}
              <Text as="span" fontWeight="500">
                {profile.expectedGradSemester ?? ""} {profile.expectedGradYear ?? ""}
              </Text>
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      <Box>
        <Heading
          fontSize="md"
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="600"
          mb="3"
        >
          Progress
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
          {programs.map((p) => (
            <Card.Root key={p.id} borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="4">
                <HStack justify="space-between" mb="2">
                  <Badge colorPalette={getProgramColor(p.programType)} variant="surface" size="sm">
                    {p.name}
                  </Badge>
                  <Text fontSize="sm" fontWeight="600">{p.progressPct}%</Text>
                </HStack>
                <Progress.Root value={p.progressPct} size="sm" colorPalette={progressColor(p.progressPct)}>
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <Text fontSize="xs" color="fg.muted" mt="2">
                  {p.completedReqs} of {p.totalReqs} requirements complete
                </Text>
              </Card.Body>
            </Card.Root>
          ))}
          <Card.Root borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="4">
              <HStack justify="space-between" mb="2">
                <Badge colorPalette="purple" variant="surface" size="sm">Gen-Ed</Badge>
                <Text fontSize="sm" fontWeight="600">{genEdProgress.progressPct}%</Text>
              </HStack>
              <Progress.Root value={genEdProgress.progressPct} size="sm" colorPalette={progressColor(genEdProgress.progressPct)}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Text fontSize="xs" color="fg.muted" mt="2">
                {genEdProgress.completed} of {genEdProgress.total} courses complete
              </Text>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>
      </Box>

      <Box>
        <Heading
          fontSize="md"
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="600"
          mb="3"
        >
          Plans
        </Heading>
        {plans.length === 0 ? (
          <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
            <Card.Body py="10" textAlign="center">
              <Text color="fg.muted">
                {profile.firstName} hasn&apos;t created a plan yet.
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {plans.map((plan, idx) => (
              <Link
                key={plan.id}
                href={`/admin/students/${profile.id}/planner?planId=${plan.id}`}
                style={{ textDecoration: "none" }}
              >
                <Card.Root
                  borderWidth="1px"
                  borderColor="border.subtle"
                  cursor="pointer"
                  transition="all 0.15s"
                  _hover={{ borderColor: "border", transform: "translateY(-2px)", boxShadow: "md" }}
                  h="full"
                >
                  <Card.Body p="5">
                    <VStack align="stretch" gap="2">
                      <HStack justify="space-between">
                        <Text fontWeight="600">{plan.name}</Text>
                        {idx === 0 && (
                          <Badge colorPalette="blue" variant="subtle" size="sm">
                            Latest
                          </Badge>
                        )}
                      </HStack>
                      {plan.description && (
                        <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                          {plan.description}
                        </Text>
                      )}
                      <Text fontSize="xs" color="fg.muted">
                        {plan.termCount} {plan.termCount === 1 ? "term" : "terms"} · Updated {fmtDate(plan.updatedAt)}
                      </Text>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </Link>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Stack>
  );
}
