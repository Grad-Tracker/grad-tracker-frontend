"use client";

import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Separator as Divider,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCircleCheck, LuClock, LuMinus } from "react-icons/lu";

import GenEdRequirements from "@/components/requirements/GenEdRequirements";
import { evaluatePrereqsForCourses, type PrereqEvaluationMap } from "@/lib/prereq";
import {
  ProgressBar,
  ProgressLabel,
  ProgressRoot,
  ProgressValueText,
} from "@/components/ui/progress";
import {
  fetchProgramRequirements,
  fetchStudentMajorProgram,
} from "@/lib/supabase/queries/onboarding";
import { fetchStudentCourseProgress } from "@/lib/supabase/queries/planner";

type CourseRow = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

type BlockUI = {
  title: string;
  totalCreditsRequired: number;
  requiredCourses: CourseRow[];
  completedCredits: number;
  inProgressCredits: number;
};

function normalizeCourseCode(c: CourseRow) {
  return `${c.subject ?? ""} ${c.number ?? ""}`.trim();
}

function sortByCode(a: CourseRow, b: CourseRow) {
  const aSubject = (a.subject ?? "").toString();
  const bSubject = (b.subject ?? "").toString();
  if (aSubject !== bSubject) return aSubject.localeCompare(bSubject);
  const aNumber = (a.number ?? "").toString();
  const bNumber = (b.number ?? "").toString();
  return aNumber.localeCompare(bNumber);
}

function statusMeta(status: "completed" | "inProgress" | "remaining") {
  if (status === "completed") {
    return {
      label: "Completed",
      colorPalette: "green" as const,
      icon: LuCircleCheck,
    };
  }
  if (status === "inProgress") {
    return {
      label: "In progress",
      colorPalette: "orange" as const,
      icon: LuClock,
    };
  }
  return {
    label: "Remaining",
    colorPalette: "gray" as const,
    icon: LuMinus,
  };
}

// Simple mapping from DB block names -> the 3 Jira buckets we own in this component
function categorizeBlock(blockName: string) {
  const n = blockName.toLowerCase();

  if (n.includes("core")) return "Major Core";
  if (n.includes("elective")) return "Major Electives";
  if (n.includes("free")) return "Free Electives";

  return "Free Electives";
}

export default function RequirementsDashboard({
  studentId,
}: {
  studentId: number;
}) {
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [blocks, setBlocks] = React.useState<BlockUI[]>([]);
  const [completedIds, setCompletedIds] = React.useState<Set<number>>(new Set());
  const [inProgressIds, setInProgressIds] = React.useState<Set<number>>(new Set());
  const [prereqByCourse, setPrereqByCourse] = React.useState<PrereqEvaluationMap>(
    new Map()
  );

  // Per-block toggle for remaining list
  const [showRemaining, setShowRemaining] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) Find the student's major program
        const majorProgram = await fetchStudentMajorProgram(studentId);
        if (!majorProgram) {
          // No major chosen yet
          setBlocks([]);
          setCompletedIds(new Set());
          setInProgressIds(new Set());
          setPrereqByCourse(new Map());
          setLoading(false);
          return;
        }

        const majorProgramId = Number(majorProgram.program_id);
        if (!majorProgramId) {
          setBlocks([]);
          setCompletedIds(new Set());
          setInProgressIds(new Set());
          setPrereqByCourse(new Map());
          setLoading(false);
          return;
        }

        const [progressRows, rawBlocks] = await Promise.all([
          fetchStudentCourseProgress(studentId),
          fetchProgramRequirements(majorProgramId),
        ]);

        const completedSet = new Set<number>(
          progressRows
            .filter(
              (r) =>
                r.completed === true ||
                String(r.progress_status ?? "").toUpperCase() === "COMPLETED"
            )
            .map((r) => Number(r.course_id))
            .filter((x) => !Number.isNaN(x))
        );

        const inProgressSet = new Set<number>(
          progressRows
            .filter((r) => {
              const s = String(r.progress_status ?? "").toLowerCase();
              return s === "enrolled" || s === "waitlist";
            })
            .map((r) => Number(r.course_id))
            .filter((x) => !Number.isNaN(x))
        );

        // 5) Aggregate blocks into the 3 UI buckets we render here
        const agg: Record<string, BlockUI> = {
          "Major Core": {
            title: "Major Core",
            totalCreditsRequired: 0,
            requiredCourses: [],
            completedCredits: 0,
            inProgressCredits: 0,
          },
          "Major Electives": {
            title: "Major Electives",
            totalCreditsRequired: 0,
            requiredCourses: [],
            completedCredits: 0,
            inProgressCredits: 0,
          },
          "Free Electives": {
            title: "Free Electives",
            totalCreditsRequired: 0,
            requiredCourses: [],
            completedCredits: 0,
            inProgressCredits: 0,
          },
        };

        for (const b of rawBlocks) {
          const name = String(b.name ?? "");
          if (!name) continue;

          // Skip Gen Ed blocks here because GenEdRequirements handles that section already
          if (name.toLowerCase().includes("general")) continue;

          const bucket = categorizeBlock(name);

          const courseRows = (b.courses ?? []).map((c) => ({
            id: Number(c.id),
            subject: c.subject ?? null,
            number: c.number ?? null,
            title: c.title ?? null,
            credits: c.credits ?? null,
          })) as CourseRow[];

          // total credits required:
          // prefer credits_required if present, else sum the course credits
          const fallbackTotal = courseRows.reduce(
            (sum, c) => sum + Number(c.credits ?? 0),
            0
          );
          const total = Number(b.credits_required ?? fallbackTotal ?? 0);

          // compute completed + in-progress credits within this block
          let completedCreds = 0;
          let inProgCreds = 0;

          for (const c of courseRows) {
            const cid = Number(c.id);
            const credits = Number(c.credits ?? 0);

            if (completedSet.has(cid)) completedCreds += credits;
            else if (inProgressSet.has(cid)) inProgCreds += credits;
          }

          agg[bucket].totalCreditsRequired += total;
          agg[bucket].requiredCourses.push(...courseRows);
          agg[bucket].completedCredits += completedCreds;
          agg[bucket].inProgressCredits += inProgCreds;
        }

        // De-dupe courses per bucket by id (so we do not render duplicates)
        const finalized: BlockUI[] = Object.values(agg).map((blk) => {
          const seen = new Set<number>();
          const unique = blk.requiredCourses.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });

          return { ...blk, requiredCourses: unique };
        });

        const displayedCourseIds = Array.from(
          new Set(finalized.flatMap((blk) => blk.requiredCourses.map((c) => c.id)))
        );
        const prereqMap = await evaluatePrereqsForCourses(displayedCourseIds, studentId);

        setBlocks(finalized);
        setCompletedIds(completedSet);
        setInProgressIds(inProgressSet);
        setPrereqByCourse(prereqMap);

        // Initialize showRemaining flags (default false) without wiping user toggles
        setShowRemaining((prev) => {
          const next = { ...prev };
          for (const b of finalized) {
            if (next[b.title] === undefined) next[b.title] = false;
          }
          return next;
        });

        setLoading(false);
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Failed to load requirements.");
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  const computeStatus = React.useCallback(
    (courseId: number) => {
      if (completedIds.has(courseId)) return "completed" as const;
      if (inProgressIds.has(courseId)) return "inProgress" as const;
      return "remaining" as const;
    },
    [completedIds, inProgressIds]
  );

  const splitCourses = React.useCallback(
    (requiredCourses: CourseRow[]) => {
      const completedCourses = requiredCourses
        .filter((c) => computeStatus(c.id) === "completed")
        .sort(sortByCode);
      const inProgressCourses = requiredCourses
        .filter((c) => computeStatus(c.id) === "inProgress")
        .sort(sortByCode);
      const remainingCourses = requiredCourses
        .filter((c) => computeStatus(c.id) === "remaining")
        .sort(sortByCode);

      return { completedCourses, inProgressCourses, remainingCourses };
    },
    [computeStatus]
  );

  const renderCourseRow = (blkTitle: string, c: CourseRow) => {
    const cid = c.id;

    const status = computeStatus(cid);

    const meta = statusMeta(status);
    const code = normalizeCourseCode(c);
    const prereq = prereqByCourse.get(cid);
    const showPrereqWarning = status !== "completed" && prereq != null && !prereq.unlocked;

    return (
      <HStack
        key={`${blkTitle}-${cid}`}
        justify="space-between"
        p="3"
        borderRadius="lg"
        border={status === "completed" ? "1px solid" : undefined}
        borderWidth="1px"
        boxShadow={
          status === "completed"
            ? "0 0 0 1px rgba(34,197,94,0.25)"
            : undefined
        }
        bg={
          status === "completed"
            ? "green.700"
            : status === "inProgress"
              ? "orange.subtle"
              : "bg.subtle"
        }
        borderColor={
          status === "completed"
            ? "green.500"
            : status === "inProgress"
              ? "orange.muted"
              : "border.subtle"
        }
        _hover={status === "completed" ? { bg: "green.600" } : undefined}
      >
        <HStack gap="3">
          <Box>
            <Text
              fontWeight={status === "completed" ? "bold" : "600"}
              fontSize="sm"
              color={status === "completed" ? "white" : undefined}
            >
              {code}
              {c.credits ? ` • ${c.credits} cr` : ""}
            </Text>
            <Text
              color={status === "completed" ? "whiteAlpha.900" : "fg.subtle"}
              fontSize="sm"
              fontWeight={status === "completed" ? "bold" : "500"}
            >
              {c.title ?? "Untitled course"}
            </Text>
            {showPrereqWarning && prereq.summary.length > 0 ? (
              <Text color="orange.600" fontSize="xs" fontWeight="400">
                {prereq.summary.join(" • ")}
              </Text>
            ) : null}
          </Box>
        </HStack>

        <HStack gap="2">
          {showPrereqWarning ? (
            <Badge colorPalette="orange" variant="subtle" size="sm">
              Prereq not met
            </Badge>
          ) : null}
          <Badge colorPalette={meta.colorPalette} variant="subtle" size="sm">
            {meta.label}
          </Badge>
        </HStack>
      </HStack>
    );
  };

  const renderBlock = (blk: BlockUI) => {
    const total = Math.max(0, Math.round(blk.totalCreditsRequired));
    const completed = Math.min(total, Math.round(blk.completedCredits));
    const inProg = Math.min(total - completed, Math.round(blk.inProgressCredits));
    const remaining = Math.max(total - completed - inProg, 0);

    const percentage =
      total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

    const { completedCourses, inProgressCourses, remainingCourses } = splitCourses(
      blk.requiredCourses
    );

    const isRemainingOpen = !!showRemaining[blk.title];

    return (
      <Card.Root
        key={blk.title}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <Card.Body>
          <VStack align="stretch" gap="4">
            <Flex justify="space-between" align="start">
              <Box>
                <Heading size="md">{blk.title}</Heading>
              </Box>

              <Badge
                colorPalette={percentage === 100 ? "green" : "gray"}
                variant="subtle"
              >
                {percentage}% complete
              </Badge>
            </Flex>

            <HStack gap="2" wrap="wrap">
              <Badge colorPalette="green" variant="subtle">
                Completed ({completedCourses.length}) • {completed} cr
              </Badge>
              <Badge colorPalette="orange" variant="subtle">
                In progress ({inProgressCourses.length}) • {inProg} cr
              </Badge>
              <Badge colorPalette="gray" variant="outline">
                Remaining ({remainingCourses.length}) • {remaining} cr
              </Badge>
            </HStack>

            <ProgressRoot value={percentage} colorPalette="green" size="sm">
              <HStack justify="space-between" mb="2">
                <ProgressLabel fontWeight="500" fontSize="sm">
                  Progress
                </ProgressLabel>
                <ProgressValueText fontWeight="600" fontSize="sm" />
              </HStack>
              <ProgressBar borderRadius="full" />
            </ProgressRoot>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="2">
                Required courses
              </Text>

              {blk.requiredCourses.length === 0 ? (
                <Text color="fg.muted" fontSize="sm">
                  No courses found for this block yet.
                </Text>
              ) : (
                <VStack align="stretch" gap="2">
                  {completedCourses.length > 0 ? (
                    <>
                      <Divider opacity={0.4} mt="3" mb="2" />
                      <HStack justify="space-between" mt="3" mb="2">
                        <Text fontSize="sm" fontWeight="600" color="fg.muted">
                          Completed
                        </Text>
                        <Badge variant="subtle" colorPalette="green">
                          {completedCourses.length}
                        </Badge>
                      </HStack>
                      {completedCourses.map((c) => renderCourseRow(blk.title, c))}
                    </>
                  ) : null}

                  {inProgressCourses.length > 0 ? (
                    <>
                      <Divider opacity={0.4} mt="3" mb="2" />
                      <HStack justify="space-between" mt="3" mb="2">
                        <Text fontSize="sm" fontWeight="600" color="fg.muted">
                          In progress
                        </Text>
                        <Badge variant="subtle" colorPalette="orange">
                          {inProgressCourses.length}
                        </Badge>
                      </HStack>
                      {inProgressCourses.map((c) => renderCourseRow(blk.title, c))}
                    </>
                  ) : null}

                  {remainingCourses.length > 0 ? (
                    <>
                      <Divider opacity={0.4} mt="3" mb="2" />
                      <HStack justify="flex-end" align="center" mt="3" mb="2">
                        <Button
                          variant="ghost"
                          size="xs"
                          color="fg.muted"
                          px="1"
                          minH="unset"
                          height="auto"
                          onClick={() =>
                            setShowRemaining((prev) => ({
                              ...prev,
                              [blk.title]: !prev[blk.title],
                            }))
                          }
                        >
                          {isRemainingOpen
                            ? "Hide remaining"
                            : `Show remaining (${remainingCourses.length})`}
                        </Button>
                      </HStack>
                      {isRemainingOpen
                        ? remainingCourses.map((c) => renderCourseRow(blk.title, c))
                        : null}
                    </>
                  ) : null}
                </VStack>
              )}
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  };

  return (
    <Box px={{ base: "4", md: "8" }} py="6">
      <VStack align="stretch" gap="5">
        <Box>
          <Text fontSize="sm" color="fg.muted" fontWeight="500">
            Requirements
          </Text>
          <Heading size="lg">Degree Requirements</Heading>
        </Box>

        {/* Gen Ed block */}
       {/* Gen Ed block (collapsible) */}
<Card.Root borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
  <Card.Body>
    <VStack align="stretch" gap="4">
      <Flex justify="space-between" align="start">
        <Box>
          <Heading size="md">General Education</Heading>
          <Text color="fg.muted" fontSize="sm">
            View completed and in-progress Gen Ed courses. Expand to see remaining.
          </Text>
        </Box>

        <Text
          fontSize="sm"
          color="fg.muted"
          cursor="pointer"
          userSelect="none"
          onClick={() =>
            setShowRemaining((prev) => ({
              ...prev,
              ["General Education"]: !prev["General Education"],
            }))
          }
        >
          {showRemaining["General Education"] ? "Hide details" : "Show details"}
        </Text>
      </Flex>

      {showRemaining["General Education"] ? (
        <GenEdRequirements studentId={studentId} />
      ) : (
        <Text color="fg.muted" fontSize="sm">
          Details hidden.
        </Text>
      )}
    </VStack>
  </Card.Body>
</Card.Root>

        {loading ? (
          <Text color="fg.muted">Loading degree blocks...</Text>
        ) : errorMsg ? (
          <Text color="red.500">{errorMsg}</Text>
        ) : (
          <>{blocks.map(renderBlock)}</>
        )}
      </VStack>
    </Box>
  );
}
