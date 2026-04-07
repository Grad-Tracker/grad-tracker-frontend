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
  fetchStudentMajorProgram,
  fetchStudentProfileByAuthUserId,
  getOrCreateStudent,
} from "@/lib/supabase/queries/onboarding";
import {
  fetchRecentStudentActivity,
  logStudentActivity,
  type StudentActivityRow,
} from "@/lib/supabase/queries/activity";
import { fetchStudentCourseProgress, fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/planner";
import {
  DB_VIEWS,
  DB_TABLES
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
  LuClock,
  LuCircleCheck,
  LuCircleAlert,
  LuArrowRight,
  LuGraduationCap,
} from "react-icons/lu";

import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentAcademicTerm } from "@/lib/academic-term";
import type { ViewPlanTermRow, ViewPlanCourseRow, ViewStudentCourseProgressRow } from "@/lib/supabase/queries/view-types";

function getStatusBadgeProps(status: string): { color: string; label: string } {
  if (status === "enrolled") return { color: "emerald", label: "Enrolled" };
  if (status === "waitlist") return { color: "orange", label: "Waitlist" };
  return { color: "gray", label: "Planned" };
}

function getActivityVisualType(activityType: string): "course_added" | "requirement_met" | "alert" {
  if (activityType === "major_changed" || activityType === "onboarding_completed") {
    return "requirement_met";
  }
  if (activityType === "plan_updated") {
    return "alert";
  }
  return "course_added";
}

function activityBgColor(visualType: string): string {
  if (visualType === "alert") return "orange.subtle";
  if (visualType === "requirement_met") return "emerald.subtle";
  return "blue.subtle";
}

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "Just now";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}

async function safeLogActivity(
  studentId: number,
  activityType: Parameters<typeof logStudentActivity>[1],
  message: string,
  metadata: Record<string, unknown>
) {
  try {
    await logStudentActivity(studentId, activityType, message, metadata);
  } catch (error) {
    console.error("Failed to log student activity:", error);
  }
}

/**
 * Resolves the student's major program and fetches its requirement blocks.
 * Extracted to module level to reduce function nesting depth.
 */
async function resolveMajorAndBlocks(
  supabase: ReturnType<typeof createClient>,
  studentId: number
) {
  let majorName = "Unknown";
  let majorProgramId: number | null = null;

  const majorProgram = await fetchStudentMajorProgram(studentId);
  if (majorProgram) {
    majorName = majorProgram.program_name;
    majorProgramId = Number(majorProgram.program_id);
  }

  if (!majorProgramId) {
    return {
      data: null as any,
      error: null as any,
      majorName,
      majorProgramId: null as number | null,
    };
  }

  const blocksRes = await supabase
    .from(DB_VIEWS.programBlockCourses)
    .select("block_id, block_name, rule, n_required, credits_required, courses")
    .eq("program_id", majorProgramId);

  return { ...blocksRes, majorName, majorProgramId };
}

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    async function checkStatus() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await checkOnboardingStatus(user.id);
      } catch {
        // Default to hiding banner on error
      }
    }
    checkStatus();
  }, []);

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
    color: "violet" | "emerald" | "blue" | "amber";
  };

  const DEFAULT_REQUIREMENTS: RequirementBar[] = [
    { name: "General Education", completed: 0, total: 0, percentage: 0, color: "violet" },
    { name: "Major Core", completed: 0, total: 0, percentage: 0, color: "emerald" },
    { name: "Major Electives", completed: 0, total: 0, percentage: 0, color: "blue" },
    { name: "Free Electives", completed: 0, total: 0, percentage: 0, color: "amber" },
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
  const [recentActivity, setRecentActivity] = React.useState<StudentActivityRow[]>([]);

  const [currentMajorProgramId, setCurrentMajorProgramId] = React.useState<number | null>(null);

  const [studentIdForReset, setStudentIdForReset] = React.useState<number | null>(null);

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

        // 2) Student profile via view by auth user id
        let resolvedStudentRow = await fetchStudentProfileByAuthUserId(userData.user.id);
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
            student_id: created.id,
            first_name: userData.user.user_metadata?.first_name ?? null,
            last_name: userData.user.user_metadata?.last_name ?? null,
            email: userData.user.email ?? null,
            has_completed_onboarding: false,
            expected_graduation_semester: null,
            expected_graduation_year: null,
            auth_user_id: userData.user.id,
            full_name: displayName,
            breadth_package_id: null,
          };

          toaster.create({
            title: "Profile restored",
            description: "Your student profile was missing and has been recreated.",
            type: "info",
          });
        }

        // 3–6) Parallelize Dashboard Queries (per Jira task)
        // After the student row is resolved, steps 3–9 are independent and should be fetched in parallel.
        setLoadingRequirements(true);
        setLoadingCourses(true);
        setLoadingProgress(true);

        const studentId = resolvedStudentRow.student_id;
        setStudentIdForReset(studentId);

        const completedPromise = fetchStudentCourseProgress(studentId);
        const activityPromise = fetchRecentStudentActivity(studentId).catch(() => [] as StudentActivityRow[]);

        // Find term IDs for the current academic semester
        const currentTerm = getCurrentAcademicTerm();
        const currentTermIdsPromise = supabase
          .from(DB_VIEWS.planTerms)
          .select("term_id")
          .eq("student_id", studentId)
          .eq("season", currentTerm.season)
          .eq("year", currentTerm.year);

        const blocksPromise = resolveMajorAndBlocks(supabase, studentId);

        const [completedResult, blocksResult, currentTermIdsResult, activityResult] = await Promise.all([
          completedPromise,
          blocksPromise,
          currentTermIdsPromise,
          activityPromise,
        ]);
        setRecentActivity(activityResult);

        const majorName = (blocksResult as any).majorName ?? "Unknown";
        const majorProgramId = (blocksResult as any).majorProgramId as number | null;
        setCurrentMajorProgramId(majorProgramId);

        const termIds = ((currentTermIdsResult as { data?: Pick<ViewPlanTermRow, "term_id">[] })?.data ?? []).map(
          (r) => r.term_id
        );
        const plannedRows: Pick<ViewPlanCourseRow, "status" | "subject" | "number" | "title" | "credits">[] = termIds.length > 0
          ? (await supabase
              .from(DB_VIEWS.planCourses)
              .select("status, subject, number, title, credits")
              .eq("student_id", studentId)
              .in("term_id", termIds)).data ?? []
          : [];

        // Reuse completedResult for BOTH:
        //  - requirement-block matching
        //  - credit summary (completed credits)
        const completedCourseRows: ViewStudentCourseProgressRow[] = completedResult ?? [];
        const completedCourseIds = new Set<number>(
          completedCourseRows
            .filter(
              (r) =>
                r.completed === true ||
                String(r.progress_status ?? "").toUpperCase() === "COMPLETED"
            )
            .map((r) => r.course_id)
            .filter((x) => !Number.isNaN(x))
        );

        const mapped: PlannedCourseCard[] =
          plannedRows
            .map((r) => {
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
                code: `${r.subject ?? ""} ${r.number ?? ""}`.trim(),
                name: r.title ?? "Untitled course",
                credits: Number(r.credits ?? 0),
                status,
              };
            })
            .filter((c: PlannedCourseCard | null): c is PlannedCourseCard => c !== null);

        setCurrentCourses(mapped);
        setLoadingCourses(false);

        // All courses in the current semester are considered in-progress
        const inProgressCredits =
          plannedRows.reduce((sum, r) => sum + Number(r.credits ?? 0), 0);

        // Requirements: gen ed buckets + major program blocks
        const agg: Record<
          string,
          { completed: number; total: number; color: RequirementBar["color"] }
        > = {
          "General Education": { completed: 0, total: 0, color: "violet" },
          "Major Core": { completed: 0, total: 0, color: "emerald" },
          "Major Electives": { completed: 0, total: 0, color: "blue" },
          "Free Electives": { completed: 0, total: 0, color: "amber" },
        };

        // Gen ed from gen_ed_buckets (separate from major program)
        try {
          const genEdBuckets = await fetchGenEdBucketsWithCourses();
          for (const bucket of genEdBuckets) {
            agg["General Education"].total += bucket.credits_required;
            const bucketCompleted = bucket.courses.reduce((sum, c) => {
              if (!completedCourseIds.has(c.id)) return sum;
              return sum + c.credits;
            }, 0);
            agg["General Education"].completed += bucketCompleted;
          }
        } catch {
          // Non-critical — gen ed bar will show 0/0
        }

        // Major program blocks
        if (majorProgramId && !(blocksResult as any)?.error) {
          const blocks = ((blocksResult as any)?.data ?? []) as any[];

          for (const b of blocks) {
            const blockCourseRows = b?.courses ?? [];
            // Skip parent blocks with no courses (their sub-blocks have the actual courses)
            if (blockCourseRows.length === 0) continue;

            const name = String(b?.block_name ?? "").toLowerCase();
            const isElective = name.includes("elective");
            const key = isElective ? "Major Electives" : "Major Core";

            const rule = String(b?.rule ?? "ALL_OF");
            const nRequired = Number(b?.n_required ?? 0);

            // Calculate expected total credits for this block
            let total: number;
            if (b?.credits_required != null) {
              // Explicit credits_required — use directly
              total = Number(b.credits_required);
            } else if (rule === "N_OF" && nRequired > 0 && blockCourseRows.length > 0) {
              // Pick N courses — estimate credits as N * average credit per course
              const avgCredits = blockCourseRows.reduce(
                (sum: number, r: any) => sum + Number(r?.credits ?? 0), 0
              ) / blockCourseRows.length;
              total = Math.round(nRequired * avgCredits);
            } else if (rule === "ANY_OF") {
              // Pick 1 — use the first course's credits as estimate
              total = Number(blockCourseRows[0]?.credits ?? 3);
            } else {
              // ALL_OF or unknown — sum all course credits
              total = blockCourseRows.reduce(
                (sum: number, r: any) => sum + Number(r?.credits ?? 0), 0
              );
            }

            const completed = blockCourseRows.reduce((sum: number, r: any) => {
              const cid = Number(r?.course_id ?? r?.id);
              if (!completedCourseIds.has(cid)) return sum;
              return sum + Number(r?.credits ?? 0);
            }, 0);

            agg[key].total += total;
            agg[key].completed += completed;
          }
        }

        const bars: RequirementBar[] = Object.entries(agg)
          .filter(([, v]) => v.total > 0)
          .map(([name, v]) => {
            const total = Math.max(0, Math.round(v.total));
            const completed = Math.min(total, Math.round(v.completed));
            const percentage = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
            return { name, completed, total, percentage, color: v.color };
          });

        setRequirements(bars);
        setLoadingRequirements(false);

        // Fetch credits for all completed courses directly from courses table
        const completedIdArray = Array.from(completedCourseIds);
        let completedCredits = 0;
        if (completedIdArray.length > 0) {
          const { data: creditRows } = await supabase
            .from("courses")
            .select("id, credits")
            .in("id", completedIdArray);
          completedCredits = (creditRows ?? []).reduce(
            (sum: number, r: any) => sum + Number(r.credits ?? 0),
            0
          );
        }

        // Progress summary (reused completedCredits + inProgressCredits)
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
            .trim() || resolvedStudentRow.full_name || "";

        setStudent({
          id: resolvedStudentRow.student_id,
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

  const handleAddCourse = () => {
    router.push("/dashboard/courses");
  };


  if (loadingStudent) {
    return <DashboardSkeleton />;
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
        <Heading size="lg" fontFamily="var(--font-dm-sans), sans-serif" fontWeight="400" letterSpacing="-0.02em">
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
          gradientFrom="blue.600"
          gradientVia="blue.500"
          gradientTo="blue.400"
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
                  color="blue.700"
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
                    {loadingProgress ? <Skeleton height="8" width="50px" display="inline-block" /> : `${progress.overall}%`}
                  </Text>
                </Box>
                <ProgressCircleRoot value={progress.overall} size="md" colorPalette="blue">
                  <ProgressCircleRing cap="round" css={{ "--thickness": "4px" }} />
                </ProgressCircleRoot>
              </HStack>
              <HStack gap="1" fontSize="xs" color="fg.muted">
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
                            {loadingRequirements ? <Skeleton height="3" width="70px" display="inline-block" /> : `${req.completed}/${req.total} credits`}
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
                  <Stack gap="3">
                    {[1, 2, 3].map((i) => (
                      <HStack key={i} p="3" bg="bg.subtle" borderRadius="lg" justify="space-between">
                        <HStack gap="3">
                          <Skeleton height="10" width="10" borderRadius="lg" />
                          <Box>
                            <Skeleton height="4" width="80px" mb="1" />
                            <Skeleton height="3" width="140px" />
                          </Box>
                        </HStack>
                        <Skeleton height="6" width="60px" borderRadius="full" />
                      </HStack>
                    ))}
                  </Stack>
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
                  currentCourses.map((course) => (
                    <Flex
                      key={`${course.code}-${course.name}`}
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
                          bg="blue.subtle"
                          borderRadius="lg"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon color="blue.fg" boxSize="5">
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
                          colorPalette={getStatusBadgeProps(course.status).color}
                          variant="subtle"
                          size="sm"
                        >
                          {getStatusBadgeProps(course.status).label}
                        </Badge>
                      </HStack>
                    </Flex>
                  ))
                )}

                <Button
                  variant="outline"
                  size="sm"
                  w="full"
                  mt="2"
                  borderStyle="dashed"
                  onClick={handleAddCourse}
                >
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
                <Avatar.Root size="xl" colorPalette="blue">
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
                    <Badge colorPalette="blue" variant="subtle" size="sm">
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
                {recentActivity.length === 0 ? (
                  <Box p="4" bg="bg.subtle" borderRadius="lg">
                    <Text fontSize="sm" color="fg.muted">
                      No recent activity yet. Your actions will appear here once you start using Grad Tracker.
                    </Text>
                  </Box>
                ) : recentActivity.map((activity) => {
                  const visualType = getActivityVisualType(activity.activity_type);
                  return (
                    <HStack key={activity.id} gap="3" align="start">
                      <Flex
                        align="center"
                        justify="center"
                        w="8"
                        h="8"
                        bg={activityBgColor(visualType)}
                        borderRadius="full"
                        flexShrink={0}
                      >
                        <Icon
                          boxSize="4"
                          color={
                            visualType === "alert"
                              ? "orange.fg"
                              : visualType === "requirement_met"
                                ? "emerald.fg"
                                : "blue.fg"
                          }
                        >
                          {visualType === "alert" ? (
                            <LuCircleAlert />
                          ) : visualType === "requirement_met" ? (
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
                          {formatRelativeTime(activity.created_at)}
                        </Text>
                      </Box>
                    </HStack>
                  );
                })}
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
                  Generate Progress Report
                </Button>
                <Button variant="outline" justifyContent="start" size="sm" fontWeight="500">
                  Plan Next Semester
                </Button>
                <Button variant="outline" justifyContent="start" size="sm" fontWeight="500">
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
