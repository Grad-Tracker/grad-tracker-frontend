import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Box,
  Card,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuArrowRight, LuBookOpen, LuGraduationCap, LuLayers } from "react-icons/lu";
import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

// ── types ────────────────────────────────────────────────────────────────────

type ProgramType = "MAJOR" | "MINOR" | "CERTIFICATE" | "GRADUATE";

interface ProgramCard {
  id: string;
  name: string;
  catalogYear: number;
  programType: ProgramType;
  blockCount: number;
  courseCount: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ProgramType, string> = {
  MAJOR:       "Major",
  MINOR:       "Minor",
  CERTIFICATE: "Certificate",
  GRADUATE:    "Graduate",
};

const TYPE_COLORS: Record<ProgramType, string> = {
  MAJOR:       "blue",
  MINOR:       "purple",
  CERTIFICATE: "orange",
  GRADUATE:    "teal",
};

const TYPE_ORDER: ProgramType[] = ["MAJOR", "MINOR", "CERTIFICATE", "GRADUATE"];

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Auth check (defense-in-depth; proxy handles the primary redirect)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Verify staff/advisor record exists
  const { data: advisor } = await supabase
    .from(DB_TABLES.staff)
    .select("id, first_name, last_name")
    .eq("auth_user_id", user.id)
    .single();

  if (!advisor) redirect("/dashboard");

  // Fetch assigned programs with nested requirement data
  const { data: assignments } = await supabase
    .from("program_advisors")
    .select(`
      programs (
        id,
        name,
        catalog_year,
        program_type,
        program_requirement_blocks (
          id,
          program_requirement_courses ( course_id )
        )
      )
    `)
    .eq("advisor_id", advisor.id);

  // Transform into flat program cards
  const programs: ProgramCard[] = (assignments ?? [])
    .map((a) => (a as { programs: unknown }).programs)
    .filter(Boolean)
    .map((p) => {
      const prog = p as {
        id: string;
        name: string;
        catalog_year: number;
        program_type: string;
        program_requirement_blocks: Array<{
          id: string;
          program_requirement_courses: Array<{ course_id: string }>;
        }>;
      };
      const blocks = prog.program_requirement_blocks ?? [];
      return {
        id: prog.id,
        name: prog.name,
        catalogYear: prog.catalog_year,
        programType: prog.program_type as ProgramType,
        blockCount: blocks.length,
        courseCount: blocks.reduce(
          (sum, b) => sum + (b.program_requirement_courses?.length ?? 0),
          0
        ),
      };
    });

  // Group by type, preserving display order
  const byType = TYPE_ORDER.reduce<Record<ProgramType, ProgramCard[]>>(
    (acc, type) => {
      acc[type] = programs.filter((p) => p.programType === type);
      return acc;
    },
    { MAJOR: [], MINOR: [], CERTIFICATE: [], GRADUATE: [] }
  );

  const advisorFirstName = advisor.first_name;
  const totalPrograms = programs.length;

  return (
    <Stack gap="8">
      {/* Welcome */}
      <Box>
        <Heading
          fontSize={{ base: "2xl", md: "3xl" }}
          fontFamily="var(--font-outfit), sans-serif"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          Welcome back, {advisorFirstName}
        </Heading>
        <Text color="fg.muted" mt="1">
          You are managing{" "}
          <Text as="span" fontWeight="600" color="fg">
            {totalPrograms} {totalPrograms === 1 ? "program" : "programs"}
          </Text>
          .
        </Text>
      </Box>

      {/* Stats row */}
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
        {TYPE_ORDER.map((type) => (
          <Card.Root key={type} borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="4">
              <Text fontSize="xs" color="fg.muted" fontWeight="500" mb="1">
                {TYPE_LABELS[type]}s
              </Text>
              <Text fontSize="2xl" fontWeight="700" fontFamily="var(--font-outfit), sans-serif">
                {byType[type].length}
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>

      {/* Program groups */}
      {totalPrograms === 0 ? (
        <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
          <Card.Body py="16" textAlign="center">
            <Icon boxSize="10" color="fg.subtle" mx="auto" mb="3">
              <LuGraduationCap />
            </Icon>
            <Text fontWeight="600" color="fg.muted">
              No programs assigned yet
            </Text>
            <Text fontSize="sm" color="fg.subtle" mt="1">
              Contact an administrator to be assigned to programs.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        TYPE_ORDER.filter((type) => byType[type].length > 0).map((type) => (
          <Stack key={type} gap="3">
            <HStack gap="2" align="center">
              <Heading
                fontSize="md"
                fontWeight="600"
                fontFamily="var(--font-outfit), sans-serif"
              >
                {TYPE_LABELS[type]}s
              </Heading>
              <Badge colorPalette={TYPE_COLORS[type]} variant="surface" size="sm">
                {byType[type].length}
              </Badge>
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
              {byType[type].map((program) => (
                <Link
                  key={program.id}
                  href={`/admin/programs/${program.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <Card.Root
                    borderWidth="1px"
                    borderColor="border.subtle"
                    cursor="pointer"
                    transition="all 0.15s"
                    _hover={{
                      borderColor: `${TYPE_COLORS[type]}.emphasized`,
                      transform: "translateY(-2px)",
                      boxShadow: "md",
                    }}
                    h="full"
                  >
                    <Card.Body p="5">
                      <VStack align="stretch" gap="3" h="full">
                        {/* Header */}
                        <HStack justify="space-between" align="flex-start">
                          <Badge
                            colorPalette={TYPE_COLORS[type]}
                            variant="surface"
                            size="sm"
                          >
                            {TYPE_LABELS[type]}
                          </Badge>
                          <Badge variant="outline" size="sm" color="fg.muted">
                            {program.catalogYear}
                          </Badge>
                        </HStack>

                        {/* Program name */}
                        <Text
                          fontWeight="600"
                          fontSize="sm"
                          lineHeight="1.4"
                          flex="1"
                        >
                          {program.name}
                        </Text>

                        {/* Stats */}
                        <HStack gap="4" pt="1" borderTopWidth="1px" borderColor="border.subtle">
                          <HStack gap="1.5" color="fg.muted">
                            <Icon boxSize="3.5">
                              <LuLayers />
                            </Icon>
                            <Text fontSize="xs">
                              {program.blockCount}{" "}
                              {program.blockCount === 1 ? "block" : "blocks"}
                            </Text>
                          </HStack>
                          <HStack gap="1.5" color="fg.muted">
                            <Icon boxSize="3.5">
                              <LuBookOpen />
                            </Icon>
                            <Text fontSize="xs">
                              {program.courseCount}{" "}
                              {program.courseCount === 1 ? "course" : "courses"}
                            </Text>
                          </HStack>
                          <Box flex="1" />
                          <Icon boxSize="3.5" color="fg.subtle">
                            <LuArrowRight />
                          </Icon>
                        </HStack>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </Link>
              ))}
            </SimpleGrid>
          </Stack>
        ))
      )}
    </Stack>
  );
}
