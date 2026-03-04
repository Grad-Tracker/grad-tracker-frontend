import type { Course } from "./course";

export type Season = "Fall" | "Spring" | "Summer";

// ── Plan types ───────────────────────────────────────────

export interface Plan {
  id: number;
  student_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanWithMeta extends Plan {
  program_ids: number[];
  term_count: number;
  course_count: number;
  total_credits: number;
  has_graduate_program: boolean;
}

// ── Term & course types ──────────────────────────────────

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
  plan_id: number;
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

// ── Graduate track helpers ──────────────────────────────

const GRAD_PREREQ_PATTERNS = [
  /\bnormal path\b/i,
  /\bprogramming proficiency\b/i,
  /\bprerequisite/i,
  /\bdatabase management\s+\d/i,
  /\bcomputer systems\b.*\d/i,
];

const GRAD_CORE_PATTERNS = [
  /\brequired\b/i,
  /\bcore\b/i,
  /\belective/i,
  /\bseminar\b/i,
  /\bthesis\b/i,
  /\bnon-thesis\b/i,
  /\bcompletion option/i,
  /\bplan [ab]:/i,
  /\boption [ab]:/i,
  /\bcombined\b/i,
  /\bconcentration\s+(area\s+)?courses?\b/i,
  /\brequirements? for the\b/i,
  /\bcontent expertise\b/i,
];

/** Returns true if this block is a prerequisite block that should be hidden for graduate plans */
export function isGraduatePrereqBlock(block: RequirementBlockWithCourses): boolean {
  return GRAD_PREREQ_PATTERNS.some((p) => p.test(block.name));
}

/** Returns true if this block looks like a core/structural block (not a concentration track) */
function isGraduateCoreBlock(block: RequirementBlockWithCourses): boolean {
  return GRAD_CORE_PATTERNS.some((p) => p.test(block.name));
}

export interface GraduateTrack {
  blockId: number;
  name: string;
  courseCount: number;
  totalCredits: number;
}

/**
 * Extract concentration/track options from a set of graduate requirement blocks.
 * Returns tracks only when there are 2+ non-core, non-prereq blocks with courses.
 */
export function getGraduateTracks(
  blocks: RequirementBlockWithCourses[]
): GraduateTrack[] {
  const candidates = blocks.filter(
    (b) =>
      !isGraduatePrereqBlock(b) &&
      !isGraduateCoreBlock(b) &&
      b.courses.length > 0
  );

  if (candidates.length < 2) return [];

  return candidates.map((b) => ({
    blockId: b.id,
    name: b.name,
    courseCount: b.courses.length,
    totalCredits: b.courses.reduce((s, c) => s + c.credits, 0),
  }));
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

  // Graduate-specific patterns
  if (n === "required program core courses" || n === "required core courses")
    return "Core Courses";
  if (n.includes("concentration") && n.includes("course"))
    return "Concentration";

  const stripped = name
    .replace(/^Required Major Courses\s*-?\s*/i, "")
    .replace(/^Required Program\s*/i, "")
    .replace(/^Required\s+/i, "")
    .replace(/\s+Courses?$/i, "")
    .trim();

  return stripped || name;
}

export interface DeduplicateOptions {
  selectedPackage?: BreadthPackage | null;
  /** When true, prerequisite/proficiency blocks are removed */
  isGraduate?: boolean;
  /** Block ID of the selected graduate track; unselected track blocks are hidden */
  selectedTrackId?: number | null;
}

/**
 * Filter out parent/umbrella blocks and merge blocks that share
 * the same shortened display name into a single logical block.
 *
 * For undergraduate plans: when `selectedPackage` is provided the breadth
 * block's courses are narrowed to only those referenced by the package.
 *
 * For graduate plans: prerequisite blocks are removed and only the
 * selected concentration/track block is kept (other tracks hidden).
 */
export function deduplicateBlocks(
  blocks: RequirementBlockWithCourses[],
  opts: DeduplicateOptions = {}
): RequirementBlockWithCourses[] {
  const { selectedPackage, isGraduate, selectedTrackId } = opts;
  const names = blocks.map((b) => b.name);

  let filtered = blocks.filter((b) => {
    const isParent = names.some(
      (other) => other !== b.name && other.startsWith(b.name + " - ")
    );
    return !isParent;
  });

  if (isGraduate) {
    filtered = filtered.filter((b) => !isGraduatePrereqBlock(b));

    const tracks = getGraduateTracks(filtered);
    if (tracks.length >= 2 && selectedTrackId) {
      const trackBlockIds = new Set(tracks.map((t) => t.blockId));
      const nonSelectedTrackCourses = filtered
        .filter((b) => trackBlockIds.has(b.id) && b.id !== selectedTrackId)
        .flatMap((b) => b.courses);

      filtered = filtered.filter(
        (b) => !trackBlockIds.has(b.id) || b.id === selectedTrackId
      );

      if (nonSelectedTrackCourses.length > 0) {
        const electiveBlock = filtered.find(
          (b) => shortenBlockName(b.name) === "Electives"
        );
        if (electiveBlock) {
          const seenIds = new Set(electiveBlock.courses.map((c) => c.id));
          const extras = nonSelectedTrackCourses.filter((c) => {
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
          });
          electiveBlock.courses = [...electiveBlock.courses, ...extras];
        }
      }
    }
    // When no track is selected, all blocks pass through unfiltered
  }

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

  const result = Array.from(merged.values());

  if (isGraduate) {
    const order = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes("core")) return 0;
      if (n === "electives") return 2;
      return 1; // track block
    };
    result.sort((a, b) => order(a.name) - order(b.name));
  }

  return result;
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
