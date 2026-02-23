"use client";

import { Box, Card, Heading, Text, VStack } from "@chakra-ui/react";
import GenEdRequirements from "@/components/requirements/GenEdRequirements";

function ComingSoonBlock({ title }: { title: string }) {
  return (
    <Card.Root borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
      <Card.Body>
        <VStack align="stretch" gap="2">
          <Heading size="md">{title}</Heading>
          <Text color="fg.muted" fontSize="sm">
            Waiting on requirement block mappings to be seeded.
          </Text>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

export default function RequirementsDashboard({
  studentId,
}: {
  studentId: number;
}) {
  return (
    <Box px={{ base: "4", md: "8" }} py="6">
      <VStack align="stretch" gap="5">
        <Box>
          <Text fontSize="sm" color="fg.muted" fontWeight="500">
            Requirements
          </Text>
          <Heading size="lg">Degree Requirements</Heading>
        </Box>

        {/* Gen Ed block */}
        <GenEdRequirements studentId={studentId} />

        {/* Other blocks */}
        <ComingSoonBlock title="Major Core" />
        <ComingSoonBlock title="Major Electives" />
        <ComingSoonBlock title="Free Electives" />
      </VStack>
    </Box>
  );
}