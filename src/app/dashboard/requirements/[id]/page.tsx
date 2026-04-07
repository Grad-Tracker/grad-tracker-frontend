import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DB_VIEWS } from "@/lib/supabase/queries/schema";
import type {
  ViewProgramCatalogRow,
  ViewProgramRequirementCrossListingItem,
  ViewProgramRequirementCourseItem,
  ViewProgramRequirementDetailRow,
  ViewProgramRequirementNodeItem,
} from "@/lib/supabase/queries/view-types";
import ProgramDetailClient from "./ProgramDetailClient";
import type { Course } from "@/types/course";

type ReqNode = {
  id: number;
  node_type: string;
  parent_id: number | null;
  sort_order: number;
  program_req_atoms: { atom_type: string; required_course_id: number | null }[];
};

function toCourse(course: ViewProgramRequirementCourseItem): Course {
  return {
    id: Number(course.course_id),
    subject: String(course.subject ?? ""),
    number: String(course.number ?? ""),
    title: String(course.title ?? ""),
    credits: Number(course.credits ?? 0),
    description: course.description ?? null,
    prereq_text: course.prereq_text ?? null,
  };
}

function toCrossListing(
  row: ViewProgramRequirementCrossListingItem
): { course_id: number; cross_subject: string; cross_number: string } {
  return {
    course_id: Number(row.course_id),
    cross_subject: String(row.cross_subject ?? ""),
    cross_number: String(row.cross_number ?? ""),
  };
}

function parseReqNodes(rows: ViewProgramRequirementNodeItem[]): ReqNode[] {
  const nodeMap = new Map<number, ReqNode>();

  for (const row of rows) {
    const nodeId = Number(row.node_id);
    const existing = nodeMap.get(nodeId);

    if (!existing) {
      nodeMap.set(nodeId, {
        id: nodeId,
        node_type: String(row.node_type),
        parent_id: row.parent_id == null ? null : Number(row.parent_id),
        sort_order: Number(row.sort_order ?? 0),
        program_req_atoms: [],
      });
    }

    if (row.atom_type != null || row.required_course_id != null) {
      const node = nodeMap.get(nodeId)!;
      node.program_req_atoms.push({
        atom_type: String(row.atom_type ?? "COURSE"),
        required_course_id:
          row.required_course_id == null ? null : Number(row.required_course_id),
      });
    }
  }

  return [...nodeMap.values()];
}

/**
 * Walk the OR->(ATOM|AND) tree and return option groups.
 * Each group is an array of courses that must all be taken together.
 * Returns null when the root is not OR.
 */
function parseOptionGroups(
  nodes: ReqNode[],
  courseMap: Map<number, Course>
): Course[][] | null {
  const roots = nodes.filter((n) => n.parent_id === null && n.node_type === "OR");
  if (roots.length === 0) return null;

  const childrenOf = (parentId: number) =>
    nodes
      .filter((n) => n.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

  const options: Course[][] = [];

  for (const root of roots) {
    for (const child of childrenOf(root.id)) {
      if (child.node_type === "ATOM") {
        const courseId = child.program_req_atoms[0]?.required_course_id;
        const course = courseId ? courseMap.get(courseId) : undefined;
        if (course) options.push([course]);
      } else if (child.node_type === "AND") {
        const group: Course[] = [];
        for (const atom of childrenOf(child.id)) {
          if (atom.node_type === "ATOM") {
            const courseId = atom.program_req_atoms[0]?.required_course_id;
            const course = courseId ? courseMap.get(courseId) : undefined;
            if (course) group.push(course);
          }
        }
        if (group.length > 0) options.push(group);
      }
    }
  }

  return options.length >= 2 ? options : null;
}

/**
 * Given the ordered courses for a block and the raw cross-listing rows,
 * return groups of course IDs that are cross-listed alternatives within
 * this block.
 */
function computeCrossPairs(
  courses: Course[],
  crossListings: { course_id: number; cross_subject: string; cross_number: string }[]
): number[][] {
  const coursesByKey = new Map(courses.map((c) => [`${c.subject} ${c.number}`, c]));
  const processed = new Set<number>();
  const pairs: number[][] = [];

  for (const course of courses) {
    if (processed.has(course.id)) continue;

    const forwardLinked = crossListings
      .filter((cl) => cl.course_id === course.id)
      .map((cl) => coursesByKey.get(`${cl.cross_subject} ${cl.cross_number}`))
      .filter((c): c is Course => c !== undefined && !processed.has(c.id));

    const forwardIds = new Set(forwardLinked.map((c) => c.id));
    const reverseLinked = crossListings
      .filter(
        (cl) =>
          cl.cross_subject === course.subject &&
          cl.cross_number === course.number &&
          cl.course_id !== course.id
      )
      .map((cl) => courses.find((c) => c.id === cl.course_id))
      .filter(
        (c): c is Course =>
          c !== undefined && !processed.has(c.id) && !forwardIds.has(c.id)
      );

    const linked = [...forwardLinked, ...reverseLinked];

    if (linked.length > 0) {
      const group = [course.id, ...linked.map((c) => c.id)];
      pairs.push(group);
      for (const id of group) processed.add(id);
    } else {
      processed.add(course.id);
    }
  }

  return pairs;
}

/**
 * Walk the tree depth-first in sort_order and return course IDs in curriculum order.
 */
function getCourseOrderFromTree(nodes: ReqNode[]): number[] {
  const result: number[] = [];
  const seen = new Set<number>();

  function visit(parentId: number | null) {
    const children = nodes
      .filter((n) => n.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const node of children) {
      if (node.node_type === "ATOM") {
        const courseId = node.program_req_atoms[0]?.required_course_id;
        if (courseId && !seen.has(courseId)) {
          seen.add(courseId);
          result.push(courseId);
        }
      } else {
        visit(node.id);
      }
    }
  }

  visit(null);
  return result;
}

export default async function ProgramDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: programRow, error: programError } = await supabase
    .from(DB_VIEWS.programCatalog)
    .select("program_id, program_name, catalog_year, program_type")
    .eq("program_id", id)
    .maybeSingle();

  if (programError || !programRow) {
    notFound();
  }

  const { data: blockRows, error: blocksError } = await supabase
    .from(DB_VIEWS.programRequirementDetail)
    .select(
      "block_id, block_name, rule, n_required, credits_required, courses, cross_listings, req_nodes"
    )
    .eq("program_id", id)
    .order("block_name");

  if (blocksError) {
    throw new Error(`Failed to load requirement blocks: ${blocksError.message}`);
  }

  const transformedBlocks = ((blockRows as ViewProgramRequirementDetailRow[] | null) ?? []).map(
    (block) => {
      const courses = (block.courses ?? []).map(toCourse);
      const courseMap = new Map<number, Course>(courses.map((course) => [course.id, course]));

      const nodes = parseReqNodes(block.req_nodes ?? []);
      const options = parseOptionGroups(nodes, courseMap);

      const order = getCourseOrderFromTree(nodes);
      const orderedCourses = order.length
        ? [...courses].sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            const aPos = ai === -1 ? Number.POSITIVE_INFINITY : ai;
            const bPos = bi === -1 ? Number.POSITIVE_INFINITY : bi;
            return aPos - bPos;
          })
        : courses;

      const crossListings = (block.cross_listings ?? []).map(toCrossListing);
      const crossPairs = computeCrossPairs(orderedCourses, crossListings);

      return {
        id: String(block.block_id),
        name: block.block_name,
        rule: block.rule,
        n_required: block.n_required == null ? null : Number(block.n_required),
        credits_required:
          block.credits_required == null ? null : Number(block.credits_required),
        courses: orderedCourses,
        options,
        crossPairs,
      };
    }
  );

  const program = programRow as ViewProgramCatalogRow;

  return (
    <ProgramDetailClient
      program={{
        id: String(program.program_id),
        name: program.program_name,
        catalog_year: program.catalog_year ? Number(program.catalog_year) || null : null,
        program_type: String(program.program_type ?? ""),
      }}
      blocks={transformedBlocks}
    />
  );
}
