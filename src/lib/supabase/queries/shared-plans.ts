import { createAdminClient } from "@/lib/supabase/admin";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import type { Course } from "@/types/course";
import type { PlannedCourseWithDetails, Term } from "@/types/planner";
import type {
  ComparablePlanDetail,
  OwnPlanSummary,
  SharedPlanDetail,
  SharedPlanSummary,
} from "@/types/shared-plan";

const PLAN_SHARES_TABLE = "plan_shares";

function isActiveShare(share: { is_active?: boolean | null; expires_at?: string | null }) {
  if (share.is_active === false) {
    return false;
  }

  if (share.expires_at) {
    return new Date(share.expires_at).getTime() > Date.now();
  }

  return true;
}

function mapPlannedCourses(rows: any[] | null | undefined): PlannedCourseWithDetails[] {
  return (rows ?? []).map((row: any) => ({
    student_id: row.student_id,
    term_id: row.term_id,
    course_id: row.course_id,
    status: row.status,
    plan_id: row.plan_id,
    course: row.courses as Course,
    requirementLabel: row.requirement_label ?? null,
  }));
}

function normalizeFirstName(value: string | null | undefined) {
  return value?.trim() || "Student";
}

function createMockPlannedCourse(
  planId: number,
  termId: number,
  course: Course,
  requirementLabel?: string
): PlannedCourseWithDetails {
  return {
    student_id: 0,
    term_id: termId,
    course_id: course.id,
    status: "planned",
    plan_id: planId,
    course,
    requirementLabel: requirementLabel ?? null,
  };
}

async function fetchComparablePlanDetail(
  supabase: any,
  planId: number,
  ownerLabel: string
): Promise<(ComparablePlanDetail & { studentId: number }) | null> {
  const { data: plan, error: planError } = await supabase
    .from(DB_TABLES.plans)
    .select("id, student_id, name, description")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    return null;
  }

  const [programRes, termsRes, coursesRes, completedRes] = await Promise.all([
    supabase
      .from(DB_TABLES.planPrograms)
      .select("plan_id, programs:program_id (name)")
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("term_id, terms:term_id (id, season, year)")
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select(
        `
          student_id,
          term_id,
          course_id,
          status,
          plan_id,
          courses:course_id (id, subject, number, title, credits)
        `
      )
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentCourseHistory)
      .select("courses:course_id (credits)")
      .eq("student_id", plan.student_id),
  ]);

  const programNames = (programRes.data ?? [])
    .map((row: any) => row.programs?.name)
    .filter((name: string | undefined): name is string => Boolean(name));

  const terms = (termsRes.data ?? [])
    .map((row: any) => row.terms as Term)
    .filter(Boolean);

  const plannedCourses = mapPlannedCourses(coursesRes.data);
  const totalPlannedCredits = plannedCourses.reduce(
    (sum, item) => sum + (item.course?.credits ?? 0),
    0
  );
  const completedCredits = (completedRes.data ?? []).reduce((sum: number, row: any) => {
    return sum + Number(row.courses?.credits ?? 0);
  }, 0);

  return {
    planId: plan.id,
    planName: plan.name,
    description: plan.description,
    ownerLabel,
    studentId: plan.student_id,
    programNames,
    terms,
    plannedCourses,
    totalPlannedCredits,
    completedCredits,
  };
}

export async function fetchSharedPlanByToken(
  shareToken: string
): Promise<SharedPlanDetail | null> {
  const supabase = createAdminClient();

  if (!supabase || !shareToken) {
    // Dev fallback: return a static shared plan when admin client isn't available
    if (shareToken === "cs-4yr") {
      const planId = 1000;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "Computer Science Major 4 Year Plan",
        description:
          "A typical 4-year computer science curriculum showing semester-by-semester pacing.",
        ownerLabel: "Shared plan",
        programNames: ["B.S. Computer Science"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 93, subject: "MATH", number: "111", title: "College Algebra I", credits: 5 }, "Math Preparation"),
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Written Communication"),
          createMockPlannedCourse(planId, 1, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "World Language I"),
          createMockPlannedCourse(planId, 1, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 1, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),

          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Written Communication"),
          createMockPlannedCourse(planId, 2, { id: 97, subject: "MATH", number: "114", title: "College Algebra II/Trigonometry", credits: 5 }, "Math Preparation"),
          createMockPlannedCourse(planId, 2, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 2, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),

          createMockPlannedCourse(planId, 3, { id: 51, subject: "CSCI", number: "241", title: "Computer Science I", credits: 5 }, "Required Major"),
          createMockPlannedCourse(planId, 3, { id: 50, subject: "CSCI", number: "231", title: "Discrete Mathematics", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 3, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "World Language II"),
          createMockPlannedCourse(planId, 3, { id: 1048, subject: "HIST", number: "101", title: "The United States: Origins to Reconstruction", credits: 3 }, "Gen Ed: Social and Behavioral Science"),

          createMockPlannedCourse(planId, 4, { id: 52, subject: "CSCI", number: "242", title: "Computer Science II", credits: 4 }, "Required Major"),
          createMockPlannedCourse(planId, 4, { id: 98, subject: "MATH", number: "221", title: "Calculus and Analytic Geometry I", credits: 5 }, "Required Mathematics"),
          createMockPlannedCourse(planId, 4, { id: 1848, subject: "PHYS", number: "201", title: "General Physics I", credits: 5 }, "Required Science"),

          createMockPlannedCourse(planId, 5, { id: 53, subject: "CSCI", number: "245", title: "Assembly Language Programming", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 5, { id: 67, subject: "CSCI", number: "380", title: "Database Management Systems", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 5, { id: 81, subject: "CSCI", number: "444", title: "Event-Driven Programming", credits: 3 }, "Major Elective"),
          createMockPlannedCourse(planId, 5, { id: 1882, subject: "PMGT", number: "341", title: "Basics of Project Management", credits: 3 }, "Computer Science Breadth"),
          createMockPlannedCourse(planId, 5, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 6, { id: 58, subject: "CSCI", number: "309", title: "Probability and Statistics", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 6, { id: 62, subject: "CSCI", number: "333", title: "Programming Languages", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 6, { id: 63, subject: "CSCI", number: "340", title: "Data Structures and Algorithm Design", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 6, { id: 64, subject: "CSCI", number: "355", title: "Computer Architecture", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 6, { id: 82, subject: "CSCI", number: "445", title: "Web Application Security", credits: 3 }, "Major Elective"),

          createMockPlannedCourse(planId, 7, { id: 66, subject: "CSCI", number: "370", title: "Operating Systems", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 7, { id: 666, subject: "CSCI", number: "495", title: "Computer Science Seminar", credits: 2 }, "Required Major"),
          createMockPlannedCourse(planId, 7, { id: 85, subject: "CSCI", number: "475", title: "Software Engineering Principles and Practice I", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 7, { id: 945, subject: "GEOG", number: "350", title: "Cartography and GIS", credits: 3 }, "Computer Science Breadth"),
          createMockPlannedCourse(planId, 7, { id: 382, subject: "BUS", number: "272", title: "Legal Environment of Business", credits: 3 }, "Computer Science Breadth"),

          createMockPlannedCourse(planId, 8, { id: 86, subject: "CSCI", number: "476", title: "Software Engineering Principles and Practice II", credits: 3 }, "Required Major"),
          createMockPlannedCourse(planId, 8, { id: 87, subject: "CSCI", number: "477", title: "Computer Communications and Networks", credits: 3 }, "Major Elective"),
          createMockPlannedCourse(planId, 8, { id: 90, subject: "CSCI", number: "480", title: "Advanced Databases", credits: 3 }, "Major Elective"),
          createMockPlannedCourse(planId, 8, { id: 1249, subject: "MATH", number: "301", title: "Linear Algebra", credits: 4 }, "Computer Science Breadth"),
          createMockPlannedCourse(planId, 8, { id: 1812, subject: "PHIL", number: "215", title: "Contemporary Moral Problems", credits: 3 }, "Gen Ed: Humanities and the Arts"),
        ],
        totalPlannedCredits: 121,
        completedCredits: 0,
        shareToken: "cs-4yr",
        studentFirstName: "Alex",
        expiresAt: null,
      };

      return mockPlan;
    }

    if (shareToken === "acct-4yr") {
      const planId = 1001;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "Accounting Major 4 Year Plan",
        description:
          "A typical 4-year accounting curriculum showing semester-by-semester pacing.",
        ownerLabel: "Shared plan",
        programNames: ["B.S. Accounting"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 1235, subject: "MATH", number: "104", title: "College Mathematics with Applications", credits: 4 }, "Skills: Computational Skills"),
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 1, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 1, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "Foreign Language I"),

          createMockPlannedCourse(planId, 2, { id: 1986, subject: "QM", number: "110", title: "Applied Quantitative Analysis in Business", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 2, { id: 702, subject: "ECON", number: "121", title: "Principles of Macroeconomics", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 2, { id: 511, subject: "COMM", number: "105", title: "Public Speaking for the 21st Century", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 2, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "Foreign Language II"),

          createMockPlannedCourse(planId, 3, { id: 701, subject: "ECON", number: "120", title: "Principles of Microeconomics", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 3, { id: 1987, subject: "QM", number: "210", title: "Business Statistics I", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 3, { id: 127, subject: "ACCT", number: "201", title: "Financial Accounting", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 3, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 3, { id: 314, subject: "BIOS", number: "100", title: "Nature of Life", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 4, { id: 128, subject: "ACCT", number: "202", title: "Managerial Accounting", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 4, { id: 382, subject: "BUS", number: "272", title: "Legal Environment of Business", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 4, { id: 102, subject: "QM", number: "310", title: "Business Statistics II", credits: 3 }, "Business Foundation"),
          createMockPlannedCourse(planId, 4, { id: 786, subject: "ENGL", number: "204", title: "Writing for Business and Industry", credits: 3 }, "Advanced Writing"),
          createMockPlannedCourse(planId, 4, { id: 967, subject: "GEOS", number: "100", title: "Earth in Perspective", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 5, { id: 897, subject: "FIN", number: "330", title: "Managerial Finance", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 5, { id: 129, subject: "ACCT", number: "301", title: "Intermediate Accounting I", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 5, { id: 131, subject: "ACCT", number: "305", title: "Individual Taxation", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 5, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 5, { id: 1845, subject: "PHYS", number: "110", title: "Introduction to the Universe", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 6, { id: 1363, subject: "MIS", number: "320", title: "Management Information Systems", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 6, { id: 130, subject: "ACCT", number: "302", title: "Intermediate Accounting II", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 6, { id: 132, subject: "ACCT", number: "306", title: "Business Taxation", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 6, { id: 1328, subject: "MGT", number: "349", title: "Organizational Behavior", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 6, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 7, { id: 1989, subject: "QM", number: "319", title: "Operations Management", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 7, { id: 1375, subject: "MKT", number: "350", title: "Marketing Principles", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 7, { id: 133, subject: "ACCT", number: "400", title: "Advanced Accounting", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 7, { id: 135, subject: "ACCT", number: "403", title: "Advanced Cost Accounting", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 7, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),

          createMockPlannedCourse(planId, 8, { id: 394, subject: "BUS", number: "495", title: "Capstone in Strategic Management", credits: 3 }, "Business Core"),
          createMockPlannedCourse(planId, 8, { id: 136, subject: "ACCT", number: "404", title: "Auditing", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 8, { id: 385, subject: "BUS", number: "372", title: "Business Law", credits: 3 }, "Accounting Core"),
          createMockPlannedCourse(planId, 8, { id: 1846, subject: "PHYS", number: "120", title: "Astronomy of Native America", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 8, { id: 1192, subject: "LBST", number: "103", title: "Understanding Social Justice", credits: 3 }, "Ethnic Diversity"),
        ],
        totalPlannedCredits: 120,
        completedCredits: 0,
        shareToken: "acct-4yr",
        studentFirstName: "Shared",
        expiresAt: null,
      };

      return mockPlan;
    }

    if (shareToken === "econ-general-4yr") {
      const planId = 1002;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "Economics - General Economics 4 Year Plan",
        description:
          "A typical 4-year economics curriculum focused on the General Economics completion option.",
        ownerLabel: "Shared plan",
        programNames: ["B.S. Economics"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 1235, subject: "MATH", number: "104", title: "College Mathematics with Applications", credits: 4 }, "Skills: Computational Skills"),
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 1, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 1, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 1, { id: 314, subject: "BIOS", number: "100", title: "Nature of Life", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 2, { id: 702, subject: "ECON", number: "121", title: "Principles of Macroeconomics", credits: 3 }, "Economics Core"),
          createMockPlannedCourse(planId, 2, { id: 1986, subject: "QM", number: "110", title: "Applied Quantitative Analysis in Business", credits: 3 }, "Quantitative Foundation"),
          createMockPlannedCourse(planId, 2, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 2, { id: 967, subject: "GEOS", number: "100", title: "Earth in Perspective", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 3, { id: 701, subject: "ECON", number: "120", title: "Principles of Microeconomics", credits: 3 }, "Economics Core"),
          createMockPlannedCourse(planId, 3, { id: 1987, subject: "QM", number: "210", title: "Business Statistics I", credits: 3 }, "Quantitative Foundation"),
          createMockPlannedCourse(planId, 3, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 3, { id: 1845, subject: "PHYS", number: "110", title: "Introduction to the Universe", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 3, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "Foreign Language I"),

          createMockPlannedCourse(planId, 4, { id: 703, subject: "ECON", number: "221", title: "Intermediate Macro Theory", credits: 3 }, "Economics Core"),
          createMockPlannedCourse(planId, 4, { id: 1048, subject: "HIST", number: "101", title: "The United States: Origins to Reconstruction", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 4, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "Foreign Language II"),
          createMockPlannedCourse(planId, 4, { id: 1846, subject: "PHYS", number: "120", title: "Astronomy of Native America", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 4, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 5, { id: 17, subject: "ECON", number: "320", title: "Intermediate Micro", credits: 3 }, "Economics Core"),
          createMockPlannedCourse(planId, 5, { id: 704, subject: "ECON", number: "330", title: "Money and Banking", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 5, { id: 705, subject: "POLS", number: "325", title: "Public Policy", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 5, { id: 706, subject: "SOC", number: "360", title: "Social Inequality", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 5, { id: 1192, subject: "LBST", number: "103", title: "Understanding Social Justice", credits: 3 }, "Ethnic Diversity"),

          createMockPlannedCourse(planId, 6, { id: 18, subject: "ECON", number: "321", title: "Intermediate Macro", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 6, { id: 707, subject: "ECON", number: "335", title: "Labor Economics", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 6, { id: 708, subject: "MGT", number: "340", title: "Management and Leadership", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 709, subject: "FIN", number: "350", title: "Personal Finance", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 710, subject: "COMM", number: "312", title: "Professional Communication", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 7, { id: 711, subject: "ECON", number: "340", title: "International Economics", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 7, { id: 712, subject: "ECON", number: "350", title: "Public Finance", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 7, { id: 713, subject: "ECON", number: "360", title: "Environmental Economics", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 7, { id: 714, subject: "BUS", number: "300", title: "Business Communication", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 7, { id: 715, subject: "MKT", number: "340", title: "Consumer Behavior", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 8, { id: 716, subject: "ECON", number: "410", title: "Senior Seminar in Economics", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 8, { id: 717, subject: "ECON", number: "420", title: "Econometrics", credits: 3 }, "Economics Elective"),
          createMockPlannedCourse(planId, 8, { id: 718, subject: "BUS", number: "420", title: "Business Analytics", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 719, subject: "POLS", number: "400", title: "Public Administration", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 720, subject: "SOC", number: "410", title: "Social Research Seminar", credits: 3 }, "General Elective"),
        ],
        totalPlannedCredits: 123,
        completedCredits: 0,
        shareToken: "econ-general-4yr",
        studentFirstName: "Shared",
        expiresAt: null,
      };

      return mockPlan;
    }

    if (shareToken === "history-4yr") {
      const planId = 1003;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "History Major 4 Year Plan",
        description:
          "A typical 4-year history curriculum showing semester-by-semester pacing.",
        ownerLabel: "Shared plan",
        programNames: ["B.A. History"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 1234, subject: "MATH", number: "102", title: "Quantitative Reasoning", credits: 4 }, "Skills: Computational Skills"),
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 1, { id: 1048, subject: "HIST", number: "101", title: "The United States: Origins to Reconstruction", credits: 3 }, "History Core"),
          createMockPlannedCourse(planId, 1, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "Foreign Language I"),
          createMockPlannedCourse(planId, 1, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 2, { id: 1049, subject: "HIST", number: "102", title: "The United States: Reconstruction to Recent Times", credits: 3 }, "History Core"),
          createMockPlannedCourse(planId, 2, { id: 1050, subject: "HIST", number: "120", title: "Western Civilization I: From 1815 to the Present", credits: 3 }, "History Survey"),
          createMockPlannedCourse(planId, 2, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 2, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "Foreign Language II"),

          createMockPlannedCourse(planId, 3, { id: 1051, subject: "HIST", number: "110", title: "Western Civilization From Antiquity to 1300", credits: 3 }, "History Survey"),
          createMockPlannedCourse(planId, 3, { id: 1052, subject: "HIST", number: "254", title: "Sources and Methods in History", credits: 3 }, "History Methods"),
          createMockPlannedCourse(planId, 3, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 3, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 3, { id: 314, subject: "BIOS", number: "100", title: "Nature of Life", credits: 3 }, "Gen Ed: Natural Science"),

          createMockPlannedCourse(planId, 4, { id: 1053, subject: "HIST", number: "119", title: "Western Civilization in the Middle Ages to 1815", credits: 3 }, "History Survey"),
          createMockPlannedCourse(planId, 4, { id: 1054, subject: "HIST", number: "127", title: "World History I: From 1300 to 1600", credits: 3 }, "History Survey"),
          createMockPlannedCourse(planId, 4, { id: 967, subject: "GEOS", number: "100", title: "Earth in Perspective", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 4, { id: 1846, subject: "PHYS", number: "120", title: "Astronomy of Native America", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 4, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 5, { id: 1055, subject: "HIST", number: "304", title: "Modern Europe", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 5, { id: 1056, subject: "HIST", number: "320", title: "Public History", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 5, { id: 1057, subject: "SOC", number: "300", title: "Classical Social Theory", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 5, { id: 1058, subject: "POLS", number: "310", title: "Politics and Society", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 5, { id: 1192, subject: "LBST", number: "103", title: "Understanding Social Justice", credits: 3 }, "Ethnic Diversity"),

          createMockPlannedCourse(planId, 6, { id: 1059, subject: "HIST", number: "340", title: "American Intellectual History", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 6, { id: 1060, subject: "HIST", number: "360", title: "History of the Modern World", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 6, { id: 1061, subject: "COMM", number: "300", title: "Media and Society", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 1062, subject: "ENGL", number: "300", title: "Studies in Literature and Culture", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 1063, subject: "SOC", number: "320", title: "Global Social Change", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 7, { id: 1064, subject: "HIST", number: "370", title: "History of Latin America", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 7, { id: 1065, subject: "HIST", number: "380", title: "History of Asia", credits: 3 }, "History Elective"),
          createMockPlannedCourse(planId, 7, { id: 1066, subject: "PHIL", number: "300", title: "Political Philosophy", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 7, { id: 1067, subject: "ENGL", number: "310", title: "American Literature", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 7, { id: 1068, subject: "SOC", number: "330", title: "Race and Ethnicity", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 8, { id: 1069, subject: "HIST", number: "407", title: "History Capstone", credits: 3 }, "History Capstone"),
          createMockPlannedCourse(planId, 8, { id: 1070, subject: "POLS", number: "400", title: "Public Administration", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1071, subject: "ENGL", number: "320", title: "Writing in the Humanities", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1072, subject: "COMM", number: "350", title: "Communication in Public Life", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1073, subject: "SOC", number: "410", title: "Social Research Seminar", credits: 3 }, "General Elective"),
        ],
        totalPlannedCredits: 122,
        completedCredits: 0,
        shareToken: "history-4yr",
        studentFirstName: "Shared",
        expiresAt: null,
      };

      return mockPlan;
    }

    if (shareToken === "communication-4yr") {
      const planId = 1004;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "Communication Major 4 Year Plan",
        description:
          "A typical 4-year communication curriculum showing semester-by-semester pacing.",
        ownerLabel: "Shared plan",
        programNames: ["B.A. Communication"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 1234, subject: "MATH", number: "102", title: "Quantitative Reasoning", credits: 4 }, "Skills: Computational Skills"),
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 1, { id: 1080, subject: "COMM", number: "107", title: "Communication and the Human Condition", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 1, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "Foreign Language I"),

          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 2, { id: 511, subject: "COMM", number: "105", title: "Public Speaking for the 21st Century", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 2, { id: 1081, subject: "COMM", number: "106", title: "Media and Society", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 2, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "Foreign Language II"),
          createMockPlannedCourse(planId, 2, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),

          createMockPlannedCourse(planId, 3, { id: 1082, subject: "COMM", number: "207", title: "Introduction to the Communication Discipline (Part I)", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 3, { id: 1083, subject: "COMM", number: "208", title: "Introduction to the Communication Discipline (Part 2)", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 3, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 3, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 3, { id: 1084, subject: "SOC", number: "101", title: "Introduction to Sociology", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 4, { id: 1085, subject: "COMM", number: "250", title: "Approach Writing", credits: 3 }, "Communication Core"),
          createMockPlannedCourse(planId, 4, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 4, { id: 314, subject: "BIOS", number: "100", title: "Nature of Life", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 4, { id: 1086, subject: "SOC", number: "210", title: "Social Problems", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 5, { id: 1087, subject: "COMM", number: "300", title: "Communication Theory", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 5, { id: 1088, subject: "COMM", number: "320", title: "Interpersonal Communication", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 5, { id: 1089, subject: "COMM", number: "340", title: "Gender and Communication", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 5, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 5, { id: 1090, subject: "PSYC", number: "320", title: "Social Psychology", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 6, { id: 1091, subject: "COMM", number: "310", title: "Organizational Communication", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 6, { id: 1092, subject: "COMM", number: "330", title: "Health Communication", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 6, { id: 1093, subject: "SOC", number: "300", title: "Classical Social Theory", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 1094, subject: "COMM", number: "312", title: "Professional Communication", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 6, { id: 1095, subject: "PSYC", number: "330", title: "Psychology of Communication", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 7, { id: 1096, subject: "COMM", number: "410", title: "Rhetorical Criticism", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 7, { id: 1097, subject: "COMM", number: "420", title: "Communication Research", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 7, { id: 1098, subject: "COMM", number: "430", title: "Intercultural Communication", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 7, { id: 1846, subject: "PHYS", number: "120", title: "Astronomy of Native America", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 7, { id: 1192, subject: "LBST", number: "103", title: "Understanding Social Justice", credits: 3 }, "Ethnic Diversity"),

          createMockPlannedCourse(planId, 8, { id: 1099, subject: "COMM", number: "469", title: "Senior Seminar", credits: 3 }, "Communication Capstone"),
          createMockPlannedCourse(planId, 8, { id: 1100, subject: "COMM", number: "440", title: "Persuasion", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 8, { id: 1101, subject: "COMM", number: "450", title: "Digital Media Production", credits: 3 }, "Communication Elective"),
          createMockPlannedCourse(planId, 8, { id: 1102, subject: "SOC", number: "340", title: "Culture and Identity", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1103, subject: "PSYC", number: "410", title: "Advanced Social Psychology", credits: 3 }, "General Elective"),
        ],
        totalPlannedCredits: 117,
        completedCredits: 0,
        shareToken: "communication-4yr",
        studentFirstName: "Shared",
        expiresAt: null,
      };

      return mockPlan;
    }

    if (shareToken === "sociology-4yr") {
      const planId = 1005;
      const mockPlan: SharedPlanDetail = {
        planId,
        planName: "Sociology Major 4 Year Plan",
        description:
          "A typical 4-year sociology curriculum showing semester-by-semester pacing.",
        ownerLabel: "Shared plan",
        programNames: ["B.A. Sociology"],
        terms: [
          { id: 1, season: "Fall", year: 2026 },
          { id: 2, season: "Spring", year: 2027 },
          { id: 3, season: "Fall", year: 2027 },
          { id: 4, season: "Spring", year: 2028 },
          { id: 5, season: "Fall", year: 2028 },
          { id: 6, season: "Spring", year: 2029 },
          { id: 7, season: "Fall", year: 2029 },
          { id: 8, season: "Spring", year: 2030 },
        ],
        plannedCourses: [
          createMockPlannedCourse(planId, 1, { id: 778, subject: "ENGL", number: "100", title: "Fundamentals of English", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 1, { id: 1235, subject: "MATH", number: "104", title: "College Mathematics with Applications", credits: 4 }, "Skills: Computational Skills"),
          createMockPlannedCourse(planId, 1, { id: 1201, subject: "SOCA", number: "101", title: "Introduction to Sociology", credits: 3 }, "Sociology Core"),
          createMockPlannedCourse(planId, 1, { id: 1801, subject: "PHIL", number: "101", title: "Introduction to Philosophy", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 1, { id: 2300, subject: "UWX", number: "SP101", title: "First Semester Spanish", credits: 4 }, "Foreign Language I"),

          createMockPlannedCourse(planId, 2, { id: 779, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 }, "Skills: Reading and Writing"),
          createMockPlannedCourse(planId, 2, { id: 1202, subject: "SOCA", number: "206", title: "Race and Ethnic Relations in the U.S.", credits: 3 }, "Sociology Core"),
          createMockPlannedCourse(planId, 2, { id: 1886, subject: "POLS", number: "100", title: "American Politics", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 2, { id: 1941, subject: "PSYC", number: "101", title: "Introduction to Psychological Science", credits: 3 }, "Gen Ed: Social and Behavioral Science"),
          createMockPlannedCourse(planId, 2, { id: 2301, subject: "UWX", number: "SP102", title: "Second Semester Spanish", credits: 4 }, "Foreign Language II"),

          createMockPlannedCourse(planId, 3, { id: 1203, subject: "SOCA", number: "215", title: "Statistics for the Social Sciences", credits: 4 }, "Sociology Methods"),
          createMockPlannedCourse(planId, 3, { id: 1204, subject: "SOCA", number: "320", title: "Social Stratification", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 3, { id: 206, subject: "ART", number: "100", title: "Foundations of Art and Visual Culture", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 3, { id: 314, subject: "BIOS", number: "100", title: "Nature of Life", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 3, { id: 1205, subject: "SOC", number: "300", title: "Social Problems", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 4, { id: 1206, subject: "SOCA", number: "216", title: "Report Writing for the Social Sciences", credits: 3 }, "Sociology Methods"),
          createMockPlannedCourse(planId, 4, { id: 1207, subject: "SOCA", number: "330", title: "Deviance and Social Control", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 4, { id: 967, subject: "GEOS", number: "100", title: "Earth in Perspective", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 4, { id: 1808, subject: "PHIL", number: "206", title: "Introduction to Ethics", credits: 3 }, "Gen Ed: Humanities and the Arts"),
          createMockPlannedCourse(planId, 4, { id: 1208, subject: "PSYC", number: "320", title: "Social Psychology", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 5, { id: 1209, subject: "SOCA", number: "315", title: "Social Science Research Methods", credits: 3 }, "Sociology Methods"),
          createMockPlannedCourse(planId, 5, { id: 1210, subject: "SOCA", number: "310", title: "Sociological Theory", credits: 3 }, "Sociology Core"),
          createMockPlannedCourse(planId, 5, { id: 1211, subject: "SOCA", number: "340", title: "Sociology of Gender", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 5, { id: 1846, subject: "PHYS", number: "120", title: "Astronomy of Native America", credits: 3 }, "Gen Ed: Natural Science"),
          createMockPlannedCourse(planId, 5, { id: 1212, subject: "COMM", number: "300", title: "Media and Society", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 6, { id: 1213, subject: "SOCA", number: "395", title: "Topics in Data Collection and Analysis", credits: 3 }, "Sociology Methods"),
          createMockPlannedCourse(planId, 6, { id: 1214, subject: "SOCA", number: "350", title: "Globalization and Society", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 6, { id: 1215, subject: "SOCA", number: "360", title: "Criminology", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 6, { id: 1192, subject: "LBST", number: "103", title: "Understanding Social Justice", credits: 3 }, "Ethnic Diversity"),
          createMockPlannedCourse(planId, 6, { id: 1216, subject: "POLS", number: "310", title: "Politics and Society", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 7, { id: 1217, subject: "SOCA", number: "370", title: "Sociology of Family", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 7, { id: 1218, subject: "SOCA", number: "380", title: "Medical Sociology", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 7, { id: 1219, subject: "ENGL", number: "300", title: "Studies in Literature and Culture", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 7, { id: 1220, subject: "COMM", number: "312", title: "Professional Communication", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 7, { id: 1221, subject: "PSYC", number: "330", title: "Community Psychology", credits: 3 }, "General Elective"),

          createMockPlannedCourse(planId, 8, { id: 1222, subject: "SOCA", number: "419", title: "Senior Seminar", credits: 3 }, "Sociology Capstone"),
          createMockPlannedCourse(planId, 8, { id: 1223, subject: "SOCA", number: "390", title: "Urban Sociology", credits: 3 }, "Sociology Elective"),
          createMockPlannedCourse(planId, 8, { id: 1224, subject: "SOC", number: "410", title: "Social Research Seminar", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1225, subject: "ENGL", number: "320", title: "Writing in the Humanities", credits: 3 }, "General Elective"),
          createMockPlannedCourse(planId, 8, { id: 1226, subject: "COMM", number: "350", title: "Communication in Public Life", credits: 3 }, "General Elective"),
        ],
        totalPlannedCredits: 121,
        completedCredits: 0,
        shareToken: "sociology-4yr",
        studentFirstName: "Shared",
        expiresAt: null,
      };

      return mockPlan;
    }

    return null;
  }

  try {
    const { data: share, error: shareError } = await supabase
      .from(PLAN_SHARES_TABLE)
      .select("plan_id, share_token, is_active, expires_at")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (shareError || !share || !isActiveShare(share)) {
      return null;
    }

    const comparable = await fetchComparablePlanDetail(
      supabase,
      share.plan_id,
      "Shared plan"
    );

    if (!comparable) {
      return null;
    }

    const studentRes = await supabase
      .from(DB_TABLES.students)
      .select("id, first_name")
      .eq("id", comparable.studentId)
      .maybeSingle();

    const { studentId: _studentId, ...sharedComparable } = comparable;

    return {
      ...sharedComparable,
      shareToken: share.share_token,
      studentFirstName: normalizeFirstName(studentRes.data?.first_name),
      expiresAt: share.expires_at ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchStudentPlanSummariesForUser(
  supabase: any,
  authUserId: string
): Promise<OwnPlanSummary[]> {
  const { data: student } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!student) {
    return [];
  }

  const { data: plans, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, description")
    .eq("student_id", student.id)
    .order("updated_at", { ascending: false });

  if (error || !plans?.length) {
    return [];
  }

  const planIds = plans.map((plan: any) => plan.id);

  const [programsRes, termsRes, coursesRes] = await Promise.all([
    supabase
      .from(DB_TABLES.planPrograms)
      .select("plan_id, programs:program_id (name)")
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("plan_id")
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select("plan_id, courses:course_id (credits)")
      .in("plan_id", planIds),
  ]);

  return plans.map((plan: any) => ({
    planId: plan.id,
    planName: plan.name,
    description: plan.description,
    programNames: (programsRes.data ?? [])
      .filter((row: any) => row.plan_id === plan.id)
      .map((row: any) => row.programs?.name)
      .filter((name: string | undefined): name is string => Boolean(name)),
    totalPlannedCredits: (coursesRes.data ?? [])
      .filter((row: any) => row.plan_id === plan.id)
      .reduce((sum: number, row: any) => sum + Number(row.courses?.credits ?? 0), 0),
    termCount: (termsRes.data ?? []).filter((row: any) => row.plan_id === plan.id).length,
  }));
}

export async function fetchOwnedPlanForUser(
  supabase: any,
  authUserId: string,
  planId: number
): Promise<ComparablePlanDetail | null> {
  const { data: student } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!student) {
    return null;
  }

  const { data: plan } = await supabase
    .from(DB_TABLES.plans)
    .select("id")
    .eq("id", planId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!plan) {
    return null;
  }

  const ownPlan = await fetchComparablePlanDetail(supabase, plan.id, "My plan");
  if (!ownPlan) {
    return null;
  }

  const { studentId: _studentId, ...comparable } = ownPlan;
  return comparable;
}

export async function fetchPublicSharedPlans(limit = 24): Promise<SharedPlanSummary[]> {
  const supabase = createAdminClient();

  if (!supabase) {
    // Dev fallback: show the cs-4yr example when Supabase admin client isn't available
    return [
      {
        shareToken: "cs-4yr",
        planId: 1000,
        planName: "Computer Science Major 4 Year Plan",
        description: "A typical 4-year computer science curriculum showing semester-by-semester pacing.",
        studentFirstName: "Alex",
        programNames: ["B.S. Computer Science"],
        termCount: 8,
        totalPlannedCredits: 120,
        updatedAt: new Date().toISOString(),
      },
      {
        shareToken: "econ-general-4yr",
        planId: 1002,
        planName: "Economics - General Economics 4 Year Plan",
        description: "A typical 4-year economics curriculum focused on the General Economics completion option.",
        studentFirstName: "Shared",
        programNames: ["B.S. Economics"],
        termCount: 8,
        totalPlannedCredits: 123,
        updatedAt: new Date().toISOString(),
      },
      {
        shareToken: "history-4yr",
        planId: 1003,
        planName: "History Major 4 Year Plan",
        description: "A typical 4-year history curriculum showing semester-by-semester pacing.",
        studentFirstName: "Shared",
        programNames: ["B.A. History"],
        termCount: 8,
        totalPlannedCredits: 122,
        updatedAt: new Date().toISOString(),
      },
      {
        shareToken: "communication-4yr",
        planId: 1004,
        planName: "Communication Major 4 Year Plan",
        description: "A typical 4-year communication curriculum showing semester-by-semester pacing.",
        studentFirstName: "Shared",
        programNames: ["B.A. Communication"],
        termCount: 8,
        totalPlannedCredits: 117,
        updatedAt: new Date().toISOString(),
      },
      {
        shareToken: "sociology-4yr",
        planId: 1005,
        planName: "Sociology Major 4 Year Plan",
        description: "A typical 4-year sociology curriculum showing semester-by-semester pacing.",
        studentFirstName: "Shared",
        programNames: ["B.A. Sociology"],
        termCount: 8,
        totalPlannedCredits: 121,
        updatedAt: new Date().toISOString(),
      },
      {
        shareToken: "acct-4yr",
        planId: 1001,
        planName: "Accounting Major 4 Year Plan",
        description: "A typical 4-year accounting curriculum showing semester-by-semester pacing.",
        studentFirstName: "Shared",
        programNames: ["B.S. Accounting"],
        termCount: 8,
        totalPlannedCredits: 120,
        updatedAt: new Date().toISOString(),
      },
    ].sort((a, b) => a.planName.localeCompare(b.planName));
  }

  try {
    const { data: shares, error: sharesError } = await supabase
      .from(PLAN_SHARES_TABLE)
      .select("plan_id, share_token, is_active, expires_at, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (sharesError || !shares?.length) {
      return [];
    }

    const activeShares = shares.filter(isActiveShare);
    if (activeShares.length === 0) {
      return [];
    }

    const planIds = activeShares.map((share: any) => share.plan_id);

    const [plansRes, programsRes, termsRes, coursesRes, studentsRes] = await Promise.all([
      supabase
        .from(DB_TABLES.plans)
        .select("id, student_id, name, description, updated_at")
        .in("id", planIds),
      supabase
        .from(DB_TABLES.planPrograms)
        .select("plan_id, programs:program_id (name)")
        .in("plan_id", planIds),
      supabase
        .from(DB_TABLES.studentTermPlan)
        .select("plan_id")
        .in("plan_id", planIds),
      supabase
        .from(DB_TABLES.studentPlannedCourses)
        .select("plan_id, courses:course_id (credits)")
        .in("plan_id", planIds),
      supabase.from(DB_TABLES.students).select("id, first_name"),
    ]);

    if (plansRes.error) {
      return [];
    }

    const studentsById = new Map<number, string>(
      (studentsRes.data ?? []).map((student: any) => [
        student.id,
        normalizeFirstName(student.first_name),
      ])
    );

    return activeShares
      .map((share: any) => {
        const plan = (plansRes.data ?? []).find((item: any) => item.id === share.plan_id);
        if (!plan) {
          return null;
        }

        const programNames = (programsRes.data ?? [])
          .filter((row: any) => row.plan_id === plan.id)
          .map((row: any) => row.programs?.name)
          .filter((name: string | undefined): name is string => Boolean(name));

        const termCount = (termsRes.data ?? []).filter((row: any) => row.plan_id === plan.id).length;
        const totalPlannedCredits = (coursesRes.data ?? [])
          .filter((row: any) => row.plan_id === plan.id)
          .reduce((sum: number, row: any) => sum + Number(row.courses?.credits ?? 0), 0);

        return {
          shareToken: share.share_token,
          planId: plan.id,
          planName: plan.name,
          description: plan.description,
          studentFirstName: studentsById.get(plan.student_id) ?? "Student",
          programNames,
          termCount,
          totalPlannedCredits,
          updatedAt: share.updated_at ?? plan.updated_at ?? null,
        } satisfies SharedPlanSummary;
      })
      .filter((item): item is SharedPlanSummary => item !== null)
      .sort((a, b) => a.planName.localeCompare(b.planName));
  } catch {
    return [];
  }
}
