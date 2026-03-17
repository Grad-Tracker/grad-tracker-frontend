"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Avatar,
  Badge,
  Box,
  chakra,
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
  fetchPrograms,
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
  LuTrash2,
  LuGraduationCap,
  LuTriangleAlert,
} from "react-icons/lu";
import type { Program } from "@/types/onboarding";

const PROFILE_IMAGE_BUCKET = "profile-images";

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

function getStatusBadgeProps(status: string): { color: string; label: string } {
  if (status === "enrolled") return { color: "green", label: "Enrolled" };
  if (status === "waitlist") return { color: "orange", label: "Waitlist" };
  return { color: "gray", label: "Planned" };
}

async function createAvatarSignedUrl(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

function filterLeafRequirementBlocks<T extends { name?: string | null }>(blocks: T[]) {
  const names = blocks.map((block) => String(block.name ?? ""));

  return blocks.filter((block) => {
    const name = String(block.name ?? "");
    if (!name) {
      return false;
    }

    return !names.some((other) => other !== name && other.startsWith(`${name} - `));
  });
}

function getChildRequirementBlocks<T extends { name?: string | null }>(blocks: T[], parentName: string) {
  return blocks.filter((block) => {
    const name = String(block.name ?? "");
    return name !== parentName && name.startsWith(`${parentName} - `);
  });
}

function categorizeRequirementBlock(blockName: string) {
  const normalized = blockName.toLowerCase();

  if (
    normalized.includes("general education") ||
    normalized.includes("skill") ||
    normalized.includes("foreign language") ||
    normalized.includes("ethnic diversity")
  ) {
    return "General Education" as const;
  }

  if (normalized.includes("elective")) return "Major Electives" as const;
  if (normalized.includes("free")) return "Free Electives" as const;
  return "Major Core" as const;
}

function computeRequirementBlockTotal(block: any) {
  const creditsRequired = Number(block?.credits_required);
  if (!Number.isNaN(creditsRequired) && creditsRequired > 0) {
    return creditsRequired;
  }

  const courseCredits = (block?.program_requirement_courses ?? [])
    .map((row: any) => Number(row?.courses?.credits ?? 0))
    .filter((credits: number) => credits > 0);

  if (courseCredits.length === 0) {
    return 0;
  }

  const rule = String(block?.rule ?? "").toUpperCase();
  const nRequired = Number(block?.n_required);

  if (rule === "N_OF" && Number.isFinite(nRequired) && nRequired > 0) {
    if (nRequired >= 6) {
      return nRequired;
    }

    const standardCredits = courseCredits.filter((credits: number) => credits >= 3);
    const representativeCredits =
      standardCredits.length > 0
        ? Math.round(
            standardCredits.reduce((sum: number, credits: number) => sum + credits, 0) /
              standardCredits.length
          )
        : Math.max(...courseCredits);

    return nRequired * representativeCredits;
  }

  return courseCredits.reduce((sum: number, credits: number) => sum + credits, 0);
}

/**
 * Resolves the student's major program and fetches its requirement blocks.
 * Extracted to module level to reduce function nesting depth.
 */
async function resolveMajorAndBlocks(
  supabase: ReturnType<typeof createClient>,
  programsPromise: PromiseLike<{ data: any; error: any }>
) {
  let majorName = "Unknown";
  let majorProgramId: number | null = null;

  const { data: studentPrograms, error: spErr } = await programsPromise;

  if (!spErr && studentPrograms?.length) {
    const programIds = (studentPrograms as any[])
      .map((sp) => sp?.program_id)
      .filter((x) => x !== null && x !== undefined);

    if (programIds.length) {
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
    .from(DB_TABLES.programRequirementBlocks)
    .select(
      `
        id,
        name,
        rule,
        n_required,
        credits_required,
        program_requirement_courses (
          course_id,
          courses:course_id ( credits )
        )
      `
    )
    .eq("program_id", majorProgramId);

  return { ...blocksRes, majorName, majorProgramId };
}

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
    avatar_path?: string | null;
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
  const [avatarUrl, setAvatarUrl] = React.useState("");

  type ProgressSummary = {
    overall: number;
    totalCredits: number;
    completedCredits: number;
    inProgressCredits: number;
    remainingCredits: number;
  };

  const [progress, setProgress] = React.useState<ProgressSummary>({
    overall: 0,
    totalCredits: 0,
    completedCredits: 0,
    inProgressCredits: 0,
    remainingCredits: 0,
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

  const [requirements, setRequirements] =
    React.useState<RequirementBar[]>(DEFAULT_REQUIREMENTS);
  const [loadingRequirements, setLoadingRequirements] =
    React.useState(true);

  type PlannedCourseCard = {
    code: string;
    name: string;
    credits: number;
    status: "enrolled" | "waitlist" | "planned" | "unknown";
  };

  const [currentCourses, setCurrentCourses] = React.useState<PlannedCourseCard[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);

  const [majors, setMajors] = React.useState<Program[]>([]);
  const [selectedMajorId, setSelectedMajorId] = React.useState<number | null>(null);
  const [currentMajorProgramId, setCurrentMajorProgramId] = React.useState<number | null>(null);
  const [changingMajor, setChangingMajor] = React.useState(false);

  const [resetConfirming, setResetConfirming] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [studentIdForReset, setStudentIdForReset] = React.useState<number | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

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
            "id,first_name,last_name,email,avatar_path,has_completed_onboarding,expected_graduation_semester,expected_graduation_year"
          )
          .eq(STUDENT_COLUMNS.authUserId, userData.user.id)
          .maybeSingle<StudentRow>();

        let studentRow = studentRowNew;
        let studentErr = studentErrNew;

        if (studentErrNew && String(studentErrNew.message ?? "").includes("column")) {
          const { data: studentRowLegacy, error: studentErrLegacy } = await supabase
            .from(DB_TABLES.students)
            .select(
              "id,name,email,avatar_path,has_completed_onboarding,expected_graduation_term,expected_graduation_year"
            )
            .eq(STUDENT_COLUMNS.authUserId, userData.user.id)
            .maybeSingle<{
              id: number;
              name: string | null;
              email: string | null;
              avatar_path: string | null;
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
                avatar_path: studentRowLegacy.avatar_path,
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
            avatar_path: null,
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

        if (resolvedStudentRow.avatar_path) {
          try {
            const signed = await createAvatarSignedUrl(resolvedStudentRow.avatar_path);
            setAvatarUrl(signed);
          } catch {
            setAvatarUrl("");
          }
        } else {
          setAvatarUrl("");
        }

        // 3–6) Parallelize Dashboard Queries (per Jira task)
        setLoadingRequirements(true);
        setLoadingCourses(true);
        setLoadingProgress(true);

        const studentId = resolvedStudentRow.id;
        setStudentIdForReset(studentId);

        const programsPromise = supabase
          .from(DB_TABLES.studentPrograms)
          .select("program_id")
          .eq("student_id", studentId);

        const completedPromise = supabase
          .from(DB_TABLES.studentCourseHistory)
          .select(`course_id, courses:course_id(credits)`)
          .eq("student_id", studentId);

        const plannedPromise = supabase
          .from(DB_TABLES.studentPlannedCourses)
          .select(`course_id, status, courses:course_id(subject, number, title, credits)`)
          .eq("student_id", studentId);

        const genEdBucketsPromise = supabase
          .from(DB_TABLES.genEdBuckets)
          .select("id, credits_required");

        const genEdMappingsPromise = supabase
          .from(DB_TABLES.genEdBucketCourses)
          .select(`bucket_id, course_id, courses:course_id(credits)`);

        const blocksPromise = resolveMajorAndBlocks(supabase, programsPromise);

        const [completedResult, blocksResult, plannedResult, genEdBucketsResult, genEdMappingsResult] = await Promise.all([
          completedPromise,
          blocksPromise,
          plannedPromise,
          genEdBucketsPromise,
          genEdMappingsPromise,
        ]);

        const majorName = (blocksResult as any).majorName ?? "Unknown";
        const majorProgramId = (blocksResult as any).majorProgramId as number | null;
        setCurrentMajorProgramId(majorProgramId);
        setSelectedMajorId(majorProgramId);

        const completedCourseRows = (completedResult as any)?.data ?? [];
        const completedCourseIds = new Set<number>(
          (completedCourseRows ?? [])
            .map((r: any) => Number(r?.course_id))
            .filter((x: number) => !Number.isNaN(x))
        );

        const plannedRows = (plannedResult as any)?.data ?? [];

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
            .filter((c: PlannedCourseCard | null): c is PlannedCourseCard => c !== null);

        setCurrentCourses(mapped);
        setLoadingCourses(false);

        const inProgressCourseIds = new Set<number>(
          (plannedRows ?? [])
            .filter((r: any) => {
              const s = String(r?.status ?? "").toLowerCase();
              return s === "enrolled" || s === "waitlist";
            })
            .map((r: any) => Number(r?.course_id))
            .filter((x: number) => !Number.isNaN(x))
        );

        // Requirements
        if (!majorProgramId || (blocksResult as any)?.error) {
          setRequirements(DEFAULT_REQUIREMENTS);
          setProgress({
            overall: 0,
            totalCredits: 120,
            completedCredits: 0,
            inProgressCredits: 0,
            remainingCredits: 120,
          });
          setLoadingRequirements(false);
        } else {
          const blocks = ((blocksResult as any)?.data ?? []) as any[];

          const BUCKET_COLOR: Record<RequirementBar["name"], RequirementBar["color"]> = {
            "General Education": "green",
            "Major Core": "blue",
            "Major Electives": "purple",
            "Free Electives": "orange",
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

          const leafBlocks = filterLeafRequirementBlocks(blocks);

          for (const b of leafBlocks) {
            const blockName = String(b?.name ?? "");
            const bucket: RequirementBar["name"] = categorizeRequirementBlock(blockName);
            const color = BUCKET_COLOR[bucket];

            const blockCourseRows = b?.program_requirement_courses ?? [];

            const total = computeRequirementBlockTotal(b);

            const completed = blockCourseRows.reduce((sum: number, r: any) => {
              const cid = Number(r?.course_id);
              if (!completedCourseIds.has(cid)) return sum;
              return sum + Number(r?.courses?.credits ?? 0);
            }, 0);

            agg[bucket].total += total;
            agg[bucket].completed += completed;
            agg[bucket].color = color;
          }

          const genEdBuckets = (genEdBucketsResult as any)?.data ?? [];
          const genEdMappings = (genEdMappingsResult as any)?.data ?? [];

          const genEdTotals = genEdBuckets.reduce(
            (
              sum: { total: number; completed: number; inProgress: number },
              bucket: any
            ) => {
              const required = Number(bucket?.credits_required ?? 0);
              const bucketCourses = genEdMappings.filter(
                (mapping: any) => Number(mapping?.bucket_id) === Number(bucket?.id)
              );
              const completed = Math.min(
                required,
                bucketCourses.reduce((bucketSum: number, mapping: any) => {
                  const courseId = Number(mapping?.course_id);
                  if (!completedCourseIds.has(courseId)) return bucketSum;
                  return bucketSum + Number(mapping?.courses?.credits ?? 0);
                }, 0)
              );
              const inProgress = Math.min(
                Math.max(required - completed, 0),
                bucketCourses.reduce((bucketSum: number, mapping: any) => {
                  const courseId = Number(mapping?.course_id);
                  if (!inProgressCourseIds.has(courseId)) return bucketSum;
                  return bucketSum + Number(mapping?.courses?.credits ?? 0);
                }, 0)
              );

              return {
                total: sum.total + required,
                completed: sum.completed + completed,
                inProgress: sum.inProgress + inProgress,
              };
            },
            { total: 0, completed: 0, inProgress: 0 }
          );

          const GENERAL_ED_REQUIREMENT_TOTAL = 55;
          agg["General Education"].total = Math.max(
            GENERAL_ED_REQUIREMENT_TOTAL,
            Math.round(agg["General Education"].total + genEdTotals.total)
          );
          agg["General Education"].completed = Math.round(
            agg["General Education"].completed + genEdTotals.completed
          );

          const coreParentBlocks = blocks.filter((block: any) => {
            const blockName = String(block?.name ?? "");
            return (
              categorizeRequirementBlock(blockName) === "Major Core" &&
              getChildRequirementBlocks(blocks, blockName).length > 0 &&
              computeRequirementBlockTotal(block) > 0
            );
          });

          for (const parentBlock of coreParentBlocks) {
            const parentName = String(parentBlock?.name ?? "");
            const childBlocks = getChildRequirementBlocks(blocks, parentName);
            const subtractiveChildTotal = childBlocks.reduce((sum: number, childBlock: any) => {
              const childBucket = categorizeRequirementBlock(String(childBlock?.name ?? ""));
              if (childBucket === "Major Electives" || childBucket === "Free Electives") {
                return sum + computeRequirementBlockTotal(childBlock);
              }
              return sum;
            }, 0);

            const adjustedCoreTotal = Math.max(
              computeRequirementBlockTotal(parentBlock) - subtractiveChildTotal,
              0
            );

            if (adjustedCoreTotal > 0) {
              agg["Major Core"].total = adjustedCoreTotal;
            }
          }

          const bars: RequirementBar[] = Object.entries(agg).map(([name, v]) => {
            const total = Math.max(0, Math.round(v.total));
            const completed = Math.min(total, Math.round(v.completed));
            const percentage = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
            return { name, completed, total, percentage, color: v.color };
          });

          setRequirements(bars);
          setLoadingRequirements(false);
        
          const totalCredits = 120;
          const completedCredits = bars.reduce((sum, bar) => sum + bar.completed, 0);

          const majorInProgressCredits = leafBlocks.reduce((sum: number, block: any) => {
            const blockCourseRows = block?.program_requirement_courses ?? [];
            const total = computeRequirementBlockTotal(block);
            const completed = blockCourseRows.reduce((rowSum: number, row: any) => {
              const courseId = Number(row?.course_id);
              if (!completedCourseIds.has(courseId)) return rowSum;
              return rowSum + Number(row?.courses?.credits ?? 0);
            }, 0);
            const inProgress = blockCourseRows.reduce((rowSum: number, row: any) => {
              const courseId = Number(row?.course_id);
              if (!inProgressCourseIds.has(courseId)) return rowSum;
              return rowSum + Number(row?.courses?.credits ?? 0);
            }, 0);

            return sum + Math.min(Math.max(total - completed, 0), inProgress);
          }, 0);

          const inProgressCredits = Math.round(genEdTotals.inProgress + majorInProgressCredits);
          const remainingCredits = Math.max(totalCredits - completedCredits, 0);
          const overall =
            totalCredits === 0 ? 0 : Math.min(100, Math.round((completedCredits / totalCredits) * 100));

          setProgress({
            overall,
            totalCredits,
            completedCredits,
            inProgressCredits,
            remainingCredits,
          });
        }

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

        if (resolvedStudentRow.has_completed_onboarding) {
          try {
            const allMajors = await fetchPrograms("MAJOR");
            setMajors(allMajors);
          } catch {
            // Non-critical
          }
        }
      } catch {
        const supabase = createClient();
        await supabase.auth.signOut();
        toaster.create({
          title: "Session reset required",
          description:
            "We had trouble loading your profile after the database reset. Please sign in again.",
          type: "error",
        });
        router.push("/signin");
      }
    };

    loadStudent();
  }, [router, refreshKey]);

  const handleChangeMajor = async () => {
    if (!selectedMajorId || !studentIdForReset || selectedMajorId === currentMajorProgramId) return;
    setChangingMajor(true);
    try {
      const supabase = createClient();

      if (currentMajorProgramId) {
        const { error: deleteError } = await supabase
          .from(DB_TABLES.studentPrograms)
          .delete()
          .eq("student_id", studentIdForReset)
          .eq("program_id", currentMajorProgramId);
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase
        .from(DB_TABLES.studentPrograms)
        .insert({ student_id: studentIdForReset, program_id: selectedMajorId });

      if (error) throw error;

      setCurrentMajorProgramId(selectedMajorId);
      const newMajor = majors.find((m) => m.id === selectedMajorId);
      if (newMajor && student) {
        setStudent({ ...student, major: newMajor.name });
      }
      toaster.create({ title: "Major updated", type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to change major", description: msg, type: "error" });
    } finally {
      setChangingMajor(false);
    }
  };

  const handleResetProgress = async () => {
    if (!studentIdForReset) return;
    setResetting(true);
    try {
      const supabase = createClient();

      const [historyResult, plannedResult, programsResult] = await Promise.all([
        supabase.from(DB_TABLES.studentCourseHistory).delete().eq("student_id", studentIdForReset),
        supabase.from(DB_TABLES.studentPlannedCourses).delete().eq("student_id", studentIdForReset),
        supabase.from(DB_TABLES.studentPrograms).delete().eq("student_id", studentIdForReset),
      ]);

      if (historyResult.error) throw historyResult.error;
      if (plannedResult.error) throw plannedResult.error;
      if (programsResult.error) throw programsResult.error;

      await supabase
        .from(DB_TABLES.students)
        .update({ has_completed_onboarding: false })
        .eq(STUDENT_COLUMNS.id, studentIdForReset);

      toaster.create({
        title: "Progress reset",
        description: "Your progress has been cleared. Use the setup wizard to start fresh.",
        type: "success",
      });
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to reset progress", description: msg, type: "error" });
    } finally {
      setResetting(false);
      setResetConfirming(false);
    }
  };

  if (loadingStudent) {
    return <Box p="8">Loading...</Box>;
  }

  if (!student) {
    return null;
  }

  return (
    <Stack gap="6">
      <Box>
        <Text fontSize="sm" color="fg.muted" fontWeight="500">
          Dashboard
        </Text>
        <Heading size="lg" fontFamily="'DM Serif Display', serif" fontWeight="400">
          Grad Tracker
        </Heading>
      </Box>

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
                  {avatarUrl ? <Avatar.Image src={avatarUrl} alt="Profile picture" /> : null}
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

          {majors.length > 0 && (
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Flex align="center" gap="2">
                  <Icon color="green.fg">
                    <LuGraduationCap />
                  </Icon>
                  <Heading size="sm" fontWeight="600">
                    Change Major
                  </Heading>
                </Flex>
              </Card.Header>
              <Card.Body p="5" pt="0">
                <Stack gap="3">
                  <chakra.select
                    value={selectedMajorId ?? ""}
                    onChange={(e) =>
                      setSelectedMajorId(Number(e.target.value))
                    }
                    w="full"
                    px="3"
                    py="2"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    bg="bg"
                    fontSize="sm"
                    color="fg"
                    _focus={{ outline: "2px solid", outlineColor: "green.fg", outlineOffset: "2px" }}
                    cursor="pointer"
                  >
                    {majors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </chakra.select>
                  <Button
                    colorPalette="green"
                    size="sm"
                    borderRadius="lg"
                    loading={changingMajor}
                    disabled={!selectedMajorId || selectedMajorId === currentMajorProgramId}
                    onClick={handleChangeMajor}
                  >
                    Save Major
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>
          )}

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

                {student.hasCompletedOnboarding &&
                  (!resetConfirming ? (
                    <Button
                      variant="outline"
                      colorPalette="red"
                      justifyContent="start"
                      size="sm"
                      fontWeight="500"
                      onClick={() => setResetConfirming(true)}
                    >
                      <Icon mr="2">
                        <LuTrash2 />
                      </Icon>
                      Reset All Progress
                    </Button>
                  ) : (
                    <Stack gap="2" p="3" bg="red.subtle" borderWidth="1px" borderColor="red.muted" borderRadius="lg">
                      <HStack gap="2">
                        <Icon color="red.fg" flexShrink={0}>
                          <LuTriangleAlert />
                        </Icon>
                        <Text fontSize="xs" fontWeight="500" color="red.fg">
                          This will delete all your progress. Are you sure?
                        </Text>
                      </HStack>
                      <HStack gap="2">
                        <Button
                          size="xs"
                          colorPalette="red"
                          loading={resetting}
                          onClick={handleResetProgress}
                          borderRadius="md"
                          flex="1"
                        >
                          Yes, Reset
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setResetConfirming(false)}
                          borderRadius="md"
                          flex="1"
                        >
                          Cancel
                        </Button>
                      </HStack>
                    </Stack>
                  ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Grid>
    </Stack>
  );
}
