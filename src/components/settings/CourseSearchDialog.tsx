"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Input, Stack, Text, Button } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { searchCourses } from "@/lib/supabase/queries/classHistory";
import { ManualCourseForm } from "./ManualCourseForm";
import type { CourseRow } from "@/types/onboarding";

interface CourseSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onCourseSelected: (course: CourseRow) => void;
}

export function CourseSearchDialog({ open, onClose, onCourseSelected }: CourseSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setShowManual(false);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchCourses(query);
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (course: CourseRow) => {
    onCourseSelected(course);
    onClose();
  };

  const handleManualCreated = (course: CourseRow) => {
    onCourseSelected(course);
    onClose();
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{showManual ? "Add Course Manually" : "Search Courses"}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody pb="6">
          {showManual ? (
            <ManualCourseForm
              onCourseCreated={handleManualCreated}
              onBack={() => setShowManual(false)}
            />
          ) : (
            <Stack gap="4">
              <Input
                placeholder="Search by subject, number, or title..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                borderRadius="lg"
                autoFocus
              />
              {searching && (
                <Text fontSize="sm" color="fg.muted">
                  Searching...
                </Text>
              )}
              {!searching && results.length > 0 && (
                <Stack gap="1" maxH="300px" overflowY="auto">
                  {results.map((course) => (
                    <Button
                      key={course.id}
                      type="button"
                      variant="plain"
                      w="full"
                      p="2"
                      textAlign="left"
                      justifyContent="flex-start"
                      h="auto"
                      whiteSpace="normal"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="transparent"
                      _hover={{ bg: "bg.subtle" }}
                      _focusVisible={{ outline: "2px solid", outlineColor: "blue.fg", outlineOffset: "2px" }}
                      aria-label={`Select course ${course.subject} ${course.number} ${course.title}`}
                      onClick={() => handleSelect(course)}
                    >
                      <Text fontSize="sm" fontWeight="500">
                        {course.subject} {course.number}
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        — {course.title} ({course.credits} cr)
                      </Text>
                    </Button>
                  ))}
                </Stack>
              )}
              {!searching && query.length >= 2 && results.length === 0 && (
                <Text fontSize="sm" color="fg.muted">
                  No courses found.
                </Text>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManual(true)}
                alignSelf="flex-start"
              >
                <Text fontSize="sm" color="fg.muted">
                  Can&apos;t find your course? Add it manually
                </Text>
              </Button>
            </Stack>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
