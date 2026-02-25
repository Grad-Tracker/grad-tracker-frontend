"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from "@/components/ui/popover";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@/components/ui/menu";
import {
  LuChevronDown,
  LuPlus,
  LuEllipsis,
  LuPencil,
  LuTrash2,
  LuBookOpen,
  LuCheck,
  LuX,
} from "react-icons/lu";
import type { PlanWithMeta } from "@/types/planner";

interface PlanSwitcherProps {
  plans: PlanWithMeta[];
  activePlanId: number | null;
  onSwitchPlan: (planId: number) => void;
  onCreatePlan: () => void;
  onRenamePlan: (planId: number, newName: string) => Promise<void>;
  onDeletePlan: (planId: number) => void;
  onEditPrograms: (planId: number) => void;
}

export default function PlanSwitcher({
  plans,
  activePlanId,
  onSwitchPlan,
  onCreatePlan,
  onRenamePlan,
  onDeletePlan,
  onEditPrograms,
}: PlanSwitcherProps) {
  const activePlan = plans.find((p) => p.id === activePlanId);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  function startRename(plan: PlanWithMeta) {
    setRenamingId(plan.id);
    setRenameValue(plan.name);
  }

  async function confirmRename() {
    if (renamingId && renameValue.trim()) {
      await onRenamePlan(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  return (
    <PopoverRoot
      open={popoverOpen}
      onOpenChange={(e) => setPopoverOpen(e.open)}
      positioning={{ placement: "bottom-start" }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          px="2"
          py="1"
          h="auto"
          borderRadius="lg"
          _hover={{ bg: "bg.subtle" }}
          transition="all 0.15s"
        >
          <VStack align="start" gap="0">
            <Text fontSize="xs" color="fg.muted" fontWeight="500">
              Active Plan
            </Text>
            <HStack gap="1.5">
              <Heading
                size="lg"
                fontFamily="'DM Serif Display', serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                {activePlan?.name ?? "No Plan"}
              </Heading>
              <Icon color="fg.muted" boxSize="4">
                <LuChevronDown />
              </Icon>
            </HStack>
          </VStack>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        w="380px"
        borderRadius="xl"
        boxShadow="lg"
        overflow="hidden"
      >
        <PopoverBody p="0">
          <Box px="4" pt="3" pb="2">
            <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="0.05em">
              Your Plans
            </Text>
          </Box>

          <VStack align="stretch" gap="0" maxH="320px" overflowY="auto" px="2" pb="2">
            {plans.map((plan) => {
              const isActive = plan.id === activePlanId;
              const isRenaming = plan.id === renamingId;

              return (
                <Flex
                  key={plan.id}
                  align="center"
                  gap="3"
                  px="3"
                  py="2.5"
                  borderRadius="lg"
                  cursor="pointer"
                  bg={isActive ? "green.subtle" : "transparent"}
                  borderLeftWidth="3px"
                  borderLeftColor={isActive ? "green.solid" : "transparent"}
                  _hover={{ bg: isActive ? "green.subtle" : "bg.subtle" }}
                  transition="all 0.15s"
                  onClick={() => {
                    if (!isRenaming) {
                      onSwitchPlan(plan.id);
                      setPopoverOpen(false);
                    }
                  }}
                >
                  <Box flex="1" minW="0">
                    {isRenaming ? (
                      <HStack gap="1">
                        <Input
                          size="xs"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          autoFocus
                          borderRadius="md"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <IconButton
                          aria-label="Confirm"
                          size="2xs"
                          variant="ghost"
                          colorPalette="green"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmRename();
                          }}
                        >
                          <LuCheck />
                        </IconButton>
                        <IconButton
                          aria-label="Cancel"
                          size="2xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRename();
                          }}
                        >
                          <LuX />
                        </IconButton>
                      </HStack>
                    ) : (
                      <>
                        <Text
                          fontSize="sm"
                          fontWeight={isActive ? "600" : "500"}
                          color={isActive ? "green.fg" : "fg"}
                          truncate
                        >
                          {plan.name}
                        </Text>
                        <HStack gap="1.5" mt="0.5">
                          <Text fontSize="xs" color="fg.muted">
                            {plan.course_count} courses
                          </Text>
                          <Text fontSize="xs" color="fg.subtle">
                            ·
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {plan.total_credits} credits
                          </Text>
                          {plan.term_count > 0 && (
                            <>
                              <Text fontSize="xs" color="fg.subtle">
                                ·
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {plan.term_count} semesters
                              </Text>
                            </>
                          )}
                        </HStack>
                      </>
                    )}
                  </Box>

                  {!isRenaming && (
                    <MenuRoot
                      positioning={{ placement: "bottom-end" }}
                    >
                      <MenuTrigger asChild>
                        <IconButton
                          aria-label="Plan options"
                          size="2xs"
                          variant="ghost"
                          color="fg.muted"
                          _hover={{ color: "fg" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LuEllipsis />
                        </IconButton>
                      </MenuTrigger>
                      <MenuContent minW="160px" borderRadius="lg">
                        <MenuItem
                          value="rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(plan);
                          }}
                        >
                          <LuPencil />
                          Rename
                        </MenuItem>
                        <MenuItem
                          value="edit-programs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPrograms(plan.id);
                          }}
                        >
                          <LuBookOpen />
                          Edit Programs
                        </MenuItem>
                        {plans.length > 1 && (
                          <MenuItem
                            value="delete"
                            color="fg.error"
                            _hover={{ bg: "red.subtle" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePlan(plan.id);
                              setPopoverOpen(false);
                            }}
                          >
                            <LuTrash2 />
                            Delete
                          </MenuItem>
                        )}
                      </MenuContent>
                    </MenuRoot>
                  )}
                </Flex>
              );
            })}
          </VStack>

          <Separator />

          <Box p="2">
            <Button
              variant="ghost"
              size="sm"
              w="full"
              borderRadius="lg"
              justifyContent="start"
              color="green.fg"
              _hover={{ bg: "green.subtle" }}
              onClick={() => {
                onCreatePlan();
                setPopoverOpen(false);
              }}
            >
              <LuPlus size={16} />
              Create New Plan
            </Button>
          </Box>
        </PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  );
}
