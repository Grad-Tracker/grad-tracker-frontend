import type { Course } from "./course";

export type Season = "Fall" | "Spring" | "Summer";

export interface Term {
  id: number;
  season: Season;
  year: number;
}

export interface PlannedCourse {
  student_id: number;
  term_id: number;
  course_id: number;
  status: string;
}

export interface PlannedCourseWithDetails extends PlannedCourse {
  course: Course;
}

export interface RequirementBlockWithCourses {
  id: number;
  program_id: number;
  name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  courses: Course[];
}

// ── Breadth package types & data ─────────────────────────

export interface BreadthCourseGroup {
  label: string;
  courses: string[];   // subject + number, e.g. "MATH 222"
  nRequired: number;   // how many to pick from this group
}

export interface BreadthPackage {
  id: string;
  name: string;
  description: string;
  groups: BreadthCourseGroup[];
  totalCreditsRequired: number;
}

export const BREADTH_PACKAGES: BreadthPackage[] = [
  {
    id: "math",
    name: "Mathematics",
    description: "Calculus II and Linear Algebra",
    totalCreditsRequired: 9,
    groups: [
      { label: "Required", courses: ["MATH 222", "MATH 301"], nRequired: 2 },
    ],
  },
  {
    id: "math-physics",
    name: "Math & Physics",
    description: "Calculus II and General Physics II",
    totalCreditsRequired: 9,
    groups: [
      { label: "Required", courses: ["MATH 222", "PHYS 202"], nRequired: 2 },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    description: "General Chemistry II/Lab plus one advanced chemistry course",
    totalCreditsRequired: 9,
    groups: [
      { label: "Required", courses: ["CHEM 102", "CHEM 104"], nRequired: 2 },
      { label: "Choose one", courses: ["CHEM 206", "CHEM 215"], nRequired: 1 },
    ],
  },
  {
    id: "project-mgmt",
    name: "Project Management",
    description: "Basics of Project Management plus two advanced PMGT courses",
    totalCreditsRequired: 9,
    groups: [
      { label: "Required", courses: ["PMGT 341"], nRequired: 1 },
      {
        label: "Choose two",
        courses: ["PMGT 342", "PMGT 441", "PMGT 442"],
        nRequired: 2,
      },
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Select any three business courses",
    totalCreditsRequired: 9,
    groups: [
      {
        label: "Choose three",
        courses: ["ACCT 201", "BUS 272", "FIN 330", "MGT 349", "MKT 350"],
        nRequired: 3,
      },
    ],
  },
  {
    id: "economics",
    name: "Economics",
    description: "Intermediate micro or macro theory plus two 300-level ECON courses",
    totalCreditsRequired: 9,
    groups: [
      {
        label: "Choose one",
        courses: ["ECON 320", "ECON 321"],
        nRequired: 1,
      },
      {
        label: "Two additional 300-level ECON",
        courses: ["ECON 320", "ECON 321"],
        nRequired: 2,
      },
    ],
  },
  {
    id: "geography",
    name: "Geography / GIS",
    description: "Cartography, Intro GIS Analysis, and Advanced GIS Applications",
    totalCreditsRequired: 9,
    groups: [
      {
        label: "Required",
        courses: ["GEOG 350", "GEOG 460", "GEOG 465"],
        nRequired: 3,
      },
    ],
  },
  {
    id: "criminal-justice",
    name: "Criminal Justice & Law",
    description: "Criminal Procedure, Criminal Law, and Legal Environment of Business",
    totalCreditsRequired: 9,
    groups: [
      {
        label: "Required",
        courses: ["CRMJ 316", "CRMJ 380", "BUS 272"],
        nRequired: 3,
      },
    ],
  },
  {
    id: "art-design",
    name: "Art & Interactive Design",
    description: "Intro to Graphic Design, Interactive Design I & II",
    totalCreditsRequired: 9,
    groups: [
      {
        label: "Required",
        courses: ["ART 105", "ART 377", "ART 477"],
        nRequired: 3,
      },
    ],
  },
];

/** Get all unique subject+number strings referenced by a breadth package */
export function getPackageCourseKeys(pkg: BreadthPackage): Set<string> {
  const keys = new Set<string>();
  for (const g of pkg.groups) {
    for (const c of g.courses) keys.add(c);
  }
  return keys;
}

/** Check whether a requirement block is a breadth block */
export function isBreadthBlock(block: RequirementBlockWithCourses): boolean {
  return block.name === "Breadth Requirements";
}

/** Build a course key (subject + number) for matching against package definitions */
export function courseKey(course: Course): string {
  return `${course.subject} ${course.number}`;
}

// ── Block name helpers & deduplication ───────────────────

/** Shorten verbose database block names into concise display labels */
export function shortenBlockName(name: string): string {
  const n = name.toLowerCase();

  if (n.includes("breadth requirement")) return "Breadth Requirements";
  if (n.includes("elective major") || n.includes("elective courses")) return "Electives";
  if (n.includes("computer science courses") || (n.includes("required") && n.includes("computer science") && !n.includes("breadth")))
    return "Required Courses";
  if (n.includes("math") && n.includes("course")) return "Math & Chemistry";
  if (n.includes("science course")) return "Math & Chemistry";

  const stripped = name
    .replace(/^Required Major Courses\s*-?\s*/i, "")
    .replace(/^Required\s+/i, "")
    .replace(/\s+Courses?\s*$/i, "")
    .trim();

  return stripped || name;
}

/**
 * Filter out parent/umbrella blocks and merge blocks that share
 * the same shortened display name into a single logical block.
 *
 * When `selectedPackage` is provided the breadth block's courses are
 * narrowed to only those referenced by the package, and
 * `credits_required` is set to the package's total.
 */
export function deduplicateBlocks(
  blocks: RequirementBlockWithCourses[],
  selectedPackage?: BreadthPackage | null
): RequirementBlockWithCourses[] {
  const names = blocks.map((b) => b.name);

  const filtered = blocks.filter((b) => {
    const isParent = names.some(
      (other) => other !== b.name && other.startsWith(b.name + " - ")
    );
    return !isParent;
  });

  const merged = new Map<string, RequirementBlockWithCourses>();

  for (const block of filtered) {
    const displayName = shortenBlockName(block.name);
    const existing = merged.get(displayName);

    if (existing) {
      const seenIds = new Set(existing.courses.map((c) => c.id));
      const newCourses = block.courses.filter((c) => !seenIds.has(c.id));
      existing.courses = [...existing.courses, ...newCourses];
      existing.credits_required =
        (existing.credits_required ?? 0) + (block.credits_required ?? 0);
      if (block.n_required != null) {
        existing.n_required =
          (existing.n_required ?? 0) + block.n_required;
      }
    } else {
      merged.set(displayName, {
        ...block,
        name: displayName,
      });
    }
  }

  if (selectedPackage) {
    const breadth = merged.get("Breadth Requirements");
    if (breadth) {
      const allowed = getPackageCourseKeys(selectedPackage);
      breadth.courses = breadth.courses.filter((c) =>
        allowed.has(courseKey(c))
      );
      breadth.credits_required = selectedPackage.totalCreditsRequired;
    }
  }

  return Array.from(merged.values());
}

// ── Term helpers ─────────────────────────────────────────

/** Sort order for seasons within a year */
export const SEASON_ORDER: Record<Season, number> = {
  Spring: 0,
  Summer: 1,
  Fall: 2,
};

/** Compare two terms chronologically */
export function compareTerms(a: Term, b: Term): number {
  if (a.year !== b.year) return a.year - b.year;
  return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
}
