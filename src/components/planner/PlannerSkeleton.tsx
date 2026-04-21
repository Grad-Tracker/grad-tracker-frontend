"use client";

import { Box, Card, Flex, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page skeleton shown during initial planner load (auth + student check).
 * Wraps PlannerSkeleton in the same outer Box the planner page uses.
 */
export function PlannerPageSkeleton() {
  return (
    <Box
      mx={{ base: "-4", md: "-8" }}
      mt="-6"
      display="flex"
      flexDirection="column"
      h="calc(100vh - 80px)"
      overflow="hidden"
      data-testid="planner-page-skeleton"
    >
      {/* Header skeleton */}
      <Box
        borderBottomWidth="1px"
        borderColor="border.subtle"
        px={{ base: "4", md: "6" }}
        py="3"
      >
        <Flex justify="space-between" align="center">
          <HStack gap="2">
            <Skeleton height="8" width="8" borderRadius="lg" />
            <Skeleton height="5" width="180px" />
          </HStack>
          <HStack gap="2">
            <Skeleton height="8" width="120px" borderRadius="lg" />
            <Skeleton height="8" width="32px" borderRadius="lg" />
            <Skeleton height="8" width="32px" borderRadius="lg" />
          </HStack>
        </Flex>
      </Box>

      <PlannerSkeleton />
    </Box>
  );
}

/** Skeleton shown while plan data (terms, courses, blocks) is loading. */
export default function PlannerSkeleton() {
  return (
    <Flex flex="1" overflow="hidden" minH="0" data-testid="planner-skeleton">
      {/* Course pool panel skeleton */}
      <Box
        w="260px"
        minW="260px"
        borderRightWidth="1px"
        borderColor="border.subtle"
        p="3"
        display={{ base: "none", lg: "flex" }}
        flexDir="column"
        gap="3"
        overflowY="auto"
      >
        <Skeleton height="8" width="full" borderRadius="lg" />
        <Stack gap="2" mt="1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <HStack
              key={i}
              p="3"
              bg="bg.subtle"
              borderRadius="lg"
              gap="3"
            >
              <Skeleton height="8" width="8" borderRadius="md" />
              <Box flex="1">
                <Skeleton height="3" width="70px" mb="1.5" />
                <Skeleton height="3" width="full" />
              </Box>
            </HStack>
          ))}
        </Stack>
      </Box>

      {/* Semester columns skeleton */}
      <Flex flex="1" overflowX="auto" gap="3" p="3" align="flex-start">
        {[1, 2, 3].map((i) => (
          <Card.Root
            key={i}
            minW="220px"
            w="220px"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg"
          >
            <Card.Header p="4" pb="2">
              <HStack justify="space-between">
                <Skeleton height="5" width="110px" />
                <Skeleton height="5" width="5" borderRadius="sm" />
              </HStack>
              <Skeleton height="3" width="70px" mt="2" />
            </Card.Header>
            <Card.Body p="3">
              <Stack gap="2">
                {[1, 2, i < 3 ? 3 : null].filter(Boolean).map((j) => (
                  <Box
                    key={j}
                    p="3"
                    bg="bg.subtle"
                    borderRadius="lg"
                  >
                    <Skeleton height="3" width="60px" mb="1.5" />
                    <Skeleton height="3" width="full" mb="1" />
                    <Skeleton height="3" width="50px" />
                  </Box>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </Flex>
    </Flex>
  );
}
