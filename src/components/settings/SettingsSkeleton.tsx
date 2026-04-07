"use client";

import { Box, Card, Flex, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/shared/SkeletonParts";

/** Skeleton for the settings page initial load. */
export function SettingsSkeleton() {
  return (
    <Stack gap="6" data-testid="settings-skeleton">
      {/* Page title */}
      <Box>
        <Skeleton height="4" width="60px" mb="2" />
        <Skeleton height="8" width="180px" />
      </Box>

      {/* Tab bar */}
      <HStack gap="0" borderBottomWidth="1px" borderColor="border.subtle" pb="0">
        <Skeleton height="9" width="80px" borderRadius="md" mr="2" />
        <Skeleton height="9" width="110px" borderRadius="md" />
      </HStack>

      <Stack gap="6" pt="2">
        {/* Profile card */}
        <SkeletonCard>
          <Card.Header p="5" pb="3">
            <Skeleton height="5" width="60px" mb="2" />
            <Skeleton height="4" width="180px" />
          </Card.Header>
          <Card.Body p="5" pt="2">
            <Stack gap="4">
              <Flex gap="4" direction={{ base: "column", sm: "row" }}>
                <Box flex="1">
                  <Skeleton height="4" width="80px" mb="2" />
                  <Skeleton height="10" width="full" borderRadius="lg" />
                </Box>
                <Box flex="1">
                  <Skeleton height="4" width="80px" mb="2" />
                  <Skeleton height="10" width="full" borderRadius="lg" />
                </Box>
              </Flex>
              <Skeleton height="9" width="100px" borderRadius="lg" />
            </Stack>
          </Card.Body>
        </SkeletonCard>

        {/* Email card */}
        <SkeletonCard>
          <Card.Header p="5" pb="3">
            <Skeleton height="5" width="120px" mb="2" />
            <Skeleton height="4" width="240px" />
          </Card.Header>
          <Card.Body p="5" pt="2">
            <Stack gap="4">
              <Box>
                <Skeleton height="4" width="100px" mb="2" />
                <Skeleton height="10" width="full" borderRadius="lg" />
              </Box>
              <Skeleton height="9" width="110px" borderRadius="lg" />
            </Stack>
          </Card.Body>
        </SkeletonCard>

        {/* Graduation card */}
        <SkeletonCard>
          <Card.Header p="5" pb="3">
            <Skeleton height="5" width="150px" mb="2" />
            <Skeleton height="4" width="200px" />
          </Card.Header>
          <Card.Body p="5" pt="2">
            <Stack gap="4">
              <Flex gap="4" direction={{ base: "column", sm: "row" }}>
                <Box flex="1">
                  <Skeleton height="4" width="70px" mb="2" />
                  <Skeleton height="10" width="full" borderRadius="lg" />
                </Box>
                <Box flex="1">
                  <Skeleton height="4" width="40px" mb="2" />
                  <Skeleton height="10" width="full" borderRadius="lg" />
                </Box>
              </Flex>
              <Skeleton height="9" width="130px" borderRadius="lg" />
            </Stack>
          </Card.Body>
        </SkeletonCard>
      </Stack>
    </Stack>
  );
}

/** Skeleton for the class history tab. */
export function ClassHistorySkeleton() {
  return (
    <Stack gap="6">
      {/* Section heading */}
      <Box>
        <Skeleton height="6" width="160px" mb="3" />
        <Stack gap="2">
          {[1, 2, 3, 4, 5].map((i) => (
            <HStack
              key={i}
              p="3"
              bg="bg.subtle"
              borderRadius="lg"
              justify="space-between"
            >
              <HStack gap="3">
                <Skeleton height="5" width="5" borderRadius="sm" />
                <Skeleton height="4" width="60px" />
                <Skeleton height="4" width="160px" />
              </HStack>
              <Skeleton height="4" width="40px" />
            </HStack>
          ))}
        </Stack>
      </Box>

      <Box>
        <Skeleton height="6" width="200px" mb="3" />
        <Stack gap="2">
          {[1, 2, 3].map((i) => (
            <HStack
              key={i}
              p="3"
              bg="bg.subtle"
              borderRadius="lg"
              justify="space-between"
            >
              <HStack gap="3">
                <Skeleton height="5" width="5" borderRadius="sm" />
                <Skeleton height="4" width="60px" />
                <Skeleton height="4" width="140px" />
              </HStack>
              <Skeleton height="4" width="40px" />
            </HStack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
