"use client";

import { useState } from "react";
import {
  Box,
  Badge,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@/components/ui/menu";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "@/components/ui/progress-circle";
import {
  LuEllipsisVertical,
  LuPencil,
  LuTrash2,
  LuCalendar,
  LuBookOpen,
  LuGraduationCap,
  LuCheck,
  LuX,
  LuArrowRight,
} from "react-icons/lu";
import type { PlanWithMeta } from "@/types/planner";

interface PlanCardProps {
  plan: PlanWithMeta;
  onOpen: (planId: number) => void;
  onRename: (planId: number, newName: string) => Promise<void>;
  onDelete: (planId: number) => void;
  canDelete: boolean;
  index: number;
}

export default function PlanCard({
  plan,
  onOpen,
  onRename,
  onDelete,
  canDelete,
  index,
}: PlanCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(plan.name);
  const [isHovered, setIsHovered] = useState(false);

  async function confirmRename() {
    if (renameValue.trim() && renameValue.trim() !== plan.name) {
      await onRename(plan.id, renameValue.trim());
    }
    setIsRenaming(false);
  }

  const degreePct =
    plan.total_credits > 0
      ? Math.min(100, Math.round((plan.total_credits / 120) * 100))
      : 0;

  const progressColor =
    degreePct >= 75 ? "blue" : degreePct >= 40 ? "yellow" : "orange";

  return (
    <Box
      role="group"
      position="relative"
      borderRadius="2xl"
      borderWidth="1px"
      borderColor="border.subtle"
      bg="bg"
      overflow="hidden"
      cursor="pointer"
      transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      _hover={{
        borderColor: "blue.300",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
        transform: "translateY(-4px)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (!isRenaming) onOpen(plan.id);
      }}
      style={{
        animationDelay: `${index * 80}ms`,
      }}
      className="plan-card-enter"
    >
      {/* Top accent bar */}
      <Box
        h="3px"
        bg={plan.has_graduate_program ? "purple.500" : "blue.500"}
        transition="height 0.2s"
        _groupHover={{ h: "4px" }}
      />

      <Box p="5">
        {/* Header row: name + menu */}
        <Flex justify="space-between" align="start" mb="4">
          <Box flex="1" minW="0" pr="2">
            {isRenaming ? (
              <HStack gap="1.5">
                <Input
                  size="sm"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") setIsRenaming(false);
                  }}
                  autoFocus
                  borderRadius="lg"
                  onClick={(e) => e.stopPropagation()}
                  fontFamily="var(--font-dm-sans), sans-serif"
                />
                <IconButton
                  aria-label="Confirm"
                  size="xs"
                  variant="ghost"
                  colorPalette="blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmRename();
                  }}
                >
                  <LuCheck />
                </IconButton>
                <IconButton
                  aria-label="Cancel"
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(false);
                  }}
                >
                  <LuX />
                </IconButton>
              </HStack>
            ) : (
              <Heading
                size="md"
                fontFamily="var(--font-dm-sans), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
                truncate
              >
                {plan.name}
              </Heading>
            )}
            {plan.description && (
              <Text fontSize="xs" color="fg.muted" mt="1" truncate>
                {plan.description}
              </Text>
            )}
          </Box>

          <MenuRoot positioning={{ placement: "bottom-end" }}>
            <MenuTrigger asChild>
              <IconButton
                aria-label="Plan options"
                size="xs"
                variant="ghost"
                color="fg.muted"
                _hover={{ color: "fg", bg: "bg.subtle" }}
                onClick={(e) => e.stopPropagation()}
                opacity={isHovered ? 1 : 0}
                transition="opacity 0.15s"
                borderRadius="lg"
              >
                <LuEllipsisVertical />
              </IconButton>
            </MenuTrigger>
            <MenuContent minW="140px" borderRadius="lg">
              <MenuItem
                value="rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(plan.name);
                  setIsRenaming(true);
                }}
              >
                <LuPencil />
                Rename
              </MenuItem>
              {canDelete && (
                <MenuItem
                  value="delete"
                  color="fg.error"
                  _hover={{ bg: "red.subtle" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(plan.id);
                  }}
                >
                  <LuTrash2 />
                  Delete
                </MenuItem>
              )}
            </MenuContent>
          </MenuRoot>
        </Flex>

        {/* Program badges */}
        {plan.has_graduate_program && (
          <Badge
            size="sm"
            variant="subtle"
            colorPalette="purple"
            mb="4"
            borderRadius="full"
          >
            <LuGraduationCap size={12} />
            Graduate
          </Badge>
        )}

        {/* Stats row */}
        <Flex justify="space-between" align="end">
          <VStack align="start" gap="2.5">
            <HStack gap="4">
              <HStack gap="1.5">
                <Box
                  w="7"
                  h="7"
                  borderRadius="md"
                  bg="blue.subtle"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color="blue.fg" boxSize="3.5">
                    <LuCalendar />
                  </Icon>
                </Box>
                <Box>
                  <Text fontSize="lg" fontWeight="700" lineHeight="1">
                    {plan.term_count}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    semesters
                  </Text>
                </Box>
              </HStack>

              <HStack gap="1.5">
                <Box
                  w="7"
                  h="7"
                  borderRadius="md"
                  bg="purple.subtle"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color="purple.fg" boxSize="3.5">
                    <LuBookOpen />
                  </Icon>
                </Box>
                <Box>
                  <Text fontSize="lg" fontWeight="700" lineHeight="1">
                    {plan.course_count}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    courses
                  </Text>
                </Box>
              </HStack>

              <HStack gap="1.5">
                <Box
                  w="7"
                  h="7"
                  borderRadius="md"
                  bg="blue.subtle"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color="blue.fg" boxSize="3.5">
                    <LuGraduationCap />
                  </Icon>
                </Box>
                <Box>
                  <Text fontSize="lg" fontWeight="700" lineHeight="1">
                    {plan.total_credits}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    credits
                  </Text>
                </Box>
              </HStack>
            </HStack>
          </VStack>

          {/* Progress ring */}
          <ProgressCircleRoot
            value={degreePct}
            size="lg"
            colorPalette={progressColor}
          >
            <ProgressCircleRing
              cap="round"
              css={{ "--thickness": "4px" }}
            />
            <ProgressCircleValueText
              fontSize="xs"
              fontWeight="700"
            />
          </ProgressCircleRoot>
        </Flex>
      </Box>

      {/* Bottom action hint */}
      <Flex
        px="5"
        py="2.5"
        borderTopWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        align="center"
        justify="space-between"
        opacity={isHovered ? 1 : 0.6}
        transition="opacity 0.2s"
      >
        <Text fontSize="xs" color="fg.muted">
          {plan.updated_at
            ? `Updated ${new Date(plan.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}`
            : "No changes yet"}
        </Text>
        <HStack gap="1" color="blue.fg" fontSize="xs" fontWeight="600">
          <Text>Open</Text>
          <LuArrowRight size={12} />
        </HStack>
      </Flex>
    </Box>
  );
}