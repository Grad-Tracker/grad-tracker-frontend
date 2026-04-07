import { Box, Flex, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";
import { LuGraduationCap } from "react-icons/lu";

const FADE_SLIDE_IN = {
  animation: "fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
  "@keyframes fadeSlideIn": {
    from: { opacity: 0, transform: "translateX(16px)" },
    to: { opacity: 1, transform: "translateX(0)" },
  },
};

export default function AuthPageLayout({
  headline,
  highlightWord,
  subtitle,
  children,
  maxFormW = "440px",
}: {
  headline: string;
  highlightWord: string;
  subtitle: string;
  children: React.ReactNode;
  maxFormW?: string;
}) {
  return (
    <Flex
      minH="100vh"
      fontFamily="var(--font-dm-sans), sans-serif"
      direction={{ base: "column", lg: "row" }}
    >
      {/* Campus image panel */}
      <Box
        position="relative"
        w={{ base: "full", lg: "50%" }}
        minH={{ base: "220px", lg: "100vh" }}
        overflow="hidden"
        flexShrink={0}
      >
        <Image
          src="/landing/Parkside_Hero.jpg"
          alt="UW-Parkside Campus"
          fill
          style={{ objectFit: "cover", objectPosition: "center" }}
          priority
        />
        <Box
          position="absolute"
          inset="0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.7) 100%)",
          }}
        />

        <Flex
          position="absolute"
          inset="0"
          direction="column"
          justify="space-between"
          p={{ base: "6", lg: "10" }}
          zIndex="2"
        >
          <Link href="/">
            <HStack gap="3" cursor="pointer">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                bg="rgba(255,255,255,0.12)"
                css={{ backdropFilter: "blur(8px)" }}
                border="1px solid rgba(255,255,255,0.2)"
                borderRadius="lg"
              >
                <Icon color="white" boxSize="4">
                  <LuGraduationCap />
                </Icon>
              </Flex>
              <Text fontWeight="700" fontSize="md" color="white">
                GradTracker{" "}
                <Text
                  as="span"
                  color="whiteAlpha.500"
                  fontWeight="500"
                  fontSize="sm"
                >
                  Parkside
                </Text>
              </Text>
            </HStack>
          </Link>

          <VStack
            align="start"
            gap="3"
            display={{ base: "none", lg: "flex" }}
          >
            <Text
              fontSize={{ lg: "4xl", xl: "5xl" }}
              fontWeight="400"
              lineHeight="1.1"
              letterSpacing="-0.03em"
              color="white"
            >
              {headline}
              <br />
              <Text
                as="span"
                style={{
                  background: "linear-gradient(135deg, #93C5FD, #C4B5FD)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {highlightWord}
              </Text>
            </Text>
            <Text
              fontSize="md"
              color="whiteAlpha.600"
              maxW="340px"
              lineHeight="1.6"
            >
              {subtitle}
            </Text>
          </VStack>

          <Text
            fontSize="2xs"
            color="whiteAlpha.300"
            fontWeight="500"
            display={{ base: "none", lg: "block" }}
          >
            UW-Parkside Campus
          </Text>
        </Flex>
      </Box>

      {/* Form panel */}
      <Flex
        flex="1"
        align="center"
        justify="center"
        bg="bg"
        px={{ base: "6", md: "12", lg: "16" }}
        py={{ base: "10", md: "12" }}
        position="relative"
      >
        <Box w="full" maxW={maxFormW} css={FADE_SLIDE_IN}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
