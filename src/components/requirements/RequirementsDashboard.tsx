"use client";

import * as React from "react";
import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCircleCheck, LuClock, LuMinus } from "react-icons/lu";

import GenEdRequirements from "@/components/requirements/GenEdRequirements";
import { createClient } from "@/lib/supabase/client";
import {
  ProgressBar,
  ProgressLabel,
  ProgressRoot,
  ProgressValueText,
} from "@/components/ui/progress";
import { DB_TABLES, PROGRAM_TYPES } from "@/lib/supabase/queries/schema";

type CourseRow = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

type RequirementCourseRow = {
  course_id: number | null;
  courses: CourseRow | null;
};

type RequirementBlockRow = {
  id: number;
  name: string | null;
  credits_required: number | null;
  program_requirement_courses: RequirementCourseRow[] | null;
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

  // Per-block toggle for remaining list
  const [showRemaining, setShowRemaining] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const supabase = createClient();

      try {
        // 1) Find the student's major program (student_programs -> programs where program_type = major)
        const { data: studentPrograms, error: spErr } = await supabase
          .from(DB_TABLES.studentPrograms)
          .select("program_id")
          .eq("student_id", studentId);

        if (spErr) throw spErr;

        const programIds = (studentPrograms ?? [])
          .map((r: any) => Number(r?.program_id))
          .filter((x: number) => !Number.isNaN(x));

        if (programIds.length === 0) {
          // No major chosen yet
          setBlocks([]);
          setCompletedIds(new Set());
          setInProgressIds(new Set());
          setLoading(false);
          return;
        }

        const { data: majorProgram, error: mpErr } = await supabase
          .from(DB_TABLES.programs)
          .select("id,name,program_type")
          .in("id", programIds)
          .eq("program_type", PROGRAM_TYPES.major)
          .maybeSingle();

        if (mpErr) throw mpErr;

        const majorProgramId = Number((majorProgram as any)?.id);
        if (!majorProgramId) {
          setBlocks([]);
          setCompletedIds(new Set());
          setInProgressIds(new Set());
          setLoading(false);
          return;
        }

        // 2) Completed courses (green)
        const { data: completedRows, error: completedErr } = await supabase
          .from(DB_TABLES.studentCourseHistory)
          .select("course_id")
          .eq("student_id", studentId);

        if (completedErr) throw completedErr;

        const completedSet = new Set<number>(
          (completedRows ?? [])
            .map((r: any) => Number(r?.course_id))
            .filter((x: number) => !Number.isNaN(x))
        );

        // 3) In-progress courses (yellow) from planned courses
        const { data: plannedRows, error: plannedErr } = await supabase
          .from(DB_TABLES.studentPlannedCourses)
          .select("course_id,status")
          .eq("student_id", studentId);

        if (plannedErr) throw plannedErr;

        const inProgressSet = new Set<number>(
          (plannedRows ?? [])
            .filter((r: any) => {
              const s = String(r?.status ?? "").toLowerCase();
              return s === "enrolled" || s === "waitlist";
            })
            .map((r: any) => Number(r?.course_id))
            .filter((x: number) => !Number.isNaN(x))
        );

        // 4) Program requirement blocks + their courses
        const { data: blockRows, error: blocksErr } = await supabase
          .from(DB_TABLES.programRequirementBlocks)
          .select(`
            id,
            name,
            credits_required,
            program_requirement_courses (
              course_id,
              courses:course_id (
                id,
                subject,
                number,
                title,
                credits
              )
            )
          `)
          .eq("program_id", majorProgramId);

        if (blocksErr) throw blocksErr;

        const rawBlocks = (blockRows ?? []) as unknown as RequirementBlockRow[];

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

          const courseRows = (b.program_requirement_courses ?? [])
            .map((r) => r?.courses)
            .filter((c): c is CourseRow => !!c);

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

        setBlocks(finalized);
        setCompletedIds(completedSet);
        setInProgressIds(inProgressSet);

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

  const renderCourseRow = (blkTitle: string, c: CourseRow) => {
    const cid = c.id;

    const status =
      completedIds.has(cid)
        ? ("completed" as const)
        : inProgressIds.has(cid)
          ? ("inProgress" as const)
          : ("remaining" as const);

    const meta = statusMeta(status);
    const code = normalizeCourseCode(c);

    return (
      <HStack
        key={`${blkTitle}-${cid}`}
        justify="space-between"
        p="3"
        borderRadius="lg"
        borderWidth="1px"
        bg={
          status === "completed"
            ? "green.subtle"
            : status === "inProgress"
              ? "orange.subtle"
              : "gray.subtle"
        }
        borderColor={
          status === "completed"
            ? "green.muted"
            : status === "inProgress"
              ? "orange.muted"
              : "border.subtle"
        }
      >
        <HStack gap="3">
          <Box>
            <Icon as={meta.icon} />
          </Box>
          <Box>
            <Text fontWeight="600" fontSize="sm">
              {code}
              {c.credits ? ` • ${c.credits} cr` : ""}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {c.title ?? "Untitled course"}
            </Text>
          </Box>
        </HStack>

        <Badge colorPalette={meta.colorPalette} variant="subtle" size="sm">
          {meta.label}
        </Badge>
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

    const completedCourses = blk.requiredCourses.filter((c) =>
      completedIds.has(c.id)
    );
    const inProgressCourses = blk.requiredCourses.filter(
      (c) => !completedIds.has(c.id) && inProgressIds.has(c.id)
    );
    const remainingCourses = blk.requiredCourses.filter(
      (c) => !completedIds.has(c.id) && !inProgressIds.has(c.id)
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
                <Text color="fg.muted" fontSize="sm">
                  Completed {completed} / {total} credits
                  {inProg > 0 ? ` • In progress ${inProg}` : ""} • Remaining{" "}
                  {remaining}
                </Text>
              </Box>

              <Badge
                colorPalette={percentage === 100 ? "green" : "gray"}
                variant="subtle"
              >
                {percentage}% complete
              </Badge>
            </Flex>

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
              <HStack justify="space-between" align="center" mb="2">
                <Text fontSize="sm" fontWeight="600" color="fg.muted">
                  Required courses
                </Text>

                <Text
                  fontSize="sm"
                  color="fg.muted"
                  cursor="pointer"
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
                </Text>
              </HStack>

              {blk.requiredCourses.length === 0 ? (
                <Text color="fg.muted" fontSize="sm">
                  No courses found for this block yet.
                </Text>
              ) : (
                <VStack align="stretch" gap="2">
                  {/* Completed first */}
                  {completedCourses.map((c) => renderCourseRow(blk.title, c))}

                  {/* In progress next */}
                  {inProgressCourses.map((c) => renderCourseRow(blk.title, c))}

                  {/* Remaining only when toggled */}
                  {isRemainingOpen &&
                    remainingCourses.map((c) => renderCourseRow(blk.title, c))}
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