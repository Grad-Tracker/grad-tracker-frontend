import { Box, Card, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return (
    <Stack gap="6">
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Skeleton height="8" width="140px" mb="1" />
          <Skeleton height="4" width="220px" />
        </Box>
        <Skeleton height="9" width="120px" borderRadius="lg" />
      </HStack>

      {/* Search + filters */}
      <HStack gap="3">
        <Skeleton height="9" flex="1" borderRadius="lg" />
        <Skeleton height="9" width="140px" borderRadius="lg" />
      </HStack>

      {/* Table skeleton */}
      <Card.Root borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Box>
          {/* Table header */}
          <HStack px="4" py="3" borderBottomWidth="1px" borderColor="border.subtle" bg="bg.subtle">
            <Skeleton height="4" width="80px" />
            <Skeleton height="4" width="60px" />
            <Skeleton height="4" width="200px" flex="1" />
            <Skeleton height="4" width="50px" />
            <Skeleton height="4" width="60px" />
          </HStack>

          {/* Table rows */}
          {Array.from({ length: 8 }, (_, i) => (
            <HStack
              key={i}
              px="4"
              py="3"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              gap="3"
            >
              <Skeleton height="4" width="70px" />
              <Skeleton height="4" width="50px" />
              <Skeleton height="4" width={`${140 + (i % 3) * 40}px`} flex="1" />
              <Skeleton height="4" width="30px" />
              <Skeleton height="7" width="60px" borderRadius="md" />
            </HStack>
          ))}
        </Box>
      </Card.Root>

      {/* Pagination */}
      <HStack justify="space-between">
        <Skeleton height="4" width="140px" />
        <HStack gap="1">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height="8" width="8" borderRadius="md" />
          ))}
        </HStack>
      </HStack>
    </Stack>
  );
}
