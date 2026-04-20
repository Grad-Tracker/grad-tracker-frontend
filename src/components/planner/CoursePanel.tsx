"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDroppable } from "@dnd-kit/core";
import {
  Box,
  Heading,
  HStack,
  Icon,
  Input,
  Text,
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
  canEdit?: boolean;
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
  canEdit = true,
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

  const filteredBlocks = useMemo(() => blocks
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
  [blocks, query]);

  // Track which blocks are collapsed (all open by default)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(() => new Set());
  const toggleBlock = useCallback((blockId: number) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  // Flatten blocks + courses into a single list for the virtualizer
  type VRow =
    | { kind: "header"; block: (typeof filteredBlocks)[0] }
    | { kind: "course"; course: (typeof filteredBlocks)[0]["courses"][0]; blockId: number }
    | { kind: "breadth"; block: (typeof filteredBlocks)[0]; allBreadthCourses: (typeof filteredBlocks)[0]["courses"] };

  const rows = useMemo<VRow[]>(() => {
    const result: VRow[] = [];
    for (const block of filteredBlocks) {
      result.push({ kind: "header", block });
      if (!collapsedBlocks.has(block.id)) {
        const isBreadth = !isGraduatePlan && isBreadthBlock(block);
        if (isBreadth) {
          const allBreadthCourses = allDedupedBlocks.find(isBreadthBlock)?.courses ?? [];
          result.push({ kind: "breadth", block, allBreadthCourses });
        }
        for (const course of block.courses) {
          result.push({ kind: "course", course, blockId: block.id });
        }
      }
    }
    return result;
  }, [filteredBlocks, collapsedBlocks, isGraduatePlan, allDedupedBlocks]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const row = rows[i];
      if (row.kind === "header") return 40;
      if (row.kind === "breadth") return 500;
      return 68;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  });

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
    {/* Outer box: droppable target — never scrolls, no ref conflict with virtualizer */}
    <Box
      ref={setNodeRef}
      w={{ base: "full", lg: `${panelWidth}px` }}
      minW={{ lg: `${MIN_PANEL_WIDTH}px` }}
      maxW={{ lg: `${MAX_PANEL_WIDTH}px` }}
      borderColor={isOver ? "orange.400" : "border.subtle"}
      bg={isOver ? "orange.subtle" : "bg"}
      h={{ lg: "100%" }}
      display="flex"
      flexDirection="column"
      transition={isResizing.current ? "none" : "background 0.2s, border-color 0.2s"}
    >
    {/* Inner box: scroll container for virtualizer */}
    <Box
      ref={scrollRef}
      overflowY="auto"
      flex="1"
      minH="0"
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

      {/* Course Blocks — virtualized */}
      {filteredBlocks.length === 0 ? (
        <Box px="4" py="8" textAlign="center">
          <Text fontSize="sm" color="fg.muted">
            {query ? "No courses match your search." : "No requirement courses found."}
          </Text>
        </Box>
      ) : (
        <Box
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index];
            return (
              <Box
                key={vItem.key}
                ref={virtualizer.measureElement}
                data-index={vItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                {row.kind === "header" && (
                  <HStack
                    px="4"
                    py="2.5"
                    gap="2"
                    cursor="pointer"
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => toggleBlock(row.block.id)}
                    userSelect="none"
                  >
                    <Icon
                      color="fg.subtle"
                      style={{
                        transition: "transform 0.2s",
                        transform: collapsedBlocks.has(row.block.id) ? "rotate(-90deg)" : "rotate(0deg)",
                      }}
                    >
                      <LuChevronDown size={14} />
                    </Icon>
                    <Text fontSize="xs" fontWeight="600" flex="1" textAlign="left" truncate>
                      {row.block.name}
                    </Text>
                    <Badge size="sm" variant="plain" color="fg.muted">
                      {row.block.courses.length}
                    </Badge>
                  </HStack>
                )}
                {row.kind === "breadth" && (
                  <BreadthPackageSelector
                    selectedPackageId={selectedBreadthPackageId}
                    onSelect={onBreadthPackageSelect}
                    completedCourseIds={completedCourseIds}
                    plannedCourseIds={plannedCourseIds}
                    allBreadthCourses={row.allBreadthCourses}
                  />
                )}
                {row.kind === "course" && (
                  <Box px="3" py="0.75">
                    <DraggableCourseCard
                      course={row.course}
                      isCompleted={completedCourseIds.has(row.course.id)}
                      isPlanned={plannedCourseIds.has(row.course.id)}
                      dragContextId={row.blockId}
                      dragDisabled={!canEdit}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
    </Box>{/* end inner scroll box */}

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