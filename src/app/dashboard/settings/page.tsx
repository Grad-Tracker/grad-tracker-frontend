"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  chakra,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Stack,
  Switch,
  Tabs,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuLock, LuCalendar, LuBell, LuTrash2, LuTriangleAlert } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";
import { ClassHistoryTab } from "@/components/settings/ClassHistoryTab";
import { SettingsSkeleton } from "@/components/settings/SettingsSkeleton";

type NotifPrefs = {
  notif_requirement_alerts: boolean;
  notif_semester_reminders: boolean;
  notif_graduation_reminders: boolean;
  notif_weekly_digest: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  notif_requirement_alerts: true,
  notif_semester_reminders: true,
  notif_graduation_reminders: true,
  notif_weekly_digest: false,
};

const NOTIF_OPTIONS: { key: keyof NotifPrefs; label: string; description: string }[] = [
  {
    key: "notif_requirement_alerts",
    label: "Requirement Alerts",
    description: "Get notified when you have unmet prerequisites or missing requirements.",
  },
  {
    key: "notif_semester_reminders",
    label: "Semester Planning Reminders",
    description: "Reminders to plan your courses before each semester begins.",
  },
  {
    key: "notif_graduation_reminders",
    label: "Graduation Reminders",
    description: "Alerts when you're approaching your expected graduation date.",
  },
  {
    key: "notif_weekly_digest",
    label: "Weekly Progress Digest",
    description: "A weekly summary of your progress toward graduation.",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [gradSemester, setGradSemester] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingGrad, setSavingGrad] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");

        const { data: student } = await supabase
          .from(DB_TABLES.students)
          .select("id, first_name, last_name, expected_graduation_semester, expected_graduation_year")
          .eq(STUDENT_COLUMNS.authUserId, user.id)
          .maybeSingle();

        if (student) {
          setStudentId(student.id);
          setFirstName(student.first_name ?? "");
          setLastName(student.last_name ?? "");
          setGradSemester(student.expected_graduation_semester ?? "");
          setGradYear(student.expected_graduation_year ? String(student.expected_graduation_year) : "");

          // Load notification preferences
          const { data: prefs } = await supabase
            .from(DB_TABLES.notificationPreferences)
            .select(
              "notif_requirement_alerts, notif_semester_reminders, notif_graduation_reminders, notif_weekly_digest"
            )
            .eq("student_id", student.id)
            .maybeSingle();

          if (prefs) {
            setNotifPrefs({
              notif_requirement_alerts: prefs.notif_requirement_alerts ?? DEFAULT_PREFS.notif_requirement_alerts,
              notif_semester_reminders: prefs.notif_semester_reminders ?? DEFAULT_PREFS.notif_semester_reminders,
              notif_graduation_reminders: prefs.notif_graduation_reminders ?? DEFAULT_PREFS.notif_graduation_reminders,
              notif_weekly_digest: prefs.notif_weekly_digest ?? DEFAULT_PREFS.notif_weekly_digest,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSaveName = async () => {
    if (!studentId) return;
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(DB_TABLES.students)
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq(STUDENT_COLUMNS.id, studentId);
      if (error) throw error;
      toaster.create({ title: "Name updated", type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to update name", description: msg, type: "error" });
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === email) return;
    setSavingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setEmail(trimmed);
      toaster.create({
        title: "Verification email sent",
        description: "Check your inbox to confirm the new email address.",
        type: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to update email", description: msg, type: "error" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSaveGrad = async () => {
    if (!studentId) return;
    const yearNum = gradYear ? parseInt(gradYear, 10) : null;
    if (gradYear && (isNaN(yearNum!) || yearNum! < 2000 || yearNum! > 2100)) {
      toaster.create({ title: "Enter a valid graduation year", type: "error" });
      return;
    }
    setSavingGrad(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(DB_TABLES.students)
        .update({
          expected_graduation_semester: gradSemester || null,
          expected_graduation_year: yearNum,
        })
        .eq(STUDENT_COLUMNS.id, studentId);
      if (error) throw error;
      toaster.create({ title: "Graduation info updated", type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to update graduation info", description: msg, type: "error" });
    } finally {
      setSavingGrad(false);
    }
  };

  const handleSaveNotif = async () => {
    if (!studentId) return;
    setSavingNotif(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(DB_TABLES.notificationPreferences)
        .upsert({ student_id: studentId, ...notifPrefs }, { onConflict: "student_id" });
      if (error) throw error;
      toaster.create({ title: "Notification preferences saved", type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to save preferences", description: msg, type: "error" });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleResetProgress = async () => {
    if (!studentId) return;
    setResetting(true);
    try {
      const supabase = createClient();
      const [historyResult, plannedResult, programsResult] = await Promise.all([
        supabase.from(DB_TABLES.studentCourseHistory).delete().eq("student_id", studentId),
        supabase.from(DB_TABLES.studentPlannedCourses).delete().eq("student_id", studentId),
        supabase.from(DB_TABLES.studentPrograms).delete().eq("student_id", studentId),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (plannedResult.error) throw plannedResult.error;
      if (programsResult.error) throw programsResult.error;
      const { error: studentError } = await supabase
        .from(DB_TABLES.students)
        .update({ has_completed_onboarding: false })
        .eq(STUDENT_COLUMNS.id, studentId);
      if (studentError) throw studentError;
      toaster.create({ title: "Progress reset", description: "Your progress has been cleared. Use the setup wizard to start fresh.", type: "success" });
      router.push("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to reset progress", description: msg, type: "error" });
    } finally {
      setResetting(false);
      setResetConfirming(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <Stack gap="6">
      <Box>
        <Text fontSize="sm" color="fg.muted" fontWeight="500">
          Settings
        </Text>
        <Heading size="lg" fontFamily="'DM Serif Display', serif" fontWeight="400">
          Account Settings
        </Heading>
      </Box>

      <Tabs.Root defaultValue="profile" variant="enclosed" colorPalette="blue">
        <Tabs.List>
          <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
          <Tabs.Trigger value="class-history">Class History</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="profile">
          <Stack gap="6" pt="4">
            {/* Profile */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600">
                  Profile
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Update your display name.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Stack gap="4">
                  <Flex gap="4" direction={{ base: "column", sm: "row" }}>
                    <Field label="First Name" flex="1">
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        borderRadius="lg"
                      />
                    </Field>
                    <Field label="Last Name" flex="1">
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        borderRadius="lg"
                      />
                    </Field>
                  </Flex>
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveName}
                    loading={savingName}
                    alignSelf="flex-start"
                    borderRadius="lg"
                  >
                    Save Name
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>

            {/* Email */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600">
                  Email Address
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  A confirmation link will be sent to the new address.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Stack gap="4">
                  <Field label="Email">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="you@example.com"
                      borderRadius="lg"
                    />
                  </Field>
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveEmail}
                    loading={savingEmail}
                    disabled={!newEmail.trim() || newEmail.trim() === email}
                    alignSelf="flex-start"
                    borderRadius="lg"
                  >
                    Update Email
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>

            {/* Expected Graduation */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Flex align="center" gap="2">
                  <Icon color="blue.fg">
                    <LuCalendar />
                  </Icon>
                  <Heading size="md" fontWeight="600">
                    Expected Graduation
                  </Heading>
                </Flex>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Update when you expect to graduate.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Stack gap="4">
                  <Flex gap="4" direction={{ base: "column", sm: "row" }}>
                    <Field label="Semester" flex="1">
                      <chakra.select
                        value={gradSemester}
                        onChange={(e) => setGradSemester(e.target.value)}
                        w="full"
                        px="3"
                        py="2"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        bg="bg"
                        fontSize="sm"
                        color="fg"
                        _focus={{ outline: "2px solid", outlineColor: "blue.fg", outlineOffset: "2px" }}
                      >
                        <option value="">— Select —</option>
                        <option value="Spring">Spring</option>
                        <option value="Summer">Summer</option>
                        <option value="Fall">Fall</option>
                        <option value="Winter">Winter</option>
                      </chakra.select>
                    </Field>
                    <Field label="Year" flex="1">
                      <Input
                        type="number"
                        value={gradYear}
                        onChange={(e) => setGradYear(e.target.value)}
                        placeholder="e.g. 2026"
                        borderRadius="lg"
                        min={2000}
                        max={2100}
                      />
                    </Field>
                  </Flex>
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveGrad}
                    loading={savingGrad}
                    alignSelf="flex-start"
                    borderRadius="lg"
                  >
                    Save Graduation Info
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>

            {/* Notification Preferences */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Flex align="center" gap="2">
                  <Icon color="blue.fg">
                    <LuBell />
                  </Icon>
                  <Heading size="md" fontWeight="600">
                    Notification Preferences
                  </Heading>
                </Flex>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Choose which notifications you'd like to receive.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Stack gap="5">
                  {NOTIF_OPTIONS.map((opt) => (
                    <HStack key={opt.key} justify="space-between" align="start" gap="4">
                      <Box flex="1">
                        <Text fontWeight="500" fontSize="sm">
                          {opt.label}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" mt="0.5">
                          {opt.description}
                        </Text>
                      </Box>
                      <Switch.Root
                        colorPalette="blue"
                        checked={notifPrefs[opt.key]}
                        onCheckedChange={({ checked }) =>
                          setNotifPrefs((prev) => ({ ...prev, [opt.key]: checked }))
                        }
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </HStack>
                  ))}
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveNotif}
                    loading={savingNotif}
                    alignSelf="flex-start"
                    borderRadius="lg"
                    mt="1"
                  >
                    Save Preferences
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>

            {/* Password */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600">
                  Password
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  You'll be guided through a secure password reset flow.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Link href="/reset-password">
                  <Button colorPalette="blue" alignSelf="flex-start" borderRadius="lg">
                    <Icon mr="2">
                      <LuLock />
                    </Icon>
                    Reset Password
                  </Button>
                </Link>
              </Card.Body>
            </Card.Root>
            {/* Danger Zone */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="red.muted">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600" color="red.fg">
                  Danger Zone
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Permanently delete all your course history, planned courses, and program selections.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                {!resetConfirming ? (
                  <Button
                    variant="outline"
                    colorPalette="red"
                    alignSelf="flex-start"
                    borderRadius="lg"
                    onClick={() => setResetConfirming(true)}
                  >
                    <Icon mr="2">
                      <LuTrash2 />
                    </Icon>
                    Reset All Progress
                  </Button>
                ) : (
                  <Stack gap="2" p="3" bg="red.subtle" borderWidth="1px" borderColor="red.muted" borderRadius="lg" maxW="sm">
                    <HStack gap="2">
                      <Icon color="red.fg" flexShrink={0}>
                        <LuTriangleAlert />
                      </Icon>
                      <Text fontSize="xs" fontWeight="500" color="red.fg">
                        This will delete all your progress. Are you sure?
                      </Text>
                    </HStack>
                    <HStack gap="2">
                      <Button
                        size="xs"
                        colorPalette="red"
                        loading={resetting}
                        onClick={handleResetProgress}
                        borderRadius="md"
                        flex="1"
                      >
                        Yes, Reset
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setResetConfirming(false)}
                        borderRadius="md"
                        flex="1"
                      >
                        Cancel
                      </Button>
                    </HStack>
                  </Stack>
                )}
              </Card.Body>
            </Card.Root>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="class-history">
          <ClassHistoryTab />
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
