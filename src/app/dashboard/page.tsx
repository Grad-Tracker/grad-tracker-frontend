"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Avatar,
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
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  checkOnboardingStatus,
  getOrCreateStudent,
} from "@/lib/supabase/queries/onboarding";
import {
  DB_TABLES,
  PROGRAM_TYPES,
  STUDENT_COLUMNS,
} from "@/lib/supabase/queries/schema";
import { toaster } from "@/components/ui/toaster";
import {
  ProgressBar,
  ProgressLabel,
  ProgressRoot,
  ProgressValueText,
} from "@/components/ui/progress";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
} from "@/components/ui/progress-circle";
import {
  LuBookOpen,
  LuChevronRight,
  LuSparkles,
  LuPlus,
  LuTrendingUp,
  LuClock,
  LuCircleCheck,
  LuCircleAlert,
  LuArrowRight,
  LuFileText,
  LuCalendar,
  LuTarget,
} from "react-icons/lu";

const mockRecentActivity = [
  {
    type: "course_added",
    message: "Added CS 350 to current semester",
    time: "2 hours ago",
  },
  {
    type: "requirement_met",
    message: "Completed General Education requirements",
    time: "1 day ago",
  },
  {
    type: "alert",
    message: "CS 361 has a prerequisite you haven't completed",
    time: "2 days ago",
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const completed = await checkOnboardingStatus(user.id);
        setHasCompletedOnboarding(completed);
      } catch {
        // Default to hiding banner on error
      }
    }
    checkStatus();
  }, []);

  type StudentRow = {
    id: number;
    name?: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    has_completed_onboarding: boolean | null;
    expected_graduation_semester: string | null;
    expected_graduation_term?: string | null;
    expected_graduation_year: number | null;
  };

  type DashboardStudent = {
    id: number;
    name: string;
    email: string;
    major: string;
    expectedGraduation: string;
    hasCompletedOnboarding: boolean;
  };

  const [student, setStudent] = React.useState<DashboardStudent | null>(null);
  const [loadingStudent, setLoadingStudent] = React.useState(true);

  type ProgressSummary = {
    overall: number;
    totalCredits: number;
    completedCredits: number;
    inProgressCredits: number;
    remainingCredits: number;
  };

  const TOTAL_REQUIRED_CREDITS = 120;

  const [progress, setProgress] = React.useState<ProgressSummary>({
    overall: 0,
    totalCredits: TOTAL_REQUIRED_CREDITS,
    completedCredits: 0,
    inProgressCredits: 0,
    remainingCredits: TOTAL_REQUIRED_CREDITS,
  });

  const [loadingProgress, setLoadingProgress] = React.useState(true);

  type RequirementBar = {
    name: string;
    completed: number;
    total: number;
    percentage: number;
    color: "green" | "blue" | "purple" | "orange";
  };

  const DEFAULT_REQUIREMENTS: RequirementBar[] = [
    { name: "General Education", completed: 0, total: 0, percentage: 0, color: "green" },
    { name: "Major Core", completed: 0, total: 0, percentage: 0, color: "blue" },
    { name: "Major Electives", completed: 0, total: 0, percentage: 0, color: "purple" },
    { name: "Free Electives", completed: 0, total: 0, percentage: 0, color: "orange" },
  ];

  const [requirements, setRequirements] = React.useState<RequirementBar[]>(DEFAULT_REQUIREMENTS);
  const [loadingRequirements, setLoadingRequirements] = React.useState(true);

  type PlannedCourseCard = {
    code: string;
    name: string;
    credits: number;
    status: "enrolled" | "waitlist" | "planned" | "unknown";
  };

  const [currentCourses, setCurrentCourses] = React.useState<PlannedCourseCard[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);

  React.useEffect(() => {
    const loadStudent = async () => {
      setLoadingStudent(true);
      const supabase = createClient();

      try {
        // 1) Logged-in user
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          router.push("/signin");
          return;
        }

        // 2) Student row via auth_user_id (new schema first, then legacy fallback)
        const { data: studentRowNew, error: studentErrNew } = await supabase
          .from(DB_TABLES.students)
          .select(
            "id,first_name,last_name,email,has_completed_onboarding,expected_graduation_semester,expected_graduation_year"
          )
          .eq(STUDENT_COLUMNS.authUserId, userData.user.id)
          .maybeSingle<StudentRow>();

        let studentRow = studentRowNew;
        let studentErr = studentErrNew;

        if (studentErrNew && String(studentErrNew.message ?? "").includes("column")) {
          const { data: studentRowLegacy, error: studentErrLegacy } = await supabase
            .from(DB_TABLES.students)
            .select("id,name,email,has_completed_onboarding,expected_graduation_term,expected_graduation_year")
            .eq(STUDENT_COLUMNS.authUserId, userData.user.id)
            .maybeSingle<{
              id: number;
              name: string | null;
              email: string | null;
              has_completed_onboarding: boolean | null;
              expected_graduation_term: string | null;
              expected_graduation_year: number | null;
            }>();

          studentErr = studentErrLegacy;
          studentRow = studentRowLegacy
            ? {
                id: studentRowLegacy.id,
                name: studentRowLegacy.name,
                first_name: null,
                last_name: null,
                email: studentRowLegacy.email,
                has_completed_onboarding: studentRowLegacy.has_completed_onboarding,
                expected_graduation_semester: studentRowLegacy.expected_graduation_term,
                expected_graduation_term: studentRowLegacy.expected_graduation_term,
                expected_graduation_year: studentRowLegacy.expected_graduation_year,
              }
            : null;
        }

        if (studentErr) {
          toaster.create({
            title: "Profile not found",
            description: studentErr.message ?? "We couldn't load your student profile.",
            type: "error",
          });
          await supabase.auth.signOut();
          router.push("/signin");
          return;
        }

        let resolvedStudentRow = studentRow;
        if (!resolvedStudentRow) {
          const displayName =
            userData.user.user_metadata?.first_name
              ? `${userData.user.user_metadata.first_name} ${userData.user.user_metadata?.last_name ?? ""}`.trim()
              : userData.user.email ?? "Student";

          const created = await getOrCreateStudent(
            userData.user.id,
            userData.user.email ?? "",
            displayName
          );

          resolvedStudentRow = {
            id: created.id,
            first_name: userData.user.user_metadata?.first_name ?? null,
            last_name: userData.user.user_metadata?.last_name ?? null,
            email: userData.user.email ?? null,
            has_completed_onboarding: false,
            expected_graduation_semester: null,
            expected_graduation_year: null,
          };

          toaster.create({
            title: "Profile restored",
            description: "Your student profile was missing and has been recreated.",
            type: "info",
          });
        }

        // 3) Major (student_programs -> programs)
        let majorName = "Unknown";
        let majorProgramId: number | null = null;

        const { data: studentPrograms, error: spErr } = await supabase
          .from(DB_TABLES.studentPrograms)
          .select("program_id")
          .eq("student_id", resolvedStudentRow.id);

        if (!spErr && studentPrograms?.length) {
          const programIds = studentPrograms.map((sp: any) => sp.program_id);

          const { data: majorProgram, error: majorProgramErr } = await supabase
            .from(DB_TABLES.programs)
            .select("id,name")
            .in("id", programIds)
            .eq("program_type", PROGRAM_TYPES.major)
            .maybeSingle();

          if (!majorProgramErr && majorProgram?.name) {
            majorName = majorProgram.name;
            majorProgramId = majorProgram.id;
          }
        }

        // 4) Degree requirements progress (blocks + courses vs student history)
        setLoadingRequirements(true);

        if (!majorProgramId) {
          setRequirements(DEFAULT_REQUIREMENTS);
          setLoadingRequirements(false);
        } else {
          const { data: completedCourseRows } = await supabase
            .from(DB_TABLES.studentCourseHistory)
            .select(
              `
              course_id,
              courses:course_id (
                credits
              )
            `
            )
            .eq("student_id", resolvedStudentRow.id);

          const completedCourseIds = new Set<number>(
            (completedCourseRows ?? [])
              .map((r: any) => Number(r?.course_id))
              .filter((x: number) => !Number.isNaN(x))
          );

          const { data: blocks, error: blocksErr } = await supabase
            .from(DB_TABLES.programRequirementBlocks)
            .select(
              `
              id,
              name,
              credits_required,
              program_requirement_courses (
                course_id,
                courses:course_id (
                  credits
                )
              )
            `
            )
            .eq("program_id", majorProgramId);

          if (blocksErr) {
            setRequirements(DEFAULT_REQUIREMENTS);
            setLoadingRequirements(false);
          } else {
            const categorize = (blockName: string) => {
              const n = blockName.toLowerCase();
              if (n.includes("general")) return { key: "General Education", color: "green" as const };
              if (n.includes("core")) return { key: "Major Core", color: "blue" as const };
              if (n.includes("elective")) return { key: "Major Electives", color: "purple" as const };
              return { key: "Free Electives", color: "orange" as const };
            };

            const agg: Record<
              string,
              { completed: number; total: number; color: RequirementBar["color"] }
            > = {
              "General Education": { completed: 0, total: 0, color: "green" },
              "Major Core": { completed: 0, total: 0, color: "blue" },
              "Major Electives": { completed: 0, total: 0, color: "purple" },
              "Free Electives": { completed: 0, total: 0, color: "orange" },
            };

            for (const b of blocks ?? []) {
              const { key, color } = categorize(String((b as any).name ?? ""));
              const blockCourseRows = (b as any).program_requirement_courses ?? [];

              const fallbackTotal = blockCourseRows.reduce((sum: number, r: any) => {
                return sum + Number(r?.courses?.credits ?? 0);
              }, 0);

              const total = Number((b as any).credits_required ?? fallbackTotal ?? 0);

              const completed = blockCourseRows.reduce((sum: number, r: any) => {
                const cid = Number(r?.course_id);
                if (!completedCourseIds.has(cid)) return sum;
                return sum + Number(r?.courses?.credits ?? 0);
              }, 0);

              agg[key].total += total;
              agg[key].completed += completed;
              agg[key].color = color;
            }

            const bars: RequirementBar[] = Object.entries(agg).map(([name, v]) => {
              const total = Math.max(0, Math.round(v.total));
              const completed = Math.min(total, Math.round(v.completed));
              const percentage = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
              return { name, completed, total, percentage, color: v.color };
            });

            setRequirements(bars);
            setLoadingRequirements(false);
          }
        }

        // 5) Current semester planned courses
        setLoadingCourses(true);

        const { data: plannedRows } = await supabase
          .from(DB_TABLES.studentPlannedCourses)
          .select(
            `
          status,
          courses:course_id (
            subject,
            number,
            title,
            credits
          )
        `
          )
          .eq("student_id", resolvedStudentRow.id);

        const mapped: PlannedCourseCard[] =
          (plannedRows ?? [])
            .map((r: any) => {
              const c = r.courses;
              if (!c) return null;

              const rawStatus = String(r.status ?? "").toLowerCase();
              const status: PlannedCourseCard["status"] =
                rawStatus === "enrolled"
                  ? "enrolled"
                  : rawStatus === "waitlist"
                    ? "waitlist"
                    : rawStatus
                      ? "planned"
                      : "unknown";

              return {
                code: `${c.subject} ${c.number}`.trim(),
                name: c.title ?? "Untitled course",
                credits: Number(c.credits ?? 0),
                status,
              };
            })
            .filter((c): c is PlannedCourseCard => c !== null);

        setCurrentCourses(mapped);
        setLoadingCourses(false);

        // 6) Progress (completed + in-progress credits)
        setLoadingProgress(true);

        const { data: completedRows } = await supabase
          .from(DB_TABLES.studentCourseHistory)
          .select(`courses:course_id ( credits )`)
          .eq("student_id", resolvedStudentRow.id);

        const completedCredits =
          (completedRows ?? []).reduce((sum: number, r: any) => {
            const credits = Number(r?.courses?.credits ?? 0);
            return sum + credits;
          }, 0);

        const { data: plannedCreditRows } = await supabase
          .from(DB_TABLES.studentPlannedCourses)
          .select(`status, courses:course_id ( credits )`)
          .eq("student_id", resolvedStudentRow.id);

        const inProgressCredits =
          (plannedCreditRows ?? []).reduce((sum: number, r: any) => {
            const s = String(r?.status ?? "").toLowerCase();
            if (s !== "enrolled" && s !== "waitlist") return sum;
            return sum + Number(r?.courses?.credits ?? 0);
          }, 0);

        const totalCredits = TOTAL_REQUIRED_CREDITS;
        const remainingCredits = Math.max(totalCredits - completedCredits, 0);
        const overall = Math.min(100, Math.round((completedCredits / totalCredits) * 100));

        setProgress({
          overall,
          totalCredits,
          completedCredits,
          inProgressCredits,
          remainingCredits,
        });

        setLoadingProgress(false);

        // 7) Expected graduation display
        const expectedGraduation =
          `${resolvedStudentRow.expected_graduation_semester ?? ""} ${resolvedStudentRow.expected_graduation_year ?? ""}`.trim() || "—";

        const fullName =
          [resolvedStudentRow.first_name, resolvedStudentRow.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || resolvedStudentRow.name || "";

        setStudent({
          id: resolvedStudentRow.id,
          name: fullName || "Student",
          email: resolvedStudentRow.email ?? "",
          major: majorName,
          expectedGraduation,
          hasCompletedOnboarding: !!resolvedStudentRow.has_completed_onboarding,
        });

        setLoadingStudent(false);
      } catch {
        const supabase = createClient();
        await supabase.auth.signOut();
        toaster.create({
          title: "Session reset required",
          description: "We had trouble loading your profile after the database reset. Please sign in again.",
          type: "error",
        });
        router.push("/signin");
      }
    };

    loadStudent();
  }, [router]);

  if (loadingStudent) {
    return <Box p="8">Loading...</Box>;
  }

  if (!student) {
    return null;
  }

  return (
    <Stack gap="6">
      {/* Page title only (layout already renders header/sidebar) */}
      <Box>
        <Text fontSize="sm" color="fg.muted" fontWeight="500">
          Dashboard
        </Text>
        <Heading size="lg" fontFamily="var(--font-outfit), sans-serif" fontWeight="400">
          Grad Tracker
        </Heading>
      </Box>

      {/* Onboarding Banner */}
      {!student.hasCompletedOnboarding && (
        <Card.Root
          className="animate-fade-up"
          borderRadius="2xl"
          overflow="hidden"
          position="relative"
          bgGradient="to-br"
          gradientFrom="green.600"
          gradientVia="green.500"
          gradientTo="teal.500"
        >
          <Box
            position="absolute"
            top="-50%"
            right="-10%"
            w="300px"
            h="300px"
            bg="whiteAlpha.100"
            borderRadius="full"
          />
          <Box
            position="absolute"
            bottom="-30%"
            left="20%"
            w="200px"
            h="200px"
            bg="whiteAlpha.100"
            borderRadius="full"
          />

          <Card.Body p={{ base: "6", md: "8" }} position="relative" zIndex="1">
            <Flex
              direction={{ base: "column", md: "row" }}
              justify="space-between"
              align={{ base: "start", md: "center" }}
              gap="4"
            >
              <HStack gap="4" align="start">
                <Flex
                  align="center"
                  justify="center"
                  w="12"
                  h="12"
                  bg="whiteAlpha.200"
                  borderRadius="xl"
                  flexShrink={0}
                >
                  <Icon color="white" boxSize="6">
                    <LuSparkles />
                  </Icon>
                </Flex>
                <Box>
                  <Heading size="md" color="white" fontWeight="600" mb="1">
                    Complete Your Profile Setup
                  </Heading>
                  <Text color="whiteAlpha.800" fontSize="sm" maxW="md">
                    Add your completed courses and select your degree program to get personalized graduation tracking and recommendations.
                  </Text>
                </Box>
              </HStack>

              <Link href="/dashboard/onboarding">
                <Button
                  bg="white"
                  color="green.700"
                  size="lg"
                  rounded="full"
                  px="6"
                  fontWeight="600"
                  _hover={{ bg: "whiteAlpha.900", transform: "translateY(-1px)" }}
                  transition="all 0.2s"
                  flexShrink={0}
                >
                  Start Setup
                  <Icon ml="2">
                    <LuArrowRight />
                  </Icon>
                </Button>
              </Link>
            </Flex>
          </Card.Body>
        </Card.Root>
      )}

      {/* Stats Grid */}
      <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="6" className="animate-fade-up-delay-1">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="5">
              <HStack justify="space-between" align="start" mb="4">
                <Box>
                  <Text fontSize="sm" color="fg.muted" fontWeight="500" mb="1">
                    Overall Progress
                  </Text>
                  <Text fontSize="2xl" fontWeight="700">
                    {loadingProgress ? "—" : `${progress.overall}%`}
                  </Text>
                </Box>
                <ProgressCircleRoot value={progress.overall} size="md" colorPalette="green">
                  <ProgressCircleRing cap="round" css={{ "--thickness": "4px" }} />
                </ProgressCircleRoot>
              </HStack>
              <HStack gap="1" fontSize="xs" color="fg.muted">
                <Icon color="green.fg">
                  <LuTrendingUp />
                </Icon>
                <Text>On track to graduate</Text>
              </HStack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="5">
              <HStack justify="space-between" align="start" mb="4">
                <Box>
                  <Text fontSize="sm" color="fg.muted" fontWeight="500" mb="1">
                    Credits Completed
                  </Text>
                  <HStack align="baseline" gap="1">
                    <Text fontSize="2xl" fontWeight="700">
                      {progress.completedCredits}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      / {progress.totalCredits}
                    </Text>
                  </HStack>
                </Box>
                <Flex align="center" justify="center" w="10" h="10" bg="blue.subtle" borderRadius="lg">
                  <Icon color="blue.fg" boxSize="5">
                    <LuCircleCheck />
                  </Icon>
                </Flex>
              </HStack>
              <HStack gap="1" fontSize="xs" color="fg.muted">
                <Text>{progress.remainingCredits} credits remaining</Text>
              </HStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <HStack justify="space-between" align="start" mb="3">
              <Box>
                <Text fontSize="sm" color="fg.muted" fontWeight="500" mb="1">
                  In Progress
                </Text>
                <HStack align="baseline" gap="1">
                  <Text fontSize="2xl" fontWeight="700">
                    {progress.inProgressCredits}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    credits
                  </Text>
                </HStack>
              </Box>
              <Flex align="center" justify="center" w="10" h="10" bg="orange.subtle" borderRadius="lg">
                <Icon color="orange.fg" boxSize="5">
                  <LuClock />
                </Icon>
              </Flex>
            </HStack>
            <HStack gap="1" fontSize="xs" color="fg.muted">
              <Text>This semester</Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Main Grid */}
      <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="6">
        <Stack gap="6">
          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" className="animate-fade-up-delay-2">
            <Card.Header p="5" pb="0">
              <Flex justify="space-between" align="center">
                <Heading size="md" fontWeight="600">
                  Degree Requirements
                </Heading>
                <Link href="/dashboard/requirements">
                  <Button variant="ghost" size="sm" fontWeight="500">
                    View All
                    <Icon ml="1">
                      <LuChevronRight />
                    </Icon>
                  </Button>
                </Link>
              </Flex>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="5">
                {requirements.map((req) => (
                  <Box key={req.name}>
                    <ProgressRoot value={req.percentage} colorPalette={req.color} size="sm">
                      <HStack justify="space-between" mb="2">
                        <ProgressLabel fontWeight="500" fontSize="sm">
                          {req.name}
                        </ProgressLabel>
                        <HStack gap="2">
                          <Text fontSize="xs" color="fg.muted">
                            {loadingRequirements ? "Loading..." : `${req.completed}/${req.total} credits`}
                          </Text>
                          <ProgressValueText fontWeight="600" fontSize="sm" />
                        </HStack>
                      </HStack>
                      <ProgressBar borderRadius="full" />
                    </ProgressRoot>
                  </Box>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" className="animate-fade-up-delay-3">
            <Card.Header p="5" pb="0">
              <Flex justify="space-between" align="center">
                <Heading size="md" fontWeight="600">
                  Current Semester
                </Heading>
                <Link href="/dashboard/courses">
                  <Button variant="ghost" size="sm" fontWeight="500">
                    Manage Courses
                    <Icon ml="1">
                      <LuChevronRight />
                    </Icon>
                  </Button>
                </Link>
              </Flex>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="3">
                {loadingCourses ? (
                  <Box p="4" bg="bg.subtle" borderRadius="lg">
                    <Text fontSize="sm" color="fg.muted">
                      Loading current semester courses...
                    </Text>
                  </Box>
                ) : currentCourses.length === 0 ? (
                  <Box p="4" bg="bg.subtle" borderRadius="lg">
                    <Text fontWeight="600" fontSize="sm" mb="1">
                      No courses planned yet
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      Once you complete onboarding and add your semester plan, your courses will appear here.
                    </Text>
                  </Box>
                ) : (
                  currentCourses.map((course, index) => (
                    <Flex
                      key={`${course.code}-${course.name}-${index}`}
                      p="4"
                      bg="bg.subtle"
                      borderRadius="lg"
                      justify="space-between"
                      align="center"
                      _hover={{ bg: "bg.muted" }}
                      transition="background 0.15s"
                      cursor="pointer"
                    >
                      <HStack gap="4">
                        <Box
                          w="10"
                          h="10"
                          bg="green.subtle"
                          borderRadius="lg"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon color="green.fg" boxSize="5">
                            <LuBookOpen />
                          </Icon>
                        </Box>
                        <Box>
                          <Text fontWeight="600" fontSize="sm">
                            {course.code}
                          </Text>
                          <Text color="fg.muted" fontSize="sm">
                            {course.name}
                          </Text>
                        </Box>
                      </HStack>

                      <HStack gap="3">
                        <Text fontSize="sm" color="fg.muted">
                          {course.credits} credits
                        </Text>
                        <Badge
                          colorPalette={
                            course.status === "enrolled"
                              ? "green"
                              : course.status === "waitlist"
                                ? "orange"
                                : "gray"
                          }
                          variant="subtle"
                          size="sm"
                        >
                          {course.status === "enrolled"
                            ? "Enrolled"
                            : course.status === "waitlist"
                              ? "Waitlist"
                              : "Planned"}
                        </Badge>
                      </HStack>
                    </Flex>
                  ))
                )}

                <Button variant="outline" size="sm" w="full" mt="2" borderStyle="dashed">
                  <Icon mr="2">
                    <LuPlus />
                  </Icon>
                  Add Course
                </Button>
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>

        <Stack gap="6">
          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" className="animate-fade-up-delay-2">
            <Card.Body p="5">
              <VStack align="center" gap="4">
                <Avatar.Root size="xl" colorPalette="green">
                  <Avatar.Fallback name={student.name} />
                </Avatar.Root>

                <VStack gap="1">
                  <Text fontWeight="600" fontSize="lg">
                    {student.name}
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    {student.email}
                  </Text>
                </VStack>

                <VStack gap="2" w="full" pt="2">
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="fg.muted">
                      Major
                    </Text>
                    <Text fontSize="sm" fontWeight="500">
                      {student.major}
                    </Text>
                  </HStack>

                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="fg.muted">
                      Expected Graduation
                    </Text>
                    <Badge colorPalette="green" variant="subtle" size="sm">
                      {student.expectedGraduation}
                    </Badge>
                  </HStack>
                </VStack>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" className="animate-fade-up-delay-3">
            <Card.Header p="5" pb="0">
              <Heading size="md" fontWeight="600">
                Recent Activity
              </Heading>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="4">
                {mockRecentActivity.map((activity, index) => (
                  <HStack key={index} gap="3" align="start">
                    <Flex
                      align="center"
                      justify="center"
                      w="8"
                      h="8"
                      bg={
                        activity.type === "alert"
                          ? "orange.subtle"
                          : activity.type === "requirement_met"
                            ? "green.subtle"
                            : "blue.subtle"
                      }
                      borderRadius="full"
                      flexShrink={0}
                    >
                      <Icon
                        boxSize="4"
                        color={
                          activity.type === "alert"
                            ? "orange.fg"
                            : activity.type === "requirement_met"
                              ? "green.fg"
                              : "blue.fg"
                        }
                      >
                        {activity.type === "alert" ? (
                          <LuCircleAlert />
                        ) : activity.type === "requirement_met" ? (
                          <LuCircleCheck />
                        ) : (
                          <LuPlus />
                        )}
                      </Icon>
                    </Flex>

                    <Box flex="1">
                      <Text fontSize="sm" fontWeight="500" lineHeight="short">
                        {activity.message}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" mt="0.5">
                        {activity.time}
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" className="animate-fade-up-delay-4">
            <Card.Header p="5" pb="0">
              <Heading size="md" fontWeight="600">
                Quick Actions
              </Heading>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="2">
                <Button variant="outline" justifyContent="start" size="sm" fontWeight="500">
                  <Icon mr="2">
                    <LuFileText />
                  </Icon>
                  Generate Progress Report
                </Button>
                <Button variant="outline" justifyContent="start" size="sm" fontWeight="500">
                  <Icon mr="2">
                    <LuCalendar />
                  </Icon>
                  Plan Next Semester
                </Button>
                <Button variant="outline" justifyContent="start" size="sm" fontWeight="500">
                  <Icon mr="2">
                    <LuTarget />
                  </Icon>
                  Review Requirements
                </Button>
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Grid>
    </Stack>
  );
}