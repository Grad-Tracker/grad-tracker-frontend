import { Box, Card, HStack, SimpleGrid, Stack, VStack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardLoading() {
  return (
    <Stack gap="8">
      {/* Welcome header */}
      <Box>
        <Skeleton height="8" width="280px" mb="2" />
        <Skeleton height="5" width="200px" />
      </Box>

      {/* Stats row */}
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card.Root key={i} borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="4">
              <Skeleton height="3" width="60px" mb="2" />
              <Skeleton height="8" width="40px" />
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>

      {/* Program group sections */}
      {Array.from({ length: 2 }, (_, g) => (
        <Stack key={g} gap="3">
          <HStack gap="2">
            <Skeleton height="5" width="100px" />
            <Skeleton height="5" width="24px" borderRadius="full" />
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {Array.from({ length: 3 }, (_, i) => (
              <Card.Root key={i} borderWidth="1px" borderColor="border.subtle">
                <Card.Body p="5">
                  <VStack align="stretch" gap="3">
                    <HStack justify="space-between">
                      <Skeleton height="5" width="60px" borderRadius="full" />
                      <Skeleton height="5" width="40px" />
                    </HStack>
                    <Skeleton height="5" width="180px" />
                    <HStack gap="4" pt="1" borderTopWidth="1px" borderColor="border.subtle">
                      <Skeleton height="4" width="70px" />
                      <Skeleton height="4" width="80px" />
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  );
}
