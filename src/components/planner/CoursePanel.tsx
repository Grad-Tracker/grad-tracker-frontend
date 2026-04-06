"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Box,
  Collapsible,
  Heading,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { LuSearch, LuChevronDown, LuBookOpen, LuArrowDownToLine, LuGripVertical } from "react-icons/lu";
import type { RequirementBlockWithCourses, PlannedCourseWithDetails, GraduateTrack } from "@/types/planner";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";
import { isBreadthBlock } from "@/types/planner";
import DraggableCourseCard from "./DraggableCourseCard";
import RequirementProgress from "./RequirementProgress";
import GenEdProgress from "./GenEdProgress";
import BreadthPackageSelector from "./BreadthPackageSelector";
import GraduateTrackSelector from "./GraduateTrackSelector";
import { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from "@/constants/planner";

interface CoursePanelProps {
  blocks: RequirementBlockWithCourses[];
  allDedupedBlocks: RequirementBlockWithCourses[];
  completedCourseIds: Set<number>;
  plannedCourseIds: Set<number>;
  plannedCourses: PlannedCourseWithDetails[];
  isDragActive?: boolean;
  selectedBreadthPackageId: string | null;
  onBreadthPackageSelect: (packageId: string) => void;
  isGraduatePlan?: boolean;
  graduateTracks?: GraduateTrack[];
  selectedTrackId?: number | null;
  onTrackSelect?: (trackId: number) => void;
  genEdBuckets?: GenEdBucketWithCourses[];
}

export default function CoursePanel({
  blocks,
  allDedupedBlocks,
  completedCourseIds,
  plannedCourseIds,
  plannedCourses,
  isDragActive = false,
  selectedBreadthPackageId,
  onBreadthPackageSelect,
  isGraduatePlan = false,
  graduateTracks = [],
  selectedTrackId = null,
  onTrackSelect,
  genEdBuckets = [],
}: CoursePanelProps) {
  const { isOver, setNodeRef } = useDroppable({ id: "course-panel" });
  const [search, setSearch] = useState("");
  const [panelWidth, setPanelWidth] = useState(MIN_PANEL_WIDTH);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(MIN_PANEL_WIDTH);
  const rafId = useRef<number | null>(null);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelWidth]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing.current) return;
    if (rafId.current !== null) return;
    const clientX = e.clientX;
    rafId.current = requestAnimationFrame(() => {
      const delta = clientX - startX.current;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
      setPanelWidth(newWidth);
      rafId.current = null;
    });
  }, []);

  const handleResizeEnd = useCallback(() => {
    isResizing.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);
  const query = search.toLowerCase().trim();

  const filteredBlocks = useMemo(
    () =>
      blocks
        .map((block) => ({
          ...block,
          courses: block.courses.filter((c) => {
            if (!query) return true;
            return (
              `${c.subject} ${c.number}`.toLowerCase().includes(query) ||
              c.title.toLowerCase().includes(query)
            );
          }),
        }))
        .filter((block) => block.courses.length > 0),
    [blocks, query]
  );

  const totalAvailable = useMemo(
    () =>
      blocks.reduce(
        (sum, b) =>
          sum +
          b.courses.filter(
            (c) => !completedCourseIds.has(c.id) && !plannedCourseIds.has(c.id)
          ).length,
        0
      ),
    [blocks, completedCourseIds, plannedCourseIds]
  );

  return (
    <Box
      display="flex"
      flexShrink={0}
      h={{ lg: "100%" }}
    >
    <Box
      ref={setNodeRef}
      w={{ base: "full", lg: `${panelWidth}px` }}
      minW={{ lg: `${MIN_PANEL_WIDTH}px` }}
      maxW={{ lg: `${MAX_PANEL_WIDTH}px` }}
      borderColor={isOver ? "orange.400" : "border.subtle"}
      bg={isOver ? "orange.subtle" : "bg"}
      overflowY="auto"
      h={{ lg: "100%" }}
      transition={isResizing.current ? "none" : "background 0.2s, border-color 0.2s"}
    >
      {/* Drop-to-remove indicator */}
      {isOver && (
        <Box
          px="4"
          py="2"
          bg="orange.subtle"
          borderBottomWidth="1px"
          borderColor="orange.200"
          textAlign="center"
        >
          <HStack justify="center" gap="2">
            <Icon boxSize="4" color="orange.fg">
              <LuArrowDownToLine />
            </Icon>
            <Text fontSize="xs" fontWeight="600" color="orange.fg">
              Drop to unplan course
            </Text>
          </HStack>
        </Box>
      )}

      {/* Panel Header */}
      <Box px="4" py="4" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack mb="3" gap="2">
          <Icon boxSize="5" color="blue.fg">
            <LuBookOpen />
          </Icon>
          <Heading
            size="sm"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="400"
            letterSpacing="-0.02em"
          >
            Course Pool
          </Heading>
          <Badge size="sm" variant="subtle" colorPalette="blue">
            {totalAvailable} available
          </Badge>
        </HStack>
        <Box position="relative">
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
            zIndex="1"
          >
            <LuSearch size={14} />
          </Box>
          <Input
            size="sm"
            pl="9"
            placeholder="Search courses..."
            borderRadius="lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
      </Box>

      {/* Requirement Progress */}
      <RequirementProgress
        blocks={blocks}
        plannedCourses={plannedCourses}
        completedCourseIds={completedCourseIds}
        hasBreadthPackageSelected={!!selectedBreadthPackageId}
        isGraduatePlan={isGraduatePlan}
      />

      {/* Gen Ed Progress */}
      {!isGraduatePlan && (
        <GenEdProgress
          buckets={genEdBuckets}
          plannedCourses={plannedCourses}
          completedCourseIds={completedCourseIds}
        />
      )}

      {/* Graduate Track Selector */}
      {isGraduatePlan && graduateTracks.length >= 2 && onTrackSelect && (
        <GraduateTrackSelector
          tracks={graduateTracks}
          selectedTrackId={selectedTrackId}
          onSelect={onTrackSelect}
        />
      )}

      {/* Course Blocks */}
      <VStack align="stretch" gap="0" pb="4">
        {filteredBlocks.length === 0 && (
          <Box px="4" py="8" textAlign="center">
            <Text fontSize="sm" color="fg.muted">
              {query
                ? "No courses match your search."
                : "No requirement courses found."}
            </Text>
          </Box>
        )}

        {filteredBlocks.map((block) => {
          const isBreadth = !isGraduatePlan && isBreadthBlock(block);
          const allBreadthCourses = isBreadth
            ? (allDedupedBlocks.find(isBreadthBlock)?.courses ?? [])
            : [];

          return (
            <Collapsible.Root key={block.id} defaultOpen>
              <Collapsible.Trigger
                px="4"
                py="2.5"
                display="flex"
                alignItems="center"
                gap="2"
                w="full"
                cursor="pointer"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                _hover={{ bg: "bg.subtle" }}
                transition="all 0.15s"
              >
                <Collapsible.Indicator
                  transition="transform 0.2s"
                  _open={{ transform: "rotate(180deg)" }}
                >
                  <LuChevronDown size={14} />
                </Collapsible.Indicator>
                <Text fontSize="xs" fontWeight="600" flex="1" textAlign="left" truncate>
                  {block.name}
                </Text>
                <Badge size="sm" variant="plain" color="fg.muted">
                  {block.courses.length}
                </Badge>
              </Collapsible.Trigger>
              <Collapsible.Content>
                {isBreadth && (
                  <BreadthPackageSelector
                    selectedPackageId={selectedBreadthPackageId}
                    onSelect={onBreadthPackageSelect}
                    completedCourseIds={completedCourseIds}
                    plannedCourseIds={plannedCourseIds}
                    allBreadthCourses={allBreadthCourses}
                  />
                )}
                <VStack align="stretch" gap="1.5" px="3" py="2">
                  {block.courses.map((course) => (
                    <DraggableCourseCard
                      key={course.id}
                      course={course}
                      isCompleted={completedCourseIds.has(course.id)}
                      isPlanned={plannedCourseIds.has(course.id)}
                      dragContextId={block.id}
                    />
                  ))}
                </VStack>
              </Collapsible.Content>
            </Collapsible.Root>
          );
        })}
      </VStack>
    </Box>

    {/* Resize handle */}
    <Box
      display={{ base: "none", lg: "flex" }}
      w="10px"
      cursor="col-resize"
      alignItems="center"
      justifyContent="center"
      bg="transparent"
      borderRightWidth="1px"
      borderColor="border.subtle"
      _hover={{ bg: "bg.subtle", borderColor: "blue.300" }}
      transition="all 0.15s"
      flexShrink={0}
      onPointerDown={handleResizeStart}
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
      onPointerCancel={handleResizeEnd}
      style={{ touchAction: "none" }}
    >
      <Box color="fg.subtle" opacity={0.5}>
        <LuGripVertical size={12} />
      </Box>
    </Box>
    </Box>
  );
}