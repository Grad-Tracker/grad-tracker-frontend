"use client";

import { Badge, Box, Flex, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";

export default function DemoPage() {
  return (
    <Flex minH="100vh" align="center" justify="center" bg="bg.subtle" py="10" px="6">
      <Box
        w="full"
        maxW="480px"
        bg="bg"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="xl"
        overflow="hidden"
      >
        <HStack
          px="4"
          py="3"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          bg="bg"
          gap="3"
        >
          <Box p="1.5" bg="blue.solid" borderRadius="md" flexShrink={0}>
            <Icon color="white" boxSize="4">
              <LuSparkles />
            </Icon>
          </Box>
          <Text fontWeight="700" fontSize="md">
            Atlas
          </Text>
          <Badge colorPalette="blue" variant="subtle" size="sm">
            v1.5
          </Badge>
        </HStack>

        <VStack gap="4" p="8" align="start">
          <Text fontSize="lg" fontWeight="600">
            Grad Tracker — Cloud Computing Demo
          </Text>
          <Text fontSize="sm" color="fg.muted">
            This page is deployed via Azure DevOps CI/CD pipeline. Changes pushed
            to the <Text as="code" fontSize="xs" px="1" bg="bg.subtle" borderRadius="sm">demo/cloud-computing</Text> branch
            trigger an automated build and deploy to the dev environment.
          </Text>
          <HStack gap="2" flexWrap="wrap">
            <Badge colorPalette="green" variant="subtle">Build</Badge>
            <Badge colorPalette="green" variant="subtle">Deploy</Badge>
            <Badge colorPalette="blue" variant="subtle">Azure DevOps</Badge>
            <Badge colorPalette="purple" variant="subtle">Key Vault</Badge>
          </HStack>
        </VStack>
      </Box>
    </Flex>
  );
}
