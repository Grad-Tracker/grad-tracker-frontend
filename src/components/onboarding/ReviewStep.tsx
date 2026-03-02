"use client";

import {
  Box,
  Card,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  Icon,
  SimpleGrid,
  Separator,
} from "@chakra-ui/react";
import {
  LuPencil,
  LuGraduationCap,
  LuAward,
  LuBookOpen,
  LuCircleCheck,
  LuCalendar,
} from "react-icons/lu";
import type { Program, CourseRow } from "@/types/onboarding";

interface ReviewStepProps {
  major: Program | null;
  certificates: Program[];
  classes: CourseRow[];
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  onEditStep: (stepIndex: number) => void;
}

export default function ReviewStep({
  major,
  certificates,
  classes,
  expectedGradSemester,
  expectedGradYear,
  onEditStep,
}: ReviewStepProps) {
  const totalClassCredits = classes.reduce((sum, c) => sum + c.credits, 0);

  return (
    <VStack gap="6" align="stretch">
      {/* Header */}
      <Box textAlign="center" mb="2">
        <Icon color="green.fg" boxSize="12" mb="3">
          <LuCircleCheck />
        </Icon>
        <Heading
          fontFamily="var(--font-outfit), sans-serif"
          size="xl"
          fontWeight="400"
          letterSpacing="-0.01em"
        >
          Review Your Selections
        </Heading>
        <Text color="fg.muted" fontSize="sm" mt="2">
          Make sure everything looks correct before completing setup.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        {/* Major Card */}
        <Card.Root
          bg="bg"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Card.Body p="5">
            <HStack justify="space-between" mb="4">
              <HStack gap="2">
                <Icon color="green.fg" boxSize="5">
                  <LuGraduationCap />
                </Icon>
                <Text fontWeight="600" fontSize="sm" color="fg.muted">
                  MAJOR
                </Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                colorPalette="green"
                onClick={() => onEditStep(0)}
              >
                <LuPencil />
                Edit
              </Button>
            </HStack>
            {major ? (
              <Box>
                <Text
                  fontFamily="var(--font-outfit), sans-serif"
                  fontSize="xl"
                  fontWeight="400"
                >
                  {major.name}
                </Text>
                <Text color="fg.muted" fontSize="sm" mt="1">
                  {major.catalog_year}
                </Text>
              </Box>
            ) : (
              <Text color="fg.muted" fontStyle="italic">
                No major selected
              </Text>
            )}
          </Card.Body>
        </Card.Root>

        {/* Certificates Card */}
        <Card.Root
          bg="bg"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Card.Body p="5">
            <HStack justify="space-between" mb="4">
              <HStack gap="2">
                <Icon color="blue.fg" boxSize="5">
                  <LuAward />
                </Icon>
                <Text fontWeight="600" fontSize="sm" color="fg.muted">
                  CERTIFICATES
                </Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                colorPalette="green"
                onClick={() => onEditStep(0)}
              >
                <LuPencil />
                Edit
              </Button>
            </HStack>
            {certificates.length > 0 ? (
              <VStack gap="2" align="stretch">
                {certificates.map((cert) => (
                  <Box
                    key={cert.id}
                    bg="bg.subtle"
                    borderRadius="lg"
                    px="3"
                    py="2"
                  >
                    <Text fontWeight="500" fontSize="sm">
                      {cert.name}
                    </Text>
                    <Text color="fg.muted" fontSize="xs">
                      {cert.catalog_year}
                    </Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text color="fg.muted" fontStyle="italic" fontSize="sm">
                No certificates selected
              </Text>
            )}
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* Classes Card */}
      <Card.Root
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <Card.Body p="5">
          <HStack justify="space-between" mb="4">
            <HStack gap="2">
              <Icon color="purple.fg" boxSize="5">
                <LuBookOpen />
              </Icon>
              <Text fontWeight="600" fontSize="sm" color="fg.muted">
                COMPLETED CLASSES
              </Text>
              {classes.length > 0 && (
                <Badge colorPalette="purple" variant="subtle" size="sm">
                  {classes.length} course{classes.length !== 1 ? "s" : ""} •{" "}
                  {totalClassCredits} credits
                </Badge>
              )}
            </HStack>
            <Button
              size="xs"
              variant="ghost"
              colorPalette="green"
              onClick={() => onEditStep(1)}
            >
              <LuPencil />
              Edit
            </Button>
          </HStack>
          {classes.length > 0 ? (
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="2">
              {classes.map((course) => (
                <Box
                  key={course.id}
                  bg="bg.subtle"
                  borderRadius="lg"
                  px="3"
                  py="2"
                >
                  <Text fontWeight="600" fontSize="sm">
                    {course.subject} {course.number}
                  </Text>
                  <Text color="fg.muted" fontSize="xs" lineClamp={1}>
                    {course.title}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Text color="fg.muted" fontStyle="italic" fontSize="sm">
              No classes selected
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      {/* Graduation */}
      <Card.Root
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <Card.Body p="5">
          <HStack justify="space-between" mb="4">
            <HStack gap="2">
              <Icon color="purple.fg" boxSize="5">
                <LuCalendar />
              </Icon>
              <Text fontWeight="600" fontSize="sm" color="fg.muted">
                EXPECTED GRADUATION
              </Text>
            </HStack>
            <Button
              size="xs"
              variant="ghost"
              colorPalette="green"
              onClick={() => onEditStep(0)}
            >
              <LuPencil />
              Edit
            </Button>
          </HStack>
          {expectedGradSemester && expectedGradYear ? (
            <Text
              fontFamily="var(--font-outfit), sans-serif"
              fontSize="xl"
              fontWeight="400"
            >
              {expectedGradSemester} {expectedGradYear}
            </Text>
          ) : (
            <Text color="fg.muted" fontStyle="italic" fontSize="sm">
              Not specified
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      {/* Summary */}
      <Card.Root
        bg="green.subtle"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="green.muted"
      >
        <Card.Body p="5">
          <HStack justify="center" gap="8" flexWrap="wrap">
            <VStack gap="0">
              <Text
                fontFamily="var(--font-outfit), sans-serif"
                fontSize="2xl"
                fontWeight="400"
                color="green.fg"
              >
                {certificates.length + (major ? 1 : 0)}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Programs Selected
              </Text>
            </VStack>
            <Separator orientation="vertical" h="10" />
            <VStack gap="0">
              <Text
                fontFamily="var(--font-outfit), sans-serif"
                fontSize="2xl"
                fontWeight="400"
                color="green.fg"
              >
                {classes.length}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Courses Completed
              </Text>
            </VStack>
            <Separator orientation="vertical" h="10" />
            <VStack gap="0">
              <Text
                fontFamily="var(--font-outfit), sans-serif"
                fontSize="2xl"
                fontWeight="400"
                color="green.fg"
              >
                {totalClassCredits}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Completed Credits
              </Text>
            </VStack>
          </HStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}
