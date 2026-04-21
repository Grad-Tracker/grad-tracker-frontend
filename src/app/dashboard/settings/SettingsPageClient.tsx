"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
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
import { LuLock, LuCalendar, LuBell, LuTrash2, LuTriangleAlert, LuSun, LuMoon, LuMonitor, LuGraduationCap } from "react-icons/lu";
import { useColorMode } from "@/components/ui/color-mode";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";
import { fetchPrograms, fetchStudentMajorProgram } from "@/lib/supabase/queries/onboarding";
import type { Program } from "@/types/onboarding";
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

const THEME_OPTIONS = [
  { value: "system", label: "System", description: "Follows your device settings", icon: LuMonitor },
  { value: "light", label: "Light", description: "Always use light mode", icon: LuSun },
  { value: "dark", label: "Dark", description: "Always use dark mode", icon: LuMoon },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { themePreference, setColorMode } = useColorMode();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [gradSemester, setGradSemester] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [gradYearError, setGradYearError] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingGrad, setSavingGrad] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [majors, setMajors] = useState<Program[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [currentMajorProgramId, setCurrentMajorProgramId] = useState<number | null>(null);
  const [savingMajor, setSavingMajor] = useState(false);
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
        setPendingEmail(null);

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

          // Load current major and available majors
          const [majorProgram, allMajors] = await Promise.all([
            fetchStudentMajorProgram(student.id).catch(() => null),
            fetchPrograms("MAJOR").catch(() => [] as Program[]),
          ]);
          if (majorProgram) {
            setCurrentMajorProgramId(majorProgram.program_id);
            setSelectedMajorId(majorProgram.program_id);
          }
          setMajors(allMajors);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toaster.create({
          title: "Failed to load settings",
          description: msg,
          type: "error",
        });
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
      setPendingEmail(trimmed);
      toaster.create({
        title: "Confirmation email sent",
        description: "Please verify to complete the change.",
        type: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to update email", description: msg, type: "error" });
    } finally {
      setSavingEmail(false);
    }
  };

  const validateGradYear = (value: string): string => {
    if (!value.trim()) return "";
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) {
      return "Enter a year between 2000 and 2100.";
    }
    return "";
  };

  const handleSaveGrad = async () => {
    if (!studentId) return;
    const yearError = validateGradYear(gradYear);
    setGradYearError(yearError);
    if (yearError) return;
    const yearNum = gradYear ? parseInt(gradYear, 10) : null;
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

  const handleChangeMajor = async () => {
    if (!selectedMajorId || !studentId || selectedMajorId === currentMajorProgramId) return;
    setSavingMajor(true);
    try {
      const response = await fetch("/api/student/change-major", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ programId: selectedMajorId }),
      });
      const payload = await response
        .json()
        .catch(() => ({ error: "Please try again." }));

      if (!response.ok) {
        throw new Error(payload.error ?? "Please try again.");
      }

      setCurrentMajorProgramId(selectedMajorId);
      toaster.create({ title: "Major updated", type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to change major", description: msg, type: "error" });
    } finally {
      setSavingMajor(false);
    }
  };

  const handleResetProgress = async () => {
    if (!studentId) return;
    setResetting(true);
    try {
      const response = await fetch("/api/student/reset-progress", {
        method: "POST",
      });
      const payload = await response
        .json()
        .catch(() => ({ error: "Please try again." }));

      if (!response.ok) {
        throw new Error(payload.error ?? "Please try again.");
      }

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
        <Heading size="lg" fontFamily="var(--font-dm-sans), sans-serif" fontWeight="400" letterSpacing="-0.02em">
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

            {/* Change Major */}
            {majors.length > 0 && (
              <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
                <Card.Header p="5" pb="3">
                  <Flex align="center" gap="2">
                    <Icon color="blue.fg">
                      <LuGraduationCap />
                    </Icon>
                    <Heading size="md" fontWeight="600">
                      Major
                    </Heading>
                  </Flex>
                  <Text fontSize="sm" color="fg.muted" mt="1">
                    Change your declared major program.
                  </Text>
                </Card.Header>
                <Card.Body p="5" pt="2">
                  <Stack gap="4">
                    <Field label="Current Major">
                      <chakra.select
                        value={selectedMajorId ?? ""}
                        onChange={(e) => setSelectedMajorId(Number(e.target.value))}
                        aria-label="Select major"
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
                        cursor="pointer"
                      >
                        {majors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </chakra.select>
                    </Field>
                    <Button
                      colorPalette="blue"
                      onClick={handleChangeMajor}
                      loading={savingMajor}
                      disabled={!selectedMajorId || selectedMajorId === currentMajorProgramId}
                      alignSelf="flex-start"
                      borderRadius="lg"
                    >
                      Save Major
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            )}

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
                  <Field
                    label="Email"
                    helperText={
                      pendingEmail
                        ? `Pending verification: ${pendingEmail}`
                        : `Current sign-in email: ${email || "Not available"}`
                    }
                  >
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="you@example.com"
                      borderRadius="lg"
                    />
                  </Field>
                  {pendingEmail ? (
                    <Alert.Root status="warning" borderRadius="lg">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Pending verification</Alert.Title>
                        <Alert.Description>
                          Your sign-in email will stay {email} until you confirm {pendingEmail}.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  ) : null}
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveEmail}
                    loading={savingEmail}
                    disabled={
                      !newEmail.trim() ||
                      newEmail.trim() === email ||
                      newEmail.trim() === pendingEmail
                    }
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
                    <Field label="Year" flex="1" invalid={!!gradYearError} errorText={gradYearError}>
                      <Input
                        type="number"
                        value={gradYear}
                        onChange={(e) => {
                          const value = e.target.value;
                          setGradYear(value);
                          if (gradYearError) {
                            setGradYearError(validateGradYear(value));
                          }
                        }}
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

            {/* TODO: Notification Preferences - uncomment when notifications are implemented */}
            {/* <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
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
                        aria-label={`Toggle ${opt.label}`}
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
            </Card.Root> */}

            {/* Appearance */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Flex align="center" gap="2">
                  <Icon color="blue.fg">
                    <LuSun />
                  </Icon>
                  <Heading size="md" fontWeight="600">
                    Appearance
                  </Heading>
                </Flex>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Choose how GradTracker looks to you. System preference is used by default.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Flex gap="3" direction={{ base: "column", sm: "row" }}>
                  {THEME_OPTIONS.map((opt) => {
                    const selected = themePreference === opt.value;
                    return (
                      <Box
                        key={opt.value}
                        as="button"
                        flex="1"
                        p="4"
                        borderRadius="xl"
                        borderWidth="2px"
                        borderColor={selected ? "blue.500" : "border.subtle"}
                        bg={selected ? "blue.subtle" : "bg"}
                        cursor="pointer"
                        transition="all 0.15s"
                        _hover={{ borderColor: selected ? "blue.500" : "blue.300", bg: selected ? "blue.subtle" : "bg.subtle" }}
                        onClick={() => setColorMode(opt.value)}
                        textAlign="center"
                      >
                        <Icon boxSize="5" color={selected ? "blue.fg" : "fg.muted"} mb="2">
                          <opt.icon />
                        </Icon>
                        <Text fontSize="sm" fontWeight="600" color={selected ? "blue.fg" : "fg"}>
                          {opt.label}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" mt="0.5">
                          {opt.description}
                        </Text>
                      </Box>
                    );
                  })}
                </Flex>
              </Card.Body>
            </Card.Root>

            {/* Password */}
            <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600">
                  Password
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  We&apos;ll send a password reset email so you can choose a new password securely.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Stack gap="3" align="start">
                  <Text fontSize="sm" color="fg.muted">
                    Selecting this opens the reset flow and sends a reset link to your account email.
                  </Text>
                  <Button asChild colorPalette="blue" alignSelf="flex-start" borderRadius="lg">
                    <Link href="/reset-password">
                      <Icon mr="2">
                        <LuLock />
                      </Icon>
                      Reset Password
                    </Link>
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>
            {/* Danger Zone */}
            <Card.Root bg="red.subtle" borderRadius="xl" borderWidth="1px" borderColor="red.muted">
              <Card.Header p="5" pb="3">
                <Heading size="md" fontWeight="600" color="red.fg">
                  Danger Zone
                </Heading>
                <Text fontSize="sm" color="fg.muted" mt="1">
                  Permanently delete all your course history, planned courses, and program selections.
                </Text>
              </Card.Header>
              <Card.Body p="5" pt="2">
                <Alert.Root status="error" variant="subtle" borderRadius="lg" mb="4">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>This action is destructive</Alert.Title>
                    <Alert.Description>
                      Resetting progress removes your saved planning data and sends you back through setup.
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
                {!resetConfirming ? (
                  <Button
                    variant="solid"
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
