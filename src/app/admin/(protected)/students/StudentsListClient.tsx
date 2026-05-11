"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Box,
  Card,
  HStack,
  Heading,
  Input,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { AdvisorStudentRow } from "@/lib/supabase/queries/advisor-students";
import { getProgramColor } from "@/lib/program-colors";

function progressColor(pct: number): string {
  if (pct >= 75) return "green";
  if (pct >= 40) return "yellow";
  return "red";
}

function formatGrad(semester: string | null, year: number | null): string {
  if (!semester && !year) return "—";
  return `${semester ?? ""} ${year ?? ""}`.trim();
}

export default function StudentsListClient({
  students,
}: {
  students: AdvisorStudentRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      return name.includes(q) || s.email.toLowerCase().includes(q);
    });
  }, [students, query]);

  return (
    <Stack gap="6">
      <HStack justify="space-between" align="center" wrap="wrap" gap="3">
        <HStack gap="2">
          <Heading
            size="lg"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="700"
            letterSpacing="-0.02em"
          >
            Students
          </Heading>
          <Badge colorPalette="gray" variant="subtle">{students.length}</Badge>
        </HStack>
        <Input
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxW="sm"
        />
      </HStack>

      {filtered.length === 0 ? (
        <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
          <Card.Body py="16" textAlign="center">
            <Text color="fg.muted">
              {students.length === 0
                ? "No students enrolled in your programs yet."
                : "No students match your search."}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/admin/students/${s.id}`}
              style={{ textDecoration: "none" }}
            >
              <Card.Root
                borderWidth="1px"
                borderColor="border.subtle"
                cursor="pointer"
                transition="all 0.15s"
                _hover={{ borderColor: "border", transform: "translateY(-2px)", boxShadow: "md" }}
                h="full"
              >
                <Card.Body p="5">
                  <VStack align="stretch" gap="3" h="full">
                    <Box>
                      <Text fontWeight="600">{s.firstName} {s.lastName}</Text>
                      <Text fontSize="xs" color="fg.muted">{s.email}</Text>
                    </Box>
                    <HStack gap="2" wrap="wrap">
                      {s.primaryProgramName && (
                        <Badge
                          colorPalette={getProgramColor(s.primaryProgramType ?? "")}
                          variant="surface"
                          size="sm"
                        >
                          {s.primaryProgramName}
                        </Badge>
                      )}
                      <Badge variant="outline" size="sm" color="fg.muted">
                        {formatGrad(s.expectedGradSemester, s.expectedGradYear)}
                      </Badge>
                    </HStack>
                    <Stack gap="2" pt="1">
                      <Box>
                        <HStack justify="space-between" mb="1">
                          <Text fontSize="xs" color="fg.muted">Major</Text>
                          <Text fontSize="xs" fontWeight="500">{s.majorProgressPct}%</Text>
                        </HStack>
                        <Progress.Root value={s.majorProgressPct} size="xs" colorPalette={progressColor(s.majorProgressPct)}>
                          <Progress.Track>
                            <Progress.Range />
                          </Progress.Track>
                        </Progress.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb="1">
                          <Text fontSize="xs" color="fg.muted">Gen-Ed</Text>
                          <Text fontSize="xs" fontWeight="500">{s.genEdProgressPct}%</Text>
                        </HStack>
                        <Progress.Root value={s.genEdProgressPct} size="xs" colorPalette={progressColor(s.genEdProgressPct)}>
                          <Progress.Track>
                            <Progress.Range />
                          </Progress.Track>
                        </Progress.Root>
                      </Box>
                    </Stack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
