"use client";

import * as React from "react";

import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Circle,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import { ColorModeButton } from "@/components/ui/color-mode";
import {
  ProgressBar,
  ProgressLabel,
  ProgressRoot,
  ProgressValueText,
} from "@/components/ui/progress";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "@/components/ui/progress-circle";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuGraduationCap,
  LuCalendar,
  LuSettings,
  LuBell,
  LuChevronRight,
  LuSparkles,
  LuPlus,
  LuTrendingUp,
  LuClock,
  LuCircleCheck,
  LuCircleAlert,
  LuArrowRight,
  LuFileText,
  LuTarget,
  LuLogOut,
} from "react-icons/lu";

const mockRecentActivity = [
  {
    type: "course_added",
    message: "Added CS 350 to current semester",
    time: "2 hours ago",
  },
  {
    type: "requirement_met",
    message: "Completed General Education requirements",
    time: "1 day ago",
  },
  {
    type: "alert",
    message: "CS 361 has a prerequisite you haven't completed",
    time: "2 days ago",
  },
];

const navItems = [
  {
    icon: LuLayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    active: true,
  },
  {
    icon: LuBookOpen,
    label: "Courses",
    href: "/dashboard/courses",
    active: false,
  },
  {
    icon: LuTarget,
    label: "Requirements",
    href: "/dashboard/requirements",
    active: false,
  },
  {
    icon: LuCalendar,
    label: "Planner",
    href: "/dashboard/planner",
    active: false,
  },
  {
    icon: LuFileText,
    label: "Reports",
    href: "/dashboard/reports",
    active: false,
  },
];

export default function Dashboard() {
  const router = useRouter();

  type StudentRow = {
  id: number
  name: string | null
  email: string | null
  has_completed_onboarding: boolean | null
  expected_graduation_term: string | null
  expected_graduation_year: number | null
}

type DashboardStudent = {
  id: number
  name: string
  email: string
  major: string
  expectedGraduation: string
  hasCompletedOnboarding: boolean
}

const [student, setStudent] = React.useState<DashboardStudent | null>(null)
const [loadingStudent, setLoadingStudent] = React.useState(true)

type ProgressSummary = {
  overall: number
  totalCredits: number
  completedCredits: number
  inProgressCredits: number
  remainingCredits: number
}

const TOTAL_REQUIRED_CREDITS = 120

const [progress, setProgress] = React.useState<ProgressSummary>({
  overall: 0,
  totalCredits: TOTAL_REQUIRED_CREDITS,
  completedCredits: 0,
  inProgressCredits: 0,
  remainingCredits: TOTAL_REQUIRED_CREDITS,
})

const [loadingProgress, setLoadingProgress] = React.useState(true)

type RequirementBar = {
  name: string
  completed: number
  total: number
  percentage: number
  color: "green" | "blue" | "purple" | "orange"
}

const DEFAULT_REQUIREMENTS: RequirementBar[] = [
  { name: "General Education", completed: 0, total: 0, percentage: 0, color: "green" },
  { name: "Major Core", completed: 0, total: 0, percentage: 0, color: "blue" },
  { name: "Major Electives", completed: 0, total: 0, percentage: 0, color: "purple" },
  { name: "Free Electives", completed: 0, total: 0, percentage: 0, color: "orange" },
]

const [requirements, setRequirements] =
  React.useState<RequirementBar[]>(DEFAULT_REQUIREMENTS)

const [loadingRequirements, setLoadingRequirements] =
  React.useState(true)

type PlannedCourseCard = {
  code: string
  name: string
  credits: number
  status: "enrolled" | "waitlist" | "planned" | "unknown"
}

const [currentCourses, setCurrentCourses] = React.useState<PlannedCourseCard[]>([])
const [loadingCourses, setLoadingCourses] = React.useState(true)

React.useEffect(() => {
  const loadStudent = async () => {
    setLoadingStudent(true)
    const supabase = createClient()

    // 1) Logged-in user
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user) {
        router.push("/signin")
        return
      }

    // 2) Student row via auth_user_id
      const { data: studentRow, error: studentErr } = await supabase
        .from("students")
        .select(
          "id,name,email,has_completed_onboarding,expected_graduation_semester,expected_graduation_year"
        )
        .eq("auth_user_id", userData.user.id)
        .maybeSingle<StudentRow>()

        console.log("studentErr:", studentErr)
        console.log("studentRow:", studentRow)
        console.log("LOGGED IN AUTH ID:", userData.user.id)
        console.log("LOGGED IN EMAIL:", userData.user.email)

      if (studentErr || !studentRow) {
        toaster.create({
          title: "Profile not found",
          description: "We couldn't load your student profile.",
          type: "error",
        })
        setLoadingStudent(false)
        return
      }

    // 3) Major (student_programs -> programs)
      let majorName = "Unknown"
      let majorProgramId: number | null = null  // ✅ moved OUTSIDE so it’s in scope later

      const { data: studentPrograms, error: spErr } = await supabase
        .from("student_programs")
        .select("program_id")
        .eq("student_id", studentRow.id)

      if (!spErr && studentPrograms?.length) {
        const programIds = studentPrograms.map((sp: any) => sp.program_id)

        const { data: majorProgram, error: majorProgramErr } = await supabase
          .from("programs")
          .select("id,name")
          .in("id", programIds)
          .eq("program_type", "major")
          .maybeSingle()

        if (!majorProgramErr && majorProgram?.name) {
          majorName = majorProgram.name
          majorProgramId = majorProgram.id
        }
      }


    // 4) Degree requirements progress (blocks + courses vs student history)
      setLoadingRequirements(true)

      if (!majorProgramId) {
        setRequirements(DEFAULT_REQUIREMENTS)
        setLoadingRequirements(false)
      } else {
    // 4a) Get completed course ids (and credits)
        const { data: completedCourseRows, error: completedCoursesErr } = await supabase
          .from("student_course_history")
          .select(`
            course_id,
            courses:course_id (
              credits
            )
          `)
          .eq("student_id", studentRow.id)

        if (completedCoursesErr) {
          console.log("completedCoursesErr:", completedCoursesErr)
        }

        const completedCourseIds = new Set<number>(
          (completedCourseRows ?? [])
            .map((r: any) => Number(r?.course_id))
            .filter((x: number) => !Number.isNaN(x))
        )

    // 4b) Pull requirement blocks and the courses inside each block
        const { data: blocks, error: blocksErr } = await supabase
          .from("program_requirement_blocks")
          .select(`
            id,
            name,
            credits_required,
            program_requirement_courses (
              course_id,
              courses:course_id (
                credits
              )
            )
          `)
          .eq("program_id", majorProgramId)

        if (blocksErr) {
          console.log("blocksErr:", blocksErr)
          setRequirements(DEFAULT_REQUIREMENTS)
          setLoadingRequirements(false)
        } else {
          // helper to map block -> dashboard category + color
          const categorize = (blockName: string) => {
            const n = blockName.toLowerCase()
            if (n.includes("general")) return { key: "General Education", color: "green" as const }
            if (n.includes("core")) return { key: "Major Core", color: "blue" as const }
            if (n.includes("elective")) return { key: "Major Electives", color: "purple" as const }
            // fallback
            return { key: "Free Electives", color: "orange" as const }
          }

          // accumulate into the 4 fixed bars
          const agg: Record<string, { completed: number; total: number; color: RequirementBar["color"] }> =
            {
              "General Education": { completed: 0, total: 0, color: "green" },
              "Major Core": { completed: 0, total: 0, color: "blue" },
              "Major Electives": { completed: 0, total: 0, color: "purple" },
              "Free Electives": { completed: 0, total: 0, color: "orange" },
            }

          for (const b of blocks ?? []) {
            const { key, color } = categorize(String(b.name ?? ""))

            // total credits required: prefer credits_required, fallback to sum of credits in block
            const blockCourseRows = (b as any).program_requirement_courses ?? []
            const fallbackTotal = blockCourseRows.reduce((sum: number, r: any) => {
              return sum + Number(r?.courses?.credits ?? 0)
            }, 0)

            const total = Number((b as any).credits_required ?? fallbackTotal ?? 0)

            // completed credits in block: sum credits of block courses that appear in student_course_history
            const completed = blockCourseRows.reduce((sum: number, r: any) => {
              const cid = Number(r?.course_id)
              if (!completedCourseIds.has(cid)) return sum
              return sum + Number(r?.courses?.credits ?? 0)
            }, 0)

            agg[key].total += total
            agg[key].completed += completed
            agg[key].color = color
          }

          const bars: RequirementBar[] = Object.entries(agg).map(([name, v]) => {
            const total = Math.max(0, Math.round(v.total))
            const completed = Math.min(total, Math.round(v.completed))
            const percentage = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))
            return { name, completed, total, percentage, color: v.color }
          })

          setRequirements(bars)
          setLoadingRequirements(false)
        }
      }

    // 5) Current semester planned courses
      setLoadingCourses(true)

      const { data: plannedRows, error: plannedErr } = await supabase
        .from("student_planned_courses")
        .select(`
          status,
          courses:course_id (
            subject,
            number,
            title,
            credits
          )
        `)
        .eq("student_id", studentRow.id)

      if (plannedErr) {
        console.log("plannedErr:", plannedErr)
        // Don’t hard-fail the page if this section can’t load
        setCurrentCourses([])
        setLoadingCourses(false)
      } else {
        const mapped: PlannedCourseCard[] =
          (plannedRows ?? [])
            .map((r: any) => {
              const c = r.courses
              if (!c) return null

              const rawStatus = String(r.status ?? "").toLowerCase()
              const status: PlannedCourseCard["status"] =
                rawStatus === "enrolled"
                  ? "enrolled"
                  : rawStatus === "waitlist"
                    ? "waitlist"
                    : rawStatus
                      ? "planned"
                      : "unknown"

              return {
                code: `${c.subject} ${c.number}`.trim(),
                name: c.title ?? "Untitled course",
                credits: Number(c.credits ?? 0),
                status,
              }
            })
            .filter((c): c is PlannedCourseCard => c !== null)

        setCurrentCourses(mapped as PlannedCourseCard[])
        setLoadingCourses(false)
      }

    // 6) Progress (completed + in-progress credits)
      setLoadingProgress(true)

    // 6a) Completed credits from student_course_history -> courses
      const { data: completedRows, error: completedErr } = await supabase
        .from("student_course_history")
        .select(
          `
            courses:course_id (
              credits
            )
          `
        )
        .eq("student_id", studentRow.id)

      if (completedErr) {
        console.log("completedErr:", completedErr)
      }

      // Sum completed credits
      const completedCredits =
        (completedRows ?? []).reduce((sum: number, r: any) => {
          const credits = Number(r?.courses?.credits ?? 0)
          return sum + credits
        }, 0)

    
    // 6b) In-progress credits from student_planned_courses -> courses
      const { data: plannedCreditRows, error: plannedCreditErr } = await supabase
        .from("student_planned_courses")
        .select(`
          status,
          courses:course_id (
            credits
          )
        `)
        .eq("student_id", studentRow.id)

      if (plannedCreditErr) {
        console.log("plannedCreditErr:", plannedCreditErr)
      }

      // only enrolled/waitlist
      const inProgressCredits =
        (plannedCreditRows ?? []).reduce((sum: number, r: any) => {
          const s = String(r?.status ?? "").toLowerCase()
          if (s !== "enrolled" && s !== "waitlist") return sum
          return sum + Number(r?.courses?.credits ?? 0)
        }, 0)

      // Compute summary
      const totalCredits = TOTAL_REQUIRED_CREDITS
      const remainingCredits = Math.max(totalCredits - completedCredits, 0)
      const overall = Math.min(
        100,
        Math.round((completedCredits / totalCredits) * 100)
      )

      setProgress({
        overall,
        totalCredits,
        completedCredits,
        inProgressCredits,
        remainingCredits,
      })

      setLoadingProgress(false)  

    // 7) Expected graduation display
      const expectedGraduation =
        `${studentRow.expected_graduation_term ?? ""} ${studentRow.expected_graduation_year ?? ""}`.trim() || "—"

      setStudent({
        id: studentRow.id,
        name: studentRow.name ?? "",
        email: studentRow.email ?? "",
        major: majorName,
        expectedGraduation,
        hasCompletedOnboarding: !!studentRow.has_completed_onboarding,
      })

      setLoadingStudent(false)
  }

  loadStudent()
}, [router])

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toaster.create({
      title: "Signed out",
      description: "You've been signed out successfully.",
      type: "success",
    });
    router.push("/signin");
  }

  if (loadingStudent) {
  return <Box p="8">Loading...</Box>
}

if (!student) {
  return null
}

  return (
    <Box minH="100vh" bg="bg" fontFamily="'Plus Jakarta Sans', sans-serif">
      <Flex>
        {/* Sidebar */}
        <Box
          as="aside"
          w="260px"
          minH="100vh"
          bg="bg"
          borderRightWidth="1px"
          borderColor="border.subtle"
          position="fixed"
          left="0"
          top="0"
          display={{ base: "none", lg: "flex" }}
          flexDirection="column"
        >
          {/* Logo */}
          <HStack
            gap="3"
            px="6"
            py="5"
            borderBottomWidth="1px"
            borderColor="border.subtle"
          >
            <Box p="2" bg="green.solid" borderRadius="lg">
              <Icon color="white" boxSize="5">
                <LuGraduationCap />
              </Icon>
            </Box>
            <Text
              fontWeight="700"
              fontSize="lg"
              fontFamily="'DM Serif Display', serif"
              letterSpacing="-0.02em"
            >
              GradTracker
            </Text>
          </HStack>

          {/* Navigation */}
          <VStack align="stretch" flex="1" py="4" px="3" gap="1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{ textDecoration: "none" }}
              >
                <HStack
                  px="4"
                  py="2.5"
                  borderRadius="lg"
                  cursor="pointer"
                  bg={item.active ? "green.subtle" : "transparent"}
                  color={item.active ? "green.fg" : "fg.muted"}
                  fontWeight={item.active ? "600" : "500"}
                  _hover={{
                    bg: item.active ? "green.subtle" : "bg.subtle",
                    color: item.active ? "green.fg" : "fg",
                  }}
                  transition="all 0.15s"
                  className={item.active ? "sidebar-item-active" : ""}
                >
                  <Icon boxSize="5">
                    <item.icon />
                  </Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            ))}
          </VStack>

          {/* Bottom section */}
          <VStack
            align="stretch"
            p="4"
            gap="2"
            borderTopWidth="1px"
            borderColor="border.subtle"
          >
            <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
              <HStack
                px="4"
                py="2.5"
                borderRadius="lg"
                cursor="pointer"
                color="fg.muted"
                fontWeight="500"
                _hover={{ bg: "bg.subtle", color: "fg" }}
                transition="all 0.15s"
              >
                <Icon boxSize="5">
                  <LuSettings />
                </Icon>
                <Text fontSize="sm">Settings</Text>
              </HStack>
            </Link>
            <HStack
              px="4"
              py="2.5"
              borderRadius="lg"
              cursor="pointer"
              color="fg.muted"
              fontWeight="500"
              _hover={{ bg: "red.subtle", color: "red.fg" }}
              transition="all 0.15s"
              onClick={handleSignOut}
            >
              <Icon boxSize="5">
                <LuLogOut />
              </Icon>
              <Text fontSize="sm">Sign Out</Text>
            </HStack>
          </VStack>
        </Box>

        {/* Main Content */}
        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          minH="100vh"
          className="mesh-gradient-subtle"
        >
          {/* Header */}
          <Box
            as="header"
            position="sticky"
            top="0"
            bg="bg"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            zIndex="sticky"
            className="glass-card"
          >
            <Flex
              justify="space-between"
              align="center"
              px={{ base: "4", md: "8" }}
              py="4"
            >
              <Box>
                <Text fontSize="sm" color="fg.muted" fontWeight="500">
                  Welcome back,
                </Text>
                <Heading
                  size="lg"
                  fontFamily="'DM Serif Display', serif"
                  fontWeight="400"
                  letterSpacing="-0.02em"
                >
                  {student.name}
                </Heading>
              </Box>

              <HStack gap="3">
                <IconButton
                  aria-label="Notifications"
                  variant="ghost"
                  size="sm"
                  position="relative"
                >
                  <LuBell />
                  <Circle
                    size="2"
                    bg="red.500"
                    position="absolute"
                    top="1.5"
                    right="1.5"
                  />
                </IconButton>
                <ColorModeButton variant="ghost" size="sm" />
                <Avatar.Root size="sm">
                  <Avatar.Fallback name={student.name} />
                </Avatar.Root>
              </HStack>
            </Flex>
          </Box>

          {/* Dashboard Content */}
          <Box px={{ base: "4", md: "8" }} py="6">
            <Stack gap="6">
              {/* Onboarding Banner */}
              {!student.hasCompletedOnboarding && (
                <Card.Root
                  className="animate-fade-up"
                  borderRadius="2xl"
                  overflow="hidden"
                  position="relative"
                  bgGradient="to-br"
                  gradientFrom="green.600"
                  gradientVia="green.500"
                  gradientTo="teal.500"
                >
                  {/* Decorative elements */}
                  <Box
                    position="absolute"
                    top="-50%"
                    right="-10%"
                    w="300px"
                    h="300px"
                    bg="whiteAlpha.100"
                    borderRadius="full"
                  />
                  <Box
                    position="absolute"
                    bottom="-30%"
                    left="20%"
                    w="200px"
                    h="200px"
                    bg="whiteAlpha.100"
                    borderRadius="full"
                  />

                  <Card.Body
                    p={{ base: "6", md: "8" }}
                    position="relative"
                    zIndex="1"
                  >
                    <Flex
                      direction={{ base: "column", md: "row" }}
                      justify="space-between"
                      align={{ base: "start", md: "center" }}
                      gap="4"
                    >
                      <HStack gap="4" align="start">
                        <Flex
                          align="center"
                          justify="center"
                          w="12"
                          h="12"
                          bg="whiteAlpha.200"
                          borderRadius="xl"
                          flexShrink={0}
                        >
                          <Icon color="white" boxSize="6">
                            <LuSparkles />
                          </Icon>
                        </Flex>
                        <Box>
                          <Heading
                            size="md"
                            color="white"
                            fontWeight="600"
                            mb="1"
                          >
                            Complete Your Profile Setup
                          </Heading>
                          <Text color="whiteAlpha.800" fontSize="sm" maxW="md">
                            Add your completed courses and select your degree
                            program to get personalized graduation tracking and
                            recommendations.
                          </Text>
                        </Box>
                      </HStack>
                      <Link href="/dashboard/onboarding">
                        <Button
                          bg="white"
                          color="green.700"
                          size="lg"
                          rounded="full"
                          px="6"
                          fontWeight="600"
                          _hover={{
                            bg: "whiteAlpha.900",
                            transform: "translateY(-1px)",
                          }}
                          transition="all 0.2s"
                          flexShrink={0}
                        >
                          Start Setup
                          <Icon ml="2">
                            <LuArrowRight />
                          </Icon>
                        </Button>
                      </Link>
                    </Flex>
                  </Card.Body>
                </Card.Root>
              )}

              {/* Stats Grid - 2/3 + 1/3 layout to match main grid below */}
              <Grid
                templateColumns={{ base: "1fr", xl: "2fr 1fr" }}
                gap="6"
                className="animate-fade-up-delay-1"
              >
                {/* Left side: 2 stat cards taking 2/3 */}
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  {/* Overall Progress Card */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Card.Body p="5">
                      <HStack justify="space-between" align="start" mb="4">
                        <Box>
                          <Text
                            fontSize="sm"
                            color="fg.muted"
                            fontWeight="500"
                            mb="1"
                          >
                            Overall Progress
                          </Text>
                          <Text fontSize="2xl" fontWeight="700">
                            {loadingProgress ? "—" : `${progress.overall}%`}
                          </Text>
                        </Box>
                        <ProgressCircleRoot
                          value={progress.overall}
                          size="md"
                          colorPalette="green"
                        >
                          <ProgressCircleRing
                            cap="round"
                            css={{ "--thickness": "4px" }}
                          />
                        </ProgressCircleRoot>
                      </HStack>
                      <HStack gap="1" fontSize="xs" color="fg.muted">
                        <Icon color="green.fg">
                          <LuTrendingUp />
                        </Icon>
                        <Text>On track to graduate</Text>
                      </HStack>
                    </Card.Body>
                  </Card.Root>

                  {/* Credits Completed */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Card.Body p="5">
                      <HStack justify="space-between" align="start" mb="4">
                        <Box>
                          <Text
                            fontSize="sm"
                            color="fg.muted"
                            fontWeight="500"
                            mb="1"
                          >
                            Credits Completed
                          </Text>
                          <HStack align="baseline" gap="1">
                            <Text fontSize="2xl" fontWeight="700">
                              {progress.completedCredits}
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                              / {progress.totalCredits}
                            </Text>
                          </HStack>
                        </Box>
                        <Flex
                          align="center"
                          justify="center"
                          w="10"
                          h="10"
                          bg="blue.subtle"
                          borderRadius="lg"
                        >
                          <Icon color="blue.fg" boxSize="5">
                            <LuCircleCheck />
                          </Icon>
                        </Flex>
                      </HStack>
                      <HStack gap="1" fontSize="xs" color="fg.muted">
                        <Text>
                          {progress.remainingCredits} credits remaining
                        </Text>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                </SimpleGrid>

                {/* Right side: 1 stat card taking 1/3 */}
                <Card.Root
                  bg="bg"
                  borderRadius="xl"
                  borderWidth="1px"
                  borderColor="border.subtle"
                >
                  <Card.Body p="5">
                    <HStack justify="space-between" align="start" mb="3">
                      <Box>
                        <Text
                          fontSize="sm"
                          color="fg.muted"
                          fontWeight="500"
                          mb="1"
                        >
                          In Progress
                        </Text>
                        <HStack align="baseline" gap="1">
                          <Text fontSize="2xl" fontWeight="700">
                            {progress.inProgressCredits}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            credits
                          </Text>
                        </HStack>
                      </Box>
                      <Flex
                        align="center"
                        justify="center"
                        w="10"
                        h="10"
                        bg="orange.subtle"
                        borderRadius="lg"
                      >
                        <Icon color="orange.fg" boxSize="5">
                          <LuClock />
                        </Icon>
                      </Flex>
                    </HStack>
                    <HStack gap="1" fontSize="xs" color="fg.muted">
                      <Text>This semester</Text>
                    </HStack>
                  </Card.Body>
                </Card.Root>
              </Grid>

              {/* Main Grid */}
              <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap="6">
                {/* Left Column */}
                <Stack gap="6">
                  {/* Requirements Progress */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up-delay-2"
                  >
                    <Card.Header p="5" pb="0">
                      <Flex justify="space-between" align="center">
                        <Heading size="md" fontWeight="600">
                          Degree Requirements
                        </Heading>
                        <Link href="/dashboard/requirements">
                          <Button variant="ghost" size="sm" fontWeight="500">
                            View All
                            <Icon ml="1">
                              <LuChevronRight />
                            </Icon>
                          </Button>
                        </Link>
                      </Flex>
                    </Card.Header>
                    <Card.Body p="5">
                      <Stack gap="5">
                        {requirements.map((req) => (
                          <Box key={req.name}>
                            <ProgressRoot
                              value={req.percentage}
                              colorPalette={req.color}
                              size="sm"
                            >
                              <HStack justify="space-between" mb="2">
                                <ProgressLabel fontWeight="500" fontSize="sm">
                                  {req.name}
                                </ProgressLabel>
                                <HStack gap="2">
                                  <Text fontSize="xs" color="fg.muted">
                                    {loadingRequirements ? "Loading..." : `${req.completed}/${req.total} credits`}
                                  </Text>
                                  <ProgressValueText
                                    fontWeight="600"
                                    fontSize="sm"
                                  />
                                </HStack>
                              </HStack>
                              <ProgressBar borderRadius="full" />
                            </ProgressRoot>
                          </Box>
                        ))}
                      </Stack>
                    </Card.Body>
                  </Card.Root>

                  {/* Current Courses */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up-delay-3"
                  >
                    <Card.Header p="5" pb="0">
                      <Flex justify="space-between" align="center">
                        <Heading size="md" fontWeight="600">
                          Current Semester
                        </Heading>
                        <Link href="/dashboard/courses">
                          <Button variant="ghost" size="sm" fontWeight="500">
                            Manage Courses
                            <Icon ml="1">
                              <LuChevronRight />
                            </Icon>
                          </Button>
                        </Link>
                      </Flex>
                    </Card.Header>
                    <Card.Body p="5">
                      <Stack gap="3">
                        {loadingCourses ? (
                          <Box p="4" bg="bg.subtle" borderRadius="lg">
                            <Text fontSize="sm" color="fg.muted">
                              Loading current semester courses...
                            </Text>
                          </Box>
                        ) : currentCourses.length === 0 ? (
                          <Box p="4" bg="bg.subtle" borderRadius="lg">
                            <Text fontWeight="600" fontSize="sm" mb="1">
                              No courses planned yet
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                              Once you complete onboarding and add your semester plan, your courses will appear here.
                            </Text>
                          </Box>
                        ) : (
                          currentCourses.map((course) => (
                            <Flex
                              key={`${course.code}-${course.name}`}
                              p="4"
                              bg="bg.subtle"
                              borderRadius="lg"
                              justify="space-between"
                              align="center"
                              _hover={{ bg: "bg.muted" }}
                              transition="background 0.15s"
                              cursor="pointer"
                            >
                              <HStack gap="4">
                                <Box
                                  w="10"
                                  h="10"
                                  bg="green.subtle"
                                  borderRadius="lg"
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                >
                                  <Icon color="green.fg" boxSize="5">
                                    <LuBookOpen />
                                  </Icon>
                                </Box>
                                <Box>
                                  <Text fontWeight="600" fontSize="sm">
                                    {course.code}
                                  </Text>
                                  <Text color="fg.muted" fontSize="sm">
                                    {course.name}
                                  </Text>
                                </Box>
                              </HStack>

                              <HStack gap="3">
                                <Text fontSize="sm" color="fg.muted">
                                  {course.credits} credits
                                </Text>
                                <Badge
                                  colorPalette={course.status === "enrolled" ? "green" : course.status === "waitlist" ? "orange" : "gray"}
                                  variant="subtle"
                                  size="sm"
                                >
                                  {course.status === "enrolled"
                                    ? "Enrolled"
                                    : course.status === "waitlist"
                                      ? "Waitlist"
                                      : "Planned"}
                                </Badge>
                              </HStack>
                            </Flex>
                          ))
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          w="full"
                          mt="2"
                          borderStyle="dashed"
                        >
                          <Icon mr="2">
                            <LuPlus />
                          </Icon>
                          Add Course
                        </Button>
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                </Stack>

                {/* Right Column */}
                <Stack gap="6">
                  {/* Student Info Card */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up-delay-2"
                  >
                    <Card.Body p="5">
                      <VStack align="center" gap="4">
                        <Avatar.Root size="xl" colorPalette="green">
                          <Avatar.Fallback name={student.name} />
                        </Avatar.Root>
                        <VStack gap="1">
                          <Text fontWeight="600" fontSize="lg">
                            {student.name}
                          </Text>
                          <Text color="fg.muted" fontSize="sm">
                            {student.email}
                          </Text>
                        </VStack>
                        <VStack gap="2" w="full" pt="2">
                          <HStack justify="space-between" w="full">
                            <Text fontSize="sm" color="fg.muted">
                              Major
                            </Text>
                            <Text fontSize="sm" fontWeight="500">
                              {student.major}
                            </Text>
                          </HStack>
                          <HStack justify="space-between" w="full">
                            <Text fontSize="sm" color="fg.muted">
                              Expected Graduation
                            </Text>
                            <Badge
                              colorPalette="green"
                              variant="subtle"
                              size="sm"
                            >
                              {student.expectedGraduation}
                            </Badge>
                          </HStack>
                        </VStack>
                      </VStack>
                    </Card.Body>
                  </Card.Root>

                  {/* Recent Activity */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up-delay-3"
                  >
                    <Card.Header p="5" pb="0">
                      <Heading size="md" fontWeight="600">
                        Recent Activity
                      </Heading>
                    </Card.Header>
                    <Card.Body p="5">
                      <Stack gap="4">
                        {mockRecentActivity.map((activity, index) => (
                          <HStack key={index} gap="3" align="start">
                            <Flex
                              align="center"
                              justify="center"
                              w="8"
                              h="8"
                              bg={
                                activity.type === "alert"
                                  ? "orange.subtle"
                                  : activity.type === "requirement_met"
                                    ? "green.subtle"
                                    : "blue.subtle"
                              }
                              borderRadius="full"
                              flexShrink={0}
                            >
                              <Icon
                                boxSize="4"
                                color={
                                  activity.type === "alert"
                                    ? "orange.fg"
                                    : activity.type === "requirement_met"
                                      ? "green.fg"
                                      : "blue.fg"
                                }
                              >
                                {activity.type === "alert" ? (
                                  <LuCircleAlert />
                                ) : activity.type === "requirement_met" ? (
                                  <LuCircleCheck />
                                ) : (
                                  <LuPlus />
                                )}
                              </Icon>
                            </Flex>
                            <Box flex="1">
                              <Text
                                fontSize="sm"
                                fontWeight="500"
                                lineHeight="short"
                              >
                                {activity.message}
                              </Text>
                              <Text fontSize="xs" color="fg.muted" mt="0.5">
                                {activity.time}
                              </Text>
                            </Box>
                          </HStack>
                        ))}
                      </Stack>
                    </Card.Body>
                  </Card.Root>

                  {/* Quick Actions */}
                  <Card.Root
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up-delay-4"
                  >
                    <Card.Header p="5" pb="0">
                      <Heading size="md" fontWeight="600">
                        Quick Actions
                      </Heading>
                    </Card.Header>
                    <Card.Body p="5">
                      <Stack gap="2">
                        <Button
                          variant="outline"
                          justifyContent="start"
                          size="sm"
                          fontWeight="500"
                        >
                          <Icon mr="2">
                            <LuFileText />
                          </Icon>
                          Generate Progress Report
                        </Button>
                        <Button
                          variant="outline"
                          justifyContent="start"
                          size="sm"
                          fontWeight="500"
                        >
                          <Icon mr="2">
                            <LuCalendar />
                          </Icon>
                          Plan Next Semester
                        </Button>
                        <Button
                          variant="outline"
                          justifyContent="start"
                          size="sm"
                          fontWeight="500"
                        >
                          <Icon mr="2">
                            <LuTarget />
                          </Icon>
                          Review Requirements
                        </Button>
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                </Stack>
              </Grid>
            </Stack>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
