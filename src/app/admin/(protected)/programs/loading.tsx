import { Box, Card, Grid, HStack, Stack, VStack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProgramsLoading() {
  return (
    <Stack gap="6">
      {/* Header */}
      <Box>
        <Skeleton height="8" width="160px" mb="1" />
        <Skeleton height="4" width="260px" />
      </Box>

      {/* Search + filter */}
      <HStack gap="3">
        <Skeleton height="9" flex="1" borderRadius="lg" />
        <Skeleton height="9" width="160px" borderRadius="lg" />
      </HStack>

      {/* Program cards grid */}
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }} gap="4">
        {Array.from({ length: 6 }, (_, i) => (
          <Card.Root key={i} borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="5">
              <VStack align="stretch" gap="4">
                <HStack justify="space-between">
                  <Skeleton height="5" width="60px" borderRadius="full" />
                  <Skeleton height="4" width="40px" />
                </HStack>
                <Skeleton height="5" width={`${120 + (i % 3) * 30}px`} />
                <HStack gap="4" pt="2" borderTopWidth="1px" borderColor="border.subtle">
                  <Skeleton height="4" width="70px" />
                  <Skeleton height="4" width="80px" />
                  <Box flex="1" />
                  <Skeleton height="4" width="16px" />
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        ))}
      </Grid>
    </Stack>
  );
}
