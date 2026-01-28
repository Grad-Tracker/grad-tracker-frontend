import { Box, Button, Container, Heading, Text, VStack } from "@chakra-ui/react";

export default function Home() {
  return (
    <Box minH="100vh" bg="bg.subtle">
      <Container maxW="4xl" py="16">
        <VStack gap="8" textAlign="center">
          <Heading size="4xl">Grad Tracker</Heading>
          <Text color="fg.muted" fontSize="lg">
            Track your graduation progress with ease.
          </Text>
          <Button size="lg" colorPalette="blue">
            Get Started
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}
