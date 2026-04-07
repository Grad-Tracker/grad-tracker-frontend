"use client";

import {
  Box,
  Card,
  Flex,
  Grid,
  HStack,
  SimpleGrid,
  Stack,
} from "@chakra-ui/react";
import { Skeleton, SkeletonCircle, SkeletonText } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonProgressBar, SkeletonRow } from "@/components/shared/SkeletonParts";

/** Full-page skeleton shown while the student profile is loading. */
export default function DashboardSkeleton() {
  return (
    <Stack gap="6" data-testid="dashboard-skeleton">
      {/* Page title */}
      <Box>
        <Skeleton height="4" width="80px" mb="2" />
        <Skeleton height="8" width="200px" />
      </Box>

      {/* Stats Grid */}
      <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="6">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </SimpleGrid>
        <StatCardSkeleton />
      </Grid>

      {/* Main Grid */}
      <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="6">
        <Stack gap="6">
          {/* Degree Requirements card */}
          <SkeletonCard>
            <Card.Header p="5" pb="0">
              <Flex justify="space-between" align="center">
                <Skeleton height="6" width="180px" />
                <Skeleton height="8" width="80px" borderRadius="md" />
              </Flex>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="5">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonProgressBar key={i} />
                ))}
              </Stack>
            </Card.Body>
          </SkeletonCard>

          {/* Current Semester card */}
          <SkeletonCard>
            <Card.Header p="5" pb="0">
              <Flex justify="space-between" align="center">
                <Skeleton height="6" width="160px" />
                <Skeleton height="8" width="120px" borderRadius="md" />
              </Flex>
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="3">
                {[1, 2, 3].map((i) => (
                  <HStack
                    key={i}
                    p="3"
                    bg="bg.subtle"
                    borderRadius="lg"
                    justify="space-between"
                  >
                    <SkeletonRow
                      iconSize="10"
                      primaryWidth="80px"
                      secondaryWidth="140px"
                    />
                    <Skeleton height="6" width="60px" borderRadius="full" />
                  </HStack>
                ))}
              </Stack>
            </Card.Body>
          </SkeletonCard>
        </Stack>

        {/* Right column */}
        <Stack gap="6">
          {/* Profile card */}
          <SkeletonCard>
            <Card.Body p="5">
              <HStack gap="4" mb="4">
                <SkeletonCircle size="12" />
                <Box>
                  <Skeleton height="5" width="120px" mb="1" />
                  <Skeleton height="3" width="160px" />
                </Box>
              </HStack>
              <SkeletonText noOfLines={3} gap="3" />
            </Card.Body>
          </SkeletonCard>

          {/* Recent Activity card */}
          <SkeletonCard>
            <Card.Header p="5" pb="0">
              <Skeleton height="6" width="140px" />
            </Card.Header>
            <Card.Body p="5">
              <Stack gap="4">
                {[1, 2, 3].map((i) => (
                  <SkeletonRow
                    key={i}
                    primaryWidth="full"
                    secondaryWidth="70px"
                  />
                ))}
              </Stack>
            </Card.Body>
          </SkeletonCard>
        </Stack>
      </Grid>
    </Stack>
  );
}

function StatCardSkeleton() {
  return (
    <SkeletonCard>
      <Card.Body p="5">
        <HStack justify="space-between" align="start" mb="4">
          <Box>
            <Skeleton height="4" width="100px" mb="2" />
            <Skeleton height="8" width="60px" />
          </Box>
          <Skeleton height="10" width="10" borderRadius="lg" />
        </HStack>
        <Skeleton height="3" width="130px" />
      </Card.Body>
    </SkeletonCard>
  );
}
