import { Box, Card, HStack, Stack, VStack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function GenEdLoading() {
  return (
    <Stack gap="6">
      {/* Header */}
      <HStack justify="space-between">
        <Box>
          <Skeleton height="8" width="200px" mb="1" />
          <Skeleton height="4" width="280px" />
        </Box>
        <Skeleton height="9" width="130px" borderRadius="lg" />
      </HStack>

      {/* Search + sort */}
      <HStack gap="3">
        <Skeleton height="9" flex="1" borderRadius="lg" />
        <Skeleton height="9" width="150px" borderRadius="lg" />
      </HStack>

      {/* Bucket cards */}
      <VStack gap="3" align="stretch">
        {Array.from({ length: 5 }, (_, i) => (
          <Card.Root key={i} borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="4">
              <HStack justify="space-between" mb="3">
                <HStack gap="3">
                  <Skeleton height="8" width="8" borderRadius="lg" />
                  <VStack align="start" gap="1">
                    <Skeleton height="5" width={`${120 + (i % 3) * 30}px`} />
                    <Skeleton height="3" width="80px" />
                  </VStack>
                </HStack>
                <HStack gap="2">
                  <Skeleton height="5" width="70px" borderRadius="full" />
                  <Skeleton height="5" width="20px" />
                </HStack>
              </HStack>
            </Card.Body>
          </Card.Root>
        ))}
      </VStack>
    </Stack>
  );
}
