"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Avatar,
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
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuLock, LuCalendar, LuBell, LuUpload } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

type NotifPrefs = {
  notif_requirement_alerts: boolean;
  notif_semester_reminders: boolean;
  notif_graduation_reminders: boolean;
  notif_weekly_digest: boolean;
};

type ProfileTable = "students" | "staff";

const STAFF_TABLE: ProfileTable = "staff";
const PROFILE_IMAGE_BUCKET = "profile-images";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [gradSemester, setGradSemester] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  const [studentId, setStudentId] = useState<number | null>(null);

  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileTable, setProfileTable] = useState<ProfileTable | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingGrad, setSavingGrad] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isStudent = profileTable === DB_TABLES.students;

  const loadAvatarSignedUrl = async (path: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (error) throw error;
    return data.signedUrl;
  };

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        setAuthUserId(user.id);
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");

        // 1) Try students table first
        const { data: student } = await supabase
          .from(DB_TABLES.students)
          .select(
            "id, first_name, last_name, expected_graduation_semester, expected_graduation_year, avatar_path"
          )
          .eq(STUDENT_COLUMNS.authUserId, user.id)
          .maybeSingle();

        if (student) {
          setProfileTable(DB_TABLES.students as ProfileTable);
          setProfileId(student.id);
          setStudentId(student.id);

          setFirstName(student.first_name ?? "");
          setLastName(student.last_name ?? "");
          setGradSemester(student.expected_graduation_semester ?? "");
          setGradYear(student.expected_graduation_year ? String(student.expected_graduation_year) : "");

          setAvatarPath(student.avatar_path ?? null);
          if (student.avatar_path) {
            try {
              const signed = await loadAvatarSignedUrl(student.avatar_path);
              setAvatarUrl(signed);
            } catch (e: unknown) {
              console.error("Failed to load student avatar:", e);
            }
          }

          // Load notification preferences for students only
          const { data: prefs } = await supabase
            .from(DB_TABLES.notificationPreferences)
            .select(
              "notif_requirement_alerts, notif_semester_reminders, notif_graduation_reminders, notif_weekly_digest"
            )
            .eq("student_id", student.id)
            .maybeSingle();

          if (prefs) {
            setNotifPrefs({
              notif_requirement_alerts:
                prefs.notif_requirement_alerts ?? DEFAULT_PREFS.notif_requirement_alerts,
              notif_semester_reminders:
                prefs.notif_semester_reminders ?? DEFAULT_PREFS.notif_semester_reminders,
              notif_graduation_reminders:
                prefs.notif_graduation_reminders ?? DEFAULT_PREFS.notif_graduation_reminders,
              notif_weekly_digest: prefs.notif_weekly_digest ?? DEFAULT_PREFS.notif_weekly_digest,
            });
          }

          setLoading(false);
          return;
        }

        // 2) If not a student, try staff table
        const { data: staff } = await supabase
          .from(STAFF_TABLE)
          .select("id, first_name, last_name, avatar_path")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (staff) {
          setProfileTable(STAFF_TABLE);
          setProfileId(staff.id);

          setFirstName(staff.first_name ?? "");
          setLastName(staff.last_name ?? "");

          setAvatarPath(staff.avatar_path ?? null);
          if (staff.avatar_path) {
            try {
              const signed = await loadAvatarSignedUrl(staff.avatar_path);
              setAvatarUrl(signed);
            } catch (e: unknown) {
              console.error("Failed to load staff avatar:", e);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleSaveName = async () => {
    if (!profileId || !profileTable) return;

    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(profileTable)
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq("id", profileId);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;
    if (!profileId || !profileTable || !authUserId) {
      toaster.create({
        title: "Profile not loaded",
        description: "We couldn't determine whether you're a student or staff user.",
        type: "error",
      });
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toaster.create({
        title: "Invalid file type",
        description: "Please upload a PNG, JPEG, or WEBP image.",
        type: "error",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toaster.create({
        title: "File too large",
        description: "Please upload an image smaller than 5 MB.",
        type: "error",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSavingAvatar(true);

    try {
      const supabase = createClient();

      const ext =
        file.name.split(".").pop()?.toLowerCase() ||
        (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");

      const newPath = `${profileTable}/${authUserId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_IMAGE_BUCKET)
        .upload(newPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from(profileTable)
        .update({ avatar_path: newPath })
        .eq("id", profileId);

      if (updateError) throw updateError;

      if (avatarPath && avatarPath !== newPath) {
        await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([avatarPath]);
      }

      const signedUrl = await loadAvatarSignedUrl(newPath);

      setAvatarPath(newPath);
      setAvatarUrl(signedUrl);

      toaster.create({
        title: "Profile picture updated",
        type: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({
        title: "Failed to update profile picture",
        description: msg,
        type: "error",
      });
    } finally {
      setSavingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <Box p="8">Loading...</Box>;
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

      {/* Profile Photo */}
      <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Header p="5" pb="3">
          <Heading size="md" fontWeight="600">
            Profile Picture
          </Heading>
          <Text fontSize="sm" color="fg.muted" mt="1">
            Upload a JPG, PNG, or WEBP image up to 5 MB.
          </Text>
        </Card.Header>
        <Card.Body p="5" pt="2">
          <Stack gap="4">
            <HStack gap="4" align="center">
              <Avatar.Root size="2xl" colorPalette="green">
                <Avatar.Fallback name={`${firstName} ${lastName}`.trim() || email} />
                {avatarUrl ? <Avatar.Image src={avatarUrl} alt="Profile picture" /> : null}
              </Avatar.Root>

              <Stack gap="2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelected}
                  style={{ display: "none" }}
                />

                <Button
                  colorPalette="green"
                  onClick={handleAvatarClick}
                  loading={savingAvatar}
                  borderRadius="lg"
                  alignSelf="flex-start"
                >
                  <Icon mr="2">
                    <LuUpload />
                  </Icon>
                  {avatarUrl ? "Change Photo" : "Upload Photo"}
                </Button>

                <Text fontSize="xs" color="fg.muted">
                  Recommended: square image, 5 MB max.
                </Text>
              </Stack>
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>

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
              colorPalette="green"
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
              colorPalette="green"
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

      {/* Student-only sections */}
      {isStudent && (
        <>
          {/* Expected Graduation */}
          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
            <Card.Header p="5" pb="3">
              <Flex align="center" gap="2">
                <Icon color="green.fg">
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
                      _focus={{ outline: "2px solid", outlineColor: "green.fg", outlineOffset: "2px" }}
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
                  colorPalette="green"
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
                <Icon color="green.fg">
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
                      colorPalette="green"
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
                  colorPalette="green"
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
        </>
      )}

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
            <Button colorPalette="green" alignSelf="flex-start" borderRadius="lg">
              <Icon mr="2">
                <LuLock />
              </Icon>
              Reset Password
            </Button>
          </Link>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}