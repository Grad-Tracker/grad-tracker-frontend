import Link from "next/link";
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
import {
  LuArrowRight,
  LuBookOpen,
  LuCalendar,
  LuCircleAlert,
  LuCopyCheck,
  LuCompass,
  LuShare2,
} from "react-icons/lu";
import { compareTerms } from "@/types/planner";
import ComparePlanPicker from "@/components/shared-plans/ComparePlanPicker";
import type {
  ComparablePlanDetail,
  OwnPlanSummary,
  SharedPlanDetail,
  SharedPlanSummary,
} from "@/types/shared-plan";

function formatPrograms(programNames: string[]) {
  if (programNames.length === 0) {
    return "Program details unavailable";
  }

  return programNames.join(" / ");
}

function getCoursesForTerm(plan: SharedPlanDetail, termId: number) {
  return plan.plannedCourses.filter((course) => course.term_id === termId);
}

function getTermKey(term: { season: string; year: number }) {
  return `${term.year}-${term.season}`;
}

function getComparableCoursesForTerm(plan: ComparablePlanDetail, termKey: string) {
  const term = plan.terms.find((item) => getTermKey(item) === termKey);
  if (!term) {
    return [];
  }

  return plan.plannedCourses.filter((course) => course.term_id === term.id);
}

function renderCourseList(
  courses: ComparablePlanDetail["plannedCourses"],
  sharedCourseIds: Set<number>,
  emptyLabel: string
) {
  if (courses.length === 0) {
    return (
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border.subtle"
        borderRadius="xl"
        p="5"
        textAlign="center"
      >
        <Text fontSize="sm" color="fg.muted">
          {emptyLabel}
        </Text>
      </Box>
    );
  }

  return courses.map((item) => {
    const isSharedCourse = sharedCourseIds.has(item.course_id);

    return (
      <Box
        key={`${item.term_id}-${item.course_id}`}
        borderWidth="1px"
        borderColor={isSharedCourse ? "green.200" : "border.subtle"}
        borderRadius="xl"
        p="4"
        bg={isSharedCourse ? "green.subtle" : "bg.subtle"}
      >
        <HStack justify="space-between" align="start" gap="3">
          <Stack gap="1" minW="0">
            <HStack gap="2" flexWrap="wrap">
              <Text fontSize="sm" fontWeight="700" color="green.fg">
                {item.course.subject} {item.course.number}
              </Text>
              {isSharedCourse ? (
                <Badge colorPalette="green" variant="solid">
                  In both plans
                </Badge>
              ) : null}
            </HStack>
            <Text fontSize="sm" fontWeight="600">
              {item.course.title}
            </Text>
          </Stack>
          <Badge colorPalette="gray" variant="surface" flexShrink={0}>
            {item.course.credits} cr
          </Badge>
        </HStack>
      </Box>
    );
  });
}

function SinglePlanGrid({ plan }: { plan: SharedPlanDetail }) {
  const sortedTerms = [...plan.terms].sort(compareTerms);

  if (sortedTerms.length === 0) {
    return (
      <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Body py="14">
          <VStack gap="3">
            <Heading size="md" fontFamily="var(--font-outfit), sans-serif" fontWeight="400">
              No semesters have been added yet
            </Heading>
            <Text color="fg.muted" textAlign="center" maxW="lg">
              This shared plan exists, but there are not any semesters or courses to display yet.
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="5">
      {sortedTerms.map((term) => {
        const courses = getCoursesForTerm(plan, term.id);
        const totalCredits = courses.reduce((sum, item) => sum + (item.course?.credits ?? 0), 0);

        return (
          <Card.Root
            key={term.id}
            borderRadius="2xl"
            borderWidth="1px"
            borderColor="border.subtle"
            overflow="hidden"
          >
            <Box px="5" py="4" bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
              <HStack justify="space-between" align="start">
                <Stack gap="0.5">
                  <Heading
                    size="md"
                    fontFamily="var(--font-outfit), sans-serif"
                    fontWeight="400"
                    letterSpacing="-0.02em"
                  >
                    {term.season} {term.year}
                  </Heading>
                  <Text fontSize="sm" color="fg.muted">
                    {courses.length} course{courses.length === 1 ? "" : "s"}
                  </Text>
                </Stack>
                <Badge colorPalette="green" variant="subtle">
                  {totalCredits} cr
                </Badge>
              </HStack>
            </Box>

            <Card.Body p="4">
              <VStack align="stretch" gap="3">
                {renderCourseList(courses, new Set(), "No planned courses in this semester.")}
              </VStack>
            </Card.Body>

            <Box px="5" py="3" bg="bg.subtle" borderTopWidth="1px" borderColor="border.subtle">
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">
                  Semester total
                </Text>
                <Text fontSize="sm" fontWeight="700" color="green.fg">
                  {totalCredits} credits
                </Text>
              </HStack>
            </Box>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}

function ComparePlansView({
  sharedPlan,
  myPlan,
}: {
  sharedPlan: SharedPlanDetail;
  myPlan: ComparablePlanDetail;
}) {
  const termMap = new Map<string, SharedPlanDetail["terms"][number]>();
  [...sharedPlan.terms, ...myPlan.terms].forEach((term) => {
    termMap.set(getTermKey(term), term);
  });

  const alignedTerms = Array.from(termMap.values()).sort(compareTerms);

  const sharedCourseIds = new Set(sharedPlan.plannedCourses.map((course) => course.course_id));
  const myCourseIds = new Set(myPlan.plannedCourses.map((course) => course.course_id));
  const commonCourseIds = new Set(
    Array.from(sharedCourseIds).filter((courseId) => myCourseIds.has(courseId))
  );

  return (
    <Stack gap="6">
      <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Body p={{ base: "5", md: "6" }}>
          <Flex
            direction={{ base: "column", lg: "row" }}
            align={{ base: "start", lg: "center" }}
            justify="space-between"
            gap="4"
          >
            <Stack gap="2">
              <HStack gap="2">
                <Badge colorPalette="green" variant="solid">
                  Comparison View
                </Badge>
                <Badge colorPalette="gray" variant="surface">
                  {alignedTerms.length} aligned term{alignedTerms.length === 1 ? "" : "s"}
                </Badge>
              </HStack>
              <Heading size="lg" fontFamily="var(--font-outfit), sans-serif" fontWeight="400">
                {sharedPlan.planName} vs {myPlan.planName}
              </Heading>
              <Text color="fg.muted">
                Matching courses are highlighted so it is easy to spot overlap between the shared
                plan and your own.
              </Text>
            </Stack>
          </Flex>
        </Card.Body>
      </Card.Root>

      <Stack gap="5">
        {alignedTerms.map((term) => {
          const termKey = getTermKey(term);
          const sharedCourses = getComparableCoursesForTerm(sharedPlan, termKey);
          const myCourses = getComparableCoursesForTerm(myPlan, termKey);
          const sharedCredits = sharedCourses.reduce((sum, item) => sum + (item.course?.credits ?? 0), 0);
          const myCredits = myCourses.reduce((sum, item) => sum + (item.course?.credits ?? 0), 0);

          return (
            <Card.Root
              key={termKey}
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              overflow="hidden"
            >
              <Box px="5" py="4" bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
                <HStack justify="space-between" align="center">
                  <Heading
                    size="md"
                    fontFamily="var(--font-outfit), sans-serif"
                    fontWeight="400"
                    letterSpacing="-0.02em"
                  >
                    {term.season} {term.year}
                  </Heading>
                  <Badge colorPalette="green" variant="subtle">
                    Side-by-side
                  </Badge>
                </HStack>
              </Box>

              <Card.Body p={{ base: "4", md: "5" }}>
                <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="5">
                  {[
                    {
                      label: `${sharedPlan.studentFirstName}'s shared plan`,
                      planName: sharedPlan.planName,
                      courses: sharedCourses,
                      credits: sharedCredits,
                    },
                    {
                      label: "My plan",
                      planName: myPlan.planName,
                      courses: myCourses,
                      credits: myCredits,
                    },
                  ].map((column) => (
                    <Box
                      key={`${termKey}-${column.label}`}
                      borderWidth="1px"
                      borderColor="border.subtle"
                      borderRadius="2xl"
                      overflow="hidden"
                    >
                      <Box px="4" py="3" bg="bg.subtle" borderBottomWidth="1px" borderColor="border.subtle">
                        <HStack justify="space-between" align="start">
                          <Stack gap="0.5">
                            <Text fontSize="xs" color="fg.muted" fontWeight="700" letterSpacing="0.08em">
                              {column.label.toUpperCase()}
                            </Text>
                            <Text fontWeight="700">{column.planName}</Text>
                          </Stack>
                          <Badge colorPalette="gray" variant="surface">
                            {column.credits} cr
                          </Badge>
                        </HStack>
                      </Box>

                      <VStack align="stretch" gap="3" p="4">
                        {renderCourseList(
                          column.courses,
                          commonCourseIds,
                          "No courses planned for this term."
                        )}
                      </VStack>
                    </Box>
                  ))}
                </Grid>
              </Card.Body>
            </Card.Root>
          );
        })}
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="4">
        <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <HStack gap="3">
              <Icon color="green.fg" boxSize="5">
                <LuCopyCheck />
              </Icon>
              <Box>
                <Text fontSize="sm" color="fg.muted">
                  Courses in Common
                </Text>
                <Text fontSize="2xl" fontWeight="800">
                  {commonCourseIds.size}
                </Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Text fontSize="sm" color="fg.muted">
              Unique to Shared Plan
            </Text>
            <Text fontSize="2xl" fontWeight="800">
              {Array.from(sharedCourseIds).filter((courseId) => !myCourseIds.has(courseId)).length}
            </Text>
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Text fontSize="sm" color="fg.muted">
              Unique to My Plan
            </Text>
            <Text fontSize="2xl" fontWeight="800">
              {Array.from(myCourseIds).filter((courseId) => !sharedCourseIds.has(courseId)).length}
            </Text>
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Text fontSize="sm" color="fg.muted">
              Planned Credit Difference
            </Text>
            <Text fontSize="2xl" fontWeight="800">
              {myPlan.totalPlannedCredits - sharedPlan.totalPlannedCredits > 0 ? "+" : ""}
              {myPlan.totalPlannedCredits - sharedPlan.totalPlannedCredits}
            </Text>
            <Text fontSize="xs" color="fg.muted" mt="1">
              My plan {myPlan.totalPlannedCredits} vs shared {sharedPlan.totalPlannedCredits}
            </Text>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>
    </Stack>
  );
}

export function SharedPlanUnavailable({
  title = "This shared plan is not available",
  description = "The link may be invalid, expired, or turned off by the person who shared it.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Flex minH="100vh" bg="bg.subtle" align="center" justify="center" px="4" py="10">
      <Card.Root maxW="xl" w="full" borderRadius="3xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Body p={{ base: "6", md: "8" }}>
          <VStack align="start" gap="5">
            <Box
              w="14"
              h="14"
              borderRadius="2xl"
              bg="orange.subtle"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon color="orange.fg" boxSize="6">
                <LuCircleAlert />
              </Icon>
            </Box>
            <Stack gap="2">
              <Heading
                size="lg"
                fontFamily="var(--font-outfit), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                {title}
              </Heading>
              <Text color="fg.muted">{description}</Text>
            </Stack>
            <Button asChild colorPalette="green" borderRadius="xl">
              <Link href="/shared/plans">Browse Shared Plans</Link>
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
}

export function SharedPlansIndex({ plans }: { plans: SharedPlanSummary[] }) {
  return (
    <Box minH="100vh" bg="bg.subtle" px={{ base: "4", md: "8" }} py={{ base: "8", md: "10" }}>
      <Box maxW="7xl" mx="auto">
        <Flex
          justify="space-between"
          align={{ base: "start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap="4"
          mb="8"
        >
          <Stack gap="2">
            <HStack gap="3">
              <Box
                w="11"
                h="11"
                borderRadius="2xl"
                bg="green.subtle"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon color="green.fg" boxSize="5">
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
            <Text color="fg.muted" maxW="2xl">
              Explore public, read-only degree plans to compare pacing, course sequencing, and
              graduation strategies before building your own version in the planner.
            </Text>
          </Stack>

          <Button asChild variant="outline" borderRadius="xl">
            <Link href="/dashboard/planner">Back to Planner</Link>
          </Button>
        </Flex>

        {plans.length === 0 ? (
          <Card.Root borderRadius="3xl" borderWidth="1px" borderColor="border.subtle">
            <Card.Body py="16" px="8">
              <VStack gap="4" textAlign="center">
                <Box
                  w="16"
                  h="16"
                  borderRadius="3xl"
                  bg="green.subtle"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color="green.fg" boxSize="7">
                    <LuCompass />
                  </Icon>
                </Box>
                <Heading size="lg" fontFamily="var(--font-outfit), sans-serif" fontWeight="400">
                  No shared plans yet
                </Heading>
                <Text color="fg.muted" maxW="lg">
                  Shared plans will show up here once students or advisors start publishing public
                  planning links.
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="5">
            {plans.map((plan) => (
              <Card.Root
                key={plan.shareToken}
                borderRadius="2xl"
                borderWidth="1px"
                borderColor="border.subtle"
                overflow="hidden"
              >
                <Card.Body p="5">
                  <VStack align="start" gap="4">
                    <Stack gap="1.5">
                      <HStack gap="2" flexWrap="wrap">
                        <Badge colorPalette="green" variant="subtle">
                          {plan.studentFirstName}'s plan
                        </Badge>
                        {plan.programNames.length > 0 ? (
                          <Badge colorPalette="gray" variant="surface">
                            {plan.programNames.length} program{plan.programNames.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null}
                      </HStack>
                      <Heading
                        size="md"
                        fontFamily="var(--font-outfit), sans-serif"
                        fontWeight="400"
                        letterSpacing="-0.02em"
                      >
                        {plan.planName}
                      </Heading>
                      <Text fontSize="sm" color="fg.muted">
                        {formatPrograms(plan.programNames)}
                      </Text>
                    </Stack>

                    <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="3" w="full">
                      <Box p="3" borderRadius="xl" bg="bg.subtle">
                        <Text fontSize="xs" color="fg.muted" mb="1">
                          Semesters
                        </Text>
                        <Text fontSize="lg" fontWeight="700">
                          {plan.termCount}
                        </Text>
                      </Box>
                      <Box p="3" borderRadius="xl" bg="bg.subtle">
                        <Text fontSize="xs" color="fg.muted" mb="1">
                          Planned Credits
                        </Text>
                        <Text fontSize="lg" fontWeight="700">
                          {plan.totalPlannedCredits}
                        </Text>
                      </Box>
                    </Grid>

                    {plan.description ? (
                      <Text fontSize="sm" color="fg.muted" lineClamp="3">
                        {plan.description}
                      </Text>
                    ) : null}

                    <Button asChild colorPalette="green" borderRadius="xl" w="full">
                      <Link href={`/shared/plan/${plan.shareToken}`}>
                        Open Shared Plan
                        <LuArrowRight size={16} />
                      </Link>
                    </Button>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}

export function SharedPlanView({
  plan,
  showPlannerCta = false,
  ownPlans = [],
  comparisonPlan = null,
}: {
  plan: SharedPlanDetail;
  showPlannerCta?: boolean;
  ownPlans?: OwnPlanSummary[];
  comparisonPlan?: ComparablePlanDetail | null;
}) {
  return (
    <Box minH="100vh" bg="bg.subtle" px={{ base: "4", md: "8" }} py={{ base: "8", md: "10" }}>
      <Box maxW="7xl" mx="auto">
        <Stack gap="8">
          <Card.Root
            borderRadius="3xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="linear-gradient(135deg, var(--chakra-colors-bg) 0%, var(--chakra-colors-green-subtle) 100%)"
            overflow="hidden"
          >
            <Card.Body p={{ base: "6", md: "8" }}>
              <Flex
                direction={{ base: "column", lg: "row" }}
                justify="space-between"
                align={{ base: "start", lg: "center" }}
                gap="6"
              >
                <Stack gap="3" maxW="3xl">
                  <HStack gap="2" flexWrap="wrap">
                    <Badge colorPalette="green" variant="solid">
                      Shared read-only plan
                    </Badge>
                    <Badge colorPalette="gray" variant="surface">
                      {plan.studentFirstName}'s plan
                    </Badge>
                  </HStack>
                  <Stack gap="1.5">
                    <Heading
                      size="2xl"
                      fontFamily="var(--font-outfit), sans-serif"
                      fontWeight="400"
                      letterSpacing="-0.03em"
                    >
                      {plan.planName}
                    </Heading>
                    <Text color="fg.muted" fontSize="md">
                      {formatPrograms(plan.programNames)}
                    </Text>
                    {plan.description ? <Text color="fg.muted">{plan.description}</Text> : null}
                  </Stack>
                </Stack>

                <Stack gap="3" align={{ base: "stretch", lg: "end" }} w={{ base: "full", lg: "auto" }}>
                  {showPlannerCta ? (
                    ownPlans.length > 0 ? (
                      <ComparePlanPicker
                        plans={ownPlans}
                        selectedPlanId={comparisonPlan?.planId ?? null}
                      />
                    ) : (
                      <Button disabled borderRadius="xl">
                        Compare with My Plan
                      </Button>
                    )
                  ) : null}
                  {showPlannerCta ? (
                    <Button asChild colorPalette="green" borderRadius="xl">
                      <Link href="/dashboard/planner">
                        Open in Planner
                        <LuArrowRight size={16} />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" borderRadius="xl">
                      <Link href="/shared/plans">View More Shared Plans</Link>
                    </Button>
                  )}
                  <Text fontSize="xs" color="fg.muted" maxW="xs">
                    This version is view-only. No drag-and-drop, editing, or plan changes are
                    available from a shared link.
                  </Text>
                </Stack>
              </Flex>
            </Card.Body>
          </Card.Root>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
            <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="5">
                <HStack gap="3" align="start">
                  <Icon color="green.fg" boxSize="5">
                    <LuBookOpen />
                  </Icon>
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      Planned Credits
                    </Text>
                    <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
                      {plan.totalPlannedCredits}
                    </Text>
                  </Box>
                </HStack>
              </Card.Body>
            </Card.Root>

            <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="5">
                <HStack gap="3" align="start">
                  <Icon color="blue.fg" boxSize="5">
                    <LuCalendar />
                  </Icon>
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      Semesters
                    </Text>
                    <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
                      {plan.terms.length}
                    </Text>
                  </Box>
                </HStack>
              </Card.Body>
            </Card.Root>

            <Card.Root borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="5">
                <HStack gap="3" align="start">
                  <Icon color="orange.fg" boxSize="5">
                    <LuCompass />
                  </Icon>
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      Completed Credits
                    </Text>
                    <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
                      {plan.completedCredits}
                    </Text>
                  </Box>
                </HStack>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          {comparisonPlan ? (
            <ComparePlansView sharedPlan={plan} myPlan={comparisonPlan} />
          ) : (
            <SinglePlanGrid plan={plan} />
          )}
        </Stack>
      </Box>
    </Box>
  );
}
