import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdvisorSignupGateCookieName,
  verifyAdvisorSignupGateToken,
} from "@/lib/advisor-signup-gate";
import AdvisorSignupClient from "./AdvisorSignupClient";

export default async function AdminSignupPage() {
  const cookieStore = await cookies();

  const gateToken = cookieStore.get(getAdvisorSignupGateCookieName())?.value;

  if (!verifyAdvisorSignupGateToken(gateToken)) {
    redirect("/signup");
  }

  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-dm-sans), sans-serif"
      position="relative"
    >
      {/* Navigation Header */}
      <Box
        as="header"
        position="sticky"
        top="0"
        zIndex="sticky"
        className="glass-card"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <HStack justify="space-between" py="4">
            <Link href="/">
              <HStack gap="3" cursor="pointer">
                <Box
                  p="2"
                  bg="blue.solid"
                  borderRadius="lg"
                  className="animate-pulse-glow"
                >
                  <Icon color="white" boxSize="5">
                    <LuGraduationCap />
                  </Icon>
                </Box>
                <Text
                  fontWeight="700"
                  fontSize="xl"
                  fontFamily="var(--font-dm-sans), sans-serif"
                  letterSpacing="-0.02em"
                >
                  GradTracker
                </Text>
                <Badge
                  colorPalette="blue"
                  variant="surface"
                  size="sm"
                  fontWeight="500"
                >
                  Parkside
                </Badge>
              </HStack>
            </Link>
            <HStack gap="3">
              <ColorModeButton variant="ghost" size="sm" />
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Signup Section */}
      <Box
        className="mesh-gradient noise-overlay"
        py={{ base: "16", md: "24" }}
        minH="calc(100vh - 73px)"
        display="flex"
        alignItems="center"
        position="relative"
        overflow="hidden"
      >
        {/* Decorative elements */}
        <Box
          position="absolute"
          top="-20%"
          right="-10%"
          w="500px"
          h="500px"
          bg="blue.500"
          opacity="0.05"
          borderRadius="full"
          filter="blur(100px)"
        />
        <Box
          position="absolute"
          bottom="-30%"
          left="-10%"
          w="400px"
          h="400px"
          bg="teal.500"
          opacity="0.05"
          borderRadius="full"
          filter="blur(80px)"
        />

        <Container maxW="md" position="relative" zIndex="2">
          <Box position="relative">
            {/* Glow effect */}
            <Box
              position="absolute"
              inset="-4"
              bg="blue.500"
              opacity="0.15"
              borderRadius="3xl"
              filter="blur(40px)"
            />

            <Card.Root
              bg="bg"
              p={{ base: "6", md: "10" }}
              borderRadius="3xl"
              boxShadow="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              position="relative"
              overflow="hidden"
            >
              {/* Subtle gradient overlay */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                h="1px"
                bgGradient="to-r"
                gradientFrom="transparent"
                gradientVia="blue.500"
                gradientTo="transparent"
              />

              <Card.Body p="0">
                <VStack gap="6" align="stretch">
                  <VStack gap="2" textAlign="center">
                    <Text
                      fontWeight="700"
                      fontSize="2xl"
                      fontFamily="var(--font-dm-sans), sans-serif"
                      letterSpacing="-0.02em"
                    >
                      Advisor Sign Up
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      Create an advisor account to access the admin dashboard.
                    </Text>
                  </VStack>

                  <VStack gap="5">
                    <HStack gap="4" w="full">
                      <Field label="First Name">
                        <Input
                          placeholder="First name"
                          rounded="lg"
                          size="lg"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </Field>
                      <Field label="Last Name">
                        <Input
                          placeholder="Last name"
                          rounded="lg"
                          size="lg"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </Field>
                    </HStack>

                    <Field label="Email">
                      <Input
                        placeholder="your.name@uwp.edu"
                        type="email"
                        rounded="lg"
                        size="lg"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>

                    <Field label="Password">
                      <PasswordInput
                        placeholder="Create a password"
                        rounded="lg"
                        size="lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>

                    <Field label="Confirm Password">
                      <PasswordInput
                        placeholder="Confirm your password"
                        rounded="lg"
                        size="lg"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </Field>
                  </VStack>

                  <Button
                    w="full"
                    colorPalette="blue"
                    size="lg"
                    rounded="lg"
                    fontWeight="600"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "lg",
                    }}
                    transition="all 0.2s"
                    onClick={handleSignup}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icon className="animate-spin" mr="2">
                          <LuLoader />
                        </Icon>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Advisor Account
                        <Icon ml="2">
                          <LuArrowRight />
                        </Icon>
                      </>
                    )}
                  </Button>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Already have an account?{" "}
                    <Link href="/signin">
                      <Text
                        as="span"
                        color="blue.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Sign in
                      </Text>
                    </Link>
                  </Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
