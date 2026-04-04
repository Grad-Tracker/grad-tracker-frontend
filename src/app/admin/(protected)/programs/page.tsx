import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";

import { createClient } from "@/lib/supabase/server";
import AdminProgramsClient from "./AdminProgramsClient";
import {
  fetchAssignedPrograms,
  requireAdvisorAccess,
} from "./server-helpers";

export default async function AdminProgramsPage() {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  const programs = await fetchAssignedPrograms(supabase, staffId);

  return (
    <Box minH="100vh" className="mesh-gradient-subtle">
      <Container maxW="7xl" py={{ base: "8", md: "12" }}>
        <VStack align="stretch" gap="8">
          <Box>
            <Text fontSize="sm" color="fg.muted" fontWeight="500">
              Advisor Console
            </Text>
            <Heading
              size="xl"
              fontFamily="var(--font-outfit), sans-serif"
              fontWeight="400"
              letterSpacing="-0.02em"
            >
              Assigned Programs
            </Heading>
            <Text color="fg.muted" mt="2">
              Review and manage degree requirement blocks for your assigned programs.
            </Text>
          </Box>
          <AdminProgramsClient programs={programs} />
        </VStack>
      </Container>
    </Box>
  );
}
