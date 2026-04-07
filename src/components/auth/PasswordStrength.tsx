import { Box, HStack, Text, VStack } from "@chakra-ui/react";

const PASSWORD_CHECKS = [
  { label: "6+ characters", test: (p: string) => p.length >= 6 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string) {
  const results = PASSWORD_CHECKS.map((c) => ({
    label: c.label,
    met: c.test(password),
  }));
  const score = results.filter((r) => r.met).length;
  const level =
    score <= 2 ? "Weak" : score <= 3 ? "Fair" : score <= 4 ? "Good" : "Strong";
  const color =
    score <= 2
      ? "red.500"
      : score <= 3
        ? "orange.400"
        : score <= 4
          ? "blue.400"
          : "green.500";
  return { results, score, level, color };
}

export default function PasswordStrength({
  password,
}: {
  password: string;
}) {
  const { results, score, level, color } = getStrength(password);

  return (
    <VStack align="stretch" gap="2" mt="2">
      <HStack gap="1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Box
            key={i}
            flex="1"
            h="1.5"
            borderRadius="full"
            bg={i < score ? color : "border"}
            transition="background 0.2s"
          />
        ))}
      </HStack>
      <HStack justify="space-between">
        <Text fontSize="xs" color={color} fontWeight="600">
          {level}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {score}/5
        </Text>
      </HStack>
      <VStack align="start" gap="0.5">
        {results.map((check) => (
          <HStack key={check.label} gap="1.5">
            <Box
              w="1.5"
              h="1.5"
              borderRadius="full"
              bg={check.met ? "green.500" : "border"}
              transition="background 0.2s"
            />
            <Text
              fontSize="xs"
              color={check.met ? "fg" : "fg.muted"}
              transition="color 0.2s"
            >
              {check.label}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
