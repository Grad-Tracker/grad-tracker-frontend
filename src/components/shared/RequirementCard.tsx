"use client";

import { type ReactNode } from "react";
import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";

export interface RequirementItem {
  id: number;
  subject: string;
  number: string;
  title: string;
}

interface RequirementCardProps {
  title: string;
  /** Badge rendered on the right side of the header (e.g. credits or count) */
  badge: ReactNode;
  items: RequirementItem[];
  completedIds: Set<number>;
  onToggleItem: (id: number, checked: boolean) => void;
}

export function RequirementCard({
  title,
  badge,
  items,
  completedIds,
  onToggleItem,
}: RequirementCardProps) {
  return (
    <Card.Root
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      <Card.Header p="5" pb="3">
        <HStack justify="space-between">
          <Heading size="sm" fontWeight="600">
            {title}
          </Heading>
          {badge}
        </HStack>
      </Card.Header>
      <Card.Body p="5" pt="0">
        <Stack gap="2">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              colorPalette="blue"
              checked={completedIds.has(item.id)}
              onCheckedChange={(e) => onToggleItem(item.id, !!e.checked)}
            >
              <Text fontSize="sm">
                {item.subject} {item.number} — {item.title}
              </Text>
            </Checkbox>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
