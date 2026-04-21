"use client";

import { Box, Card, Flex, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the RequirementsDashboard while degree blocks are loading. */
export function RequirementsSkeleton() {
  return (
    <Stack gap="4" data-testid="requirements-skeleton">
      {[1, 2, 3].map((i) => (
        <Card.Root
          key={i}
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Card.Body>
            <Stack gap="4">
              {/* Title + badge */}
              <Flex justify="space-between" align="start">
                <Skeleton height="6" width="180px" />
                <Skeleton height="6" width="100px" borderRadius="full" />
              </Flex>

              {/* Status badges row */}
              <HStack gap="2">
                <Skeleton height="5" width="110px" borderRadius="full" />
                <Skeleton height="5" width="90px" borderRadius="full" />
                <Skeleton height="5" width="80px" borderRadius="full" />
              </HStack>

              {/* Progress bar */}
              <Box>
                <HStack justify="space-between" mb="2">
                  <Skeleton height="4" width="60px" />
                  <Skeleton height="4" width="30px" />
                </HStack>
                <Skeleton height="2" width="full" borderRadius="full" />
              </Box>

              {/* Course rows */}
              <Stack gap="2">
                {[1, 2, i === 1 ? 3 : null].filter(Boolean).map((j) => (
                  <HStack key={j} gap="3" p="2">
                    <Skeleton height="5" width="5" borderRadius="sm" />
                    <Skeleton height="4" width="60px" />
                    <Skeleton height="4" flex="1" />
                    <Skeleton height="4" width="40px" />
                  </HStack>
                ))}
              </Stack>
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  );
}

/** Inline skeleton for Gen Ed requirements section. */
export function GenEdSkeleton() {
  return (
    <Stack gap="4" px={{ base: "4", md: "8" }} py="4" data-testid="gen-ed-skeleton">
      {[1, 2, 3].map((i) => (
        <Box key={i}>
          <HStack justify="space-between" mb="3">
            <Skeleton height="5" width="140px" />
            <Skeleton height="5" width="70px" borderRadius="full" />
          </HStack>
          <Skeleton height="2" width="full" borderRadius="full" mb="3" />
          <Stack gap="2">
            {[1, 2].map((j) => (
              <HStack key={j} gap="3" p="2">
                <Skeleton height="4" width="4" borderRadius="sm" />
                <Skeleton height="4" width="60px" />
                <Skeleton height="4" flex="1" />
              </HStack>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
