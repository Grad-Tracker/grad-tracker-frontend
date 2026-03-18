import {
  Badge,
  Box,
  Card,
  Container,
  Grid,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuBookOpen, LuGraduationCap, LuScrollText, LuTarget } from "react-icons/lu";

import { createClient } from "@/lib/supabase/server";
import {
  fetchAssignedPrograms,
  requireAdvisorAccess,
  type AdminProgramSummary,
} from "./server-helpers";

const PROGRAM_GROUPS = [
  { type: "MAJOR", label: "Majors", icon: LuTarget, color: "blue" },
  { type: "MINOR", label: "Minors", icon: LuBookOpen, color: "purple" },
  { type: "CERTIFICATE", label: "Certificates", icon: LuScrollText, color: "orange" },
  { type: "GRADUATE", label: "Graduate Programs", icon: LuGraduationCap, color: "green" },
] as const;

function ProgramCard({ program }: { program: AdminProgramSummary }) {
  return (
    <Link href={`/admin/programs/${program.id}`} style={{ display: "block" }}>
      <Card.Root
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        _hover={{ borderColor: "green.muted", transform: "translateY(-2px)", boxShadow: "lg" }}
        transition="all 0.2s"
      >
        <Card.Body p="5">
          <VStack align="stretch" gap="4">
            <HStack justify="space-between" align="start">
              <Badge colorPalette="green" variant="surface">
                {program.program_type}
              </Badge>
              <Text fontSize="sm" color="fg.muted">
                {program.catalog_year ?? "No catalog year"}
              </Text>
            </HStack>
            <Heading size="md">{program.name}</Heading>
            <HStack gap="4" color="fg.muted" fontSize="sm" wrap="wrap">
              <Text>{program.blockCount} requirement blocks</Text>
              <Text>{program.courseCount} courses</Text>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Link>
  );
}

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

          {programs.length === 0 ? (
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Body p="8">
                <Text color="fg.muted" textAlign="center">
                  No programs are currently assigned to your advisor account.
                </Text>
              </Card.Body>
            </Card.Root>
          ) : (
            <VStack align="stretch" gap="8">
              {PROGRAM_GROUPS.map((group) => {
                const items = programs.filter((program) => program.program_type === group.type);
                if (items.length === 0) return null;

                return (
                  <Box key={group.type}>
                    <HStack gap="3" mb="4">
                      <Box
                        w="10"
                        h="10"
                        borderRadius="lg"
                        bg={`${group.color}.subtle`}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Icon color={`${group.color}.fg`} boxSize="5">
                          <group.icon />
                        </Icon>
                      </Box>
                      <Box>
                        <Heading size="md">{group.label}</Heading>
                        <Text color="fg.muted" fontSize="sm">
                          {items.length} assigned
                        </Text>
                      </Box>
                    </HStack>
                    <Grid
                      templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }}
                      gap="4"
                    >
                      {items.map((program) => (
                        <ProgramCard key={program.id} program={program} />
                      ))}
                    </Grid>
                  </Box>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
