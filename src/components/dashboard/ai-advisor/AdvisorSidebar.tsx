"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  HStack,
  Progress,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuBookOpen, LuTarget, LuClock } from "react-icons/lu";

interface ProgressBlock {
  blockId: number;
  blockName: string;
  completedCredits: number;
  inProgressCredits: number;
  remainingCredits: number;
  totalCreditsRequired: number;
  percentage: number;
}

interface ContextData {
  studentName: string;
  primaryProgram: string | null;
  catalogYear: string | null;
  expectedGraduation: string | null;
  progress: {
    overall: {
      completedCredits: number;
      inProgressCredits: number;
      remainingCredits: number;
      totalCreditsRequired: number;
      percentage: number;
    };
    blocks: ProgressBlock[];
  };
}

function getBlockColorPalette(blockName: string): string {
  const lower = blockName.toLowerCase();
  if (lower.includes("core") || lower.includes("required")) return "blue";
  if (lower.includes("elective")) return "purple";
  if (lower.includes("general education") || lower.includes("gen ed")) return "green";
  return "gray";
}

function SidebarCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="bg"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="xl"
      p="4"
    >
      <HStack gap="2" mb="3">
        <Box color="fg.muted">{icon}</Box>
        <Text fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
          {title}
        </Text>
      </HStack>
      {children}
    </Box>
  );
}

export function AdvisorSidebar() {
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/ai-advisor/context")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch context");
        return res.json() as Promise<ContextData>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box
        w="280px"
        flexShrink={0}
        display={{ base: "none", xl: "block" }}
      >
        <VStack align="stretch" gap="3">
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="xl"
              h="80px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="xs" color="fg.subtle">Loading context...</Text>
            </Box>
          ))}
        </VStack>
      </Box>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <Box
      w="280px"
      flexShrink={0}
      display={{ base: "none", xl: "block" }}
    >
      <VStack align="stretch" gap="3">
        {/* Student Info */}
        <SidebarCard icon={<LuBookOpen size={14} />} title="Student">
          <VStack align="stretch" gap="1.5">
            <Text fontSize="sm" fontWeight="600">
              {data.studentName}
            </Text>
            {data.primaryProgram && (
              <Text fontSize="xs" color="fg.muted">
                {data.primaryProgram}
              </Text>
            )}
            {data.catalogYear && (
              <Text fontSize="xs" color="fg.subtle">
                Catalog: {data.catalogYear}
              </Text>
            )}
            {data.expectedGraduation && (
              <Box mt="1">
                <Badge colorPalette="blue" variant="subtle" size="sm">
                  Grad: {data.expectedGraduation}
                </Badge>
              </Box>
            )}
          </VStack>
        </SidebarCard>

        {/* Credit Progress */}
        <SidebarCard icon={<LuTarget size={14} />} title="Degree Progress">
          <VStack align="stretch" gap="3">
            {/* Overall */}
            <Box>
              <HStack justify="space-between" mb="1.5">
                <Text fontSize="xs" fontWeight="600">Overall</Text>
                <Text fontSize="xs" color="fg.muted">{data.progress.overall.percentage}%</Text>
              </HStack>
              <Progress.Root
                value={data.progress.overall.percentage}
                max={100}
                size="sm"
                colorPalette="purple"
              >
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>

            {/* Per-block */}
            {data.progress.blocks.map((block) => (
              <Box key={block.blockId}>
                <HStack justify="space-between" mb="1.5">
                  <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                    {block.blockName}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle" flexShrink={0}>
                    {block.percentage}%
                  </Text>
                </HStack>
                <Progress.Root
                  value={block.percentage}
                  max={100}
                  size="xs"
                  colorPalette={getBlockColorPalette(block.blockName)}
                >
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Box>
            ))}
          </VStack>
        </SidebarCard>

        {/* Snapshot */}
        <SidebarCard icon={<LuClock size={14} />} title="Snapshot">
          <VStack align="stretch" gap="2">
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">Completed</Text>
              <Text fontSize="xs" fontWeight="600">
                {data.progress.overall.completedCredits} cr
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">In Progress</Text>
              <Text fontSize="xs" fontWeight="600" color="orange.fg">
                {data.progress.overall.inProgressCredits} cr
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">Remaining</Text>
              <Text fontSize="xs" fontWeight="600" color="fg.subtle">
                {data.progress.overall.remainingCredits} cr
              </Text>
            </HStack>
          </VStack>
        </SidebarCard>
      </VStack>
    </Box>
  );
}
