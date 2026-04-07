"use client";

import { Drawer, Portal } from "@chakra-ui/react";
import {
  Box,
  Badge,
  Button,
  HStack,
  Icon,
  Text,
  VStack,
  Separator,
} from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button";
import { LuBookMarked, LuClock, LuCircleAlert } from "react-icons/lu";
import { getSubjectColor } from "@/lib/subject-colors";
import type { Course } from "@/types/course";

interface CourseDetailDrawerProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveCourse?: () => void | Promise<void>;
  isRemovingCourse?: boolean;
}

export default function CourseDetailDrawer({
  course,
  open,
  onOpenChange,
  onRemoveCourse,
  isRemovingCourse = false,
}: CourseDetailDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      size="md"
      placement="end"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            {course && (
              <>
                <Drawer.Header
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                >
                  <VStack align="start" gap="3" flex="1">
                    <HStack gap="3">
                      <Box
                        w="12"
                        h="12"
                        bg={`${getSubjectColor(course.subject)}.subtle`}
                        borderRadius="xl"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Icon
                          color={`${getSubjectColor(course.subject)}.fg`}
                          boxSize="6"
                        >
                          <LuBookMarked />
                        </Icon>
                      </Box>
                      <VStack align="start" gap="0">
                        <Drawer.Title
                          fontFamily="var(--font-dm-sans), sans-serif"
                          fontWeight="400"
                          fontSize="xl"
                        >
                          {course.subject} {course.number}
                        </Drawer.Title>
                        <Badge
                          colorPalette={getSubjectColor(course.subject)}
                          variant="surface"
                          size="sm"
                        >
                          {course.subject}
                        </Badge>
                      </VStack>
                    </HStack>
                  </VStack>
                  <Drawer.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Drawer.CloseTrigger>
                </Drawer.Header>

                <Drawer.Body py="6">
                  <VStack align="stretch" gap="6">
                    {/* Course Title */}
                    <Box>
                      <Text
                        fontSize="sm"
                        fontWeight="600"
                        color="fg.muted"
                        mb="2"
                      >
                        Course Title
                      </Text>
                      <Text fontSize="lg" fontWeight="500">
                        {course.title}
                      </Text>
                    </Box>

                    <Separator />

                    {/* Credits */}
                    <HStack gap="8">
                      <Box>
                        <HStack gap="2" mb="1">
                          <Icon color="fg.muted" boxSize="4">
                            <LuClock />
                          </Icon>
                          <Text
                            fontSize="sm"
                            fontWeight="600"
                            color="fg.muted"
                          >
                            Credits
                          </Text>
                        </HStack>
                        <Text fontSize="2xl" fontWeight="700" color="blue.fg">
                          {course.credits}
                        </Text>
                      </Box>
                    </HStack>

                    <Separator />

                    {/* Description */}
                    <Box>
                      <Text
                        fontSize="sm"
                        fontWeight="600"
                        color="fg.muted"
                        mb="2"
                      >
                        Description
                      </Text>
                      {course.description ? (
                        <Text color="fg" lineHeight="tall">
                          {course.description}
                        </Text>
                      ) : (
                        <Text color="fg.muted" fontStyle="italic">
                          No description available.
                        </Text>
                      )}
                    </Box>

                    {/* Prerequisites */}
                    {course.prereq_text && (
                      <>
                        <Separator />
                        <Box>
                          <HStack gap="2" mb="2">
                            <Icon color="orange.fg" boxSize="4">
                              <LuCircleAlert />
                            </Icon>
                            <Text
                              fontSize="sm"
                              fontWeight="600"
                              color="fg.muted"
                            >
                              Prerequisites
                            </Text>
                          </HStack>
                          <Box
                            bg="orange.subtle"
                            borderRadius="lg"
                            p="4"
                            borderWidth="1px"
                            borderColor="orange.muted"
                          >
                            <Text color="orange.fg" fontSize="sm">
                              {course.prereq_text}
                            </Text>
                          </Box>
                        </Box>
                      </>
                    )}
                  </VStack>
                </Drawer.Body>

                <Drawer.Footer
                  borderTopWidth="1px"
                  borderColor="border.subtle"
                >
                  <HStack gap="2" w="full" justify="flex-end" flexWrap="wrap">
                    {onRemoveCourse && (
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="outline"
                        onClick={() => void onRemoveCourse()}
                        loading={isRemovingCourse}
                      >
                        Remove Course
                      </Button>
                    )}
                    <Drawer.ActionTrigger asChild>
                      <Box
                        as="button"
                        px="4"
                        py="2"
                        borderRadius="lg"
                        fontWeight="500"
                        fontSize="sm"
                        bg="bg.subtle"
                        _hover={{ bg: "bg.emphasized" }}
                        transition="all 0.15s"
                      >
                        Close
                      </Box>
                    </Drawer.ActionTrigger>
                  </HStack>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
