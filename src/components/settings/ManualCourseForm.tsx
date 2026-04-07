"use client";

import { useState } from "react";
import { Button, Input, Stack, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { insertManualCourse } from "@/lib/supabase/queries/classHistory";
import type { CourseRow } from "@/types/onboarding";

interface ManualCourseFormProps {
  onCourseCreated: (course: CourseRow) => void;
  onBack: () => void;
}

export function ManualCourseForm({ onCourseCreated, onBack }: ManualCourseFormProps) {
  const [subject, setSubject] = useState("");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    const s = subject.trim().toUpperCase();
    if (!/^[A-Z]{2,10}$/.test(s)) return "Subject must be 2-10 uppercase letters (e.g. MATH)";
    const n = number.trim();
    if (!/^[0-9]{3,4}$/.test(n)) return "Number must be 3-4 digits (e.g. 101)";
    if (!title.trim()) return "Title is required";
    const c = parseFloat(credits);
    if (Number.isNaN(c) || c < 0) return "Credits must be a non-negative number";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toaster.create({ title: err, type: "error" });
      return;
    }
    setSaving(true);
    try {
      const course = await insertManualCourse(
        subject.trim().toUpperCase(),
        number.trim(),
        title.trim(),
        parseFloat(credits)
      );
      toaster.create({ title: "Course added", type: "success" });
      onCourseCreated(course);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to add course", description: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="4">
      <Field label="Subject">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. MATH"
          borderRadius="lg"
        />
      </Field>
      <Field label="Course Number">
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="e.g. 101"
          borderRadius="lg"
        />
      </Field>
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Calculus I"
          borderRadius="lg"
        />
      </Field>
      <Field label="Credits">
        <Input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="e.g. 3"
          min={0}
          borderRadius="lg"
        />
      </Field>
      <Button colorPalette="blue" onClick={handleSubmit} loading={saving} borderRadius="lg">
        Add Course
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack} alignSelf="flex-start">
        <Text fontSize="sm" color="fg.muted">
          Back to search
        </Text>
      </Button>
    </Stack>
  );
}
