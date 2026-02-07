"use client";

import {
  Box,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  RadioCard,
  CheckboxGroup,
  Badge,
  Icon,
} from "@chakra-ui/react";
import { LuGraduationCap, LuAward } from "react-icons/lu";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { mockMajors } from "@/data/mock/majors";
import { mockCertificates } from "@/data/mock/certificates";

interface ProgramSelectionStepProps {
  selectedMajor: string | null;
  selectedCertificates: string[];
  onMajorChange: (majorId: string | null) => void;
  onCertificatesChange: (certificateIds: string[]) => void;
}

export default function ProgramSelectionStep({
  selectedMajor,
  selectedCertificates,
  onMajorChange,
  onCertificatesChange,
}: ProgramSelectionStepProps) {
  return (
    <VStack gap="10" align="stretch">
      {/* Major Selection */}
      <Box>
        <VStack gap="2" align="start" mb="5">
          <Badge colorPalette="green" variant="surface" rounded="full" px="3" py="1">
            <Icon mr="1.5" boxSize="3.5">
              <LuGraduationCap />
            </Icon>
            Required
          </Badge>
          <Heading
            fontFamily="'DM Serif Display', serif"
            size="xl"
            fontWeight="400"
            letterSpacing="-0.01em"
          >
            Select Your Major
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Choose the degree program you are pursuing.
          </Text>
        </VStack>

        <RadioCard.Root
          value={selectedMajor || undefined}
          onValueChange={(details) => onMajorChange(details.value)}
          colorPalette="green"
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {mockMajors.map((major) => (
              <RadioCard.Item
                key={major.id}
                value={major.id}
                borderRadius="xl"
                _checked={{
                  borderColor: "green.solid",
                  bg: "green.subtle",
                }}
              >
                <RadioCard.ItemHiddenInput />
                <RadioCard.ItemControl>
                  <RadioCard.ItemContent>
                    <RadioCard.ItemText fontWeight="600">
                      {major.name}
                    </RadioCard.ItemText>
                    <RadioCard.ItemDescription color="fg.muted" fontSize="sm">
                      {major.description}
                    </RadioCard.ItemDescription>
                    <Badge
                      mt="2"
                      colorPalette="gray"
                      variant="subtle"
                      size="sm"
                    >
                      {major.totalCredits} credits
                    </Badge>
                  </RadioCard.ItemContent>
                  <RadioCard.ItemIndicator />
                </RadioCard.ItemControl>
              </RadioCard.Item>
            ))}
          </SimpleGrid>
        </RadioCard.Root>
      </Box>

      {/* Certificates Selection */}
      <Box>
        <VStack gap="2" align="start" mb="5">
          <Badge colorPalette="blue" variant="surface" rounded="full" px="3" py="1">
            <Icon mr="1.5" boxSize="3.5">
              <LuAward />
            </Icon>
            Optional
          </Badge>
          <Heading
            fontFamily="'DM Serif Display', serif"
            size="xl"
            fontWeight="400"
            letterSpacing="-0.01em"
          >
            Add Certificates
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Select any certificate programs you want to pursue alongside your
            major.
          </Text>
        </VStack>

        <CheckboxGroup
          value={selectedCertificates}
          onValueChange={(values) => onCertificatesChange(values)}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {mockCertificates.map((cert) => (
              <CheckboxCard
                key={cert.id}
                value={cert.id}
                label={cert.name}
                description={
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      {cert.description}
                    </Text>
                    <Badge
                      mt="2"
                      colorPalette="gray"
                      variant="subtle"
                      size="sm"
                    >
                      {cert.totalCredits} credits
                    </Badge>
                  </Box>
                }
                colorPalette="green"
                borderRadius="xl"
              />
            ))}
          </SimpleGrid>
        </CheckboxGroup>
      </Box>
    </VStack>
  );
}
