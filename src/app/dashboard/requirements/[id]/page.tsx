import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import ProgramDetailClient from "./ProgramDetailClient";
import type { Course } from "@/types/course";

type ReqNode = {
  id: number;
  node_type: string;
  parent_id: number | null;
  sort_order: number;
  program_req_atoms: { atom_type: string; required_course_id: number | null }[];
};

/**
 * Walk the OR→(ATOM|AND) tree and return option groups.
 * Each group is an array of courses that must ALL be taken together.
 * Returns null when the root is not OR (flat rendering is fine).
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
 * this block (e.g. [[CSCI 231 id, MATH 231 id]]).
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
    // Forward: cross-listing entries FROM this course
    const forwardLinked = crossListings
      .filter((cl) => cl.course_id === course.id)
      .map((cl) => coursesByKey.get(`${cl.cross_subject} ${cl.cross_number}`))
      .filter((c): c is Course => c !== undefined && !processed.has(c.id));

    // Reverse: cross-listing entries TO this course from other courses
    const forwardIds = new Set(forwardLinked.map((c) => c.id));
    const reverseLinked = crossListings
      .filter((cl) => cl.cross_subject === course.subject && cl.cross_number === course.number && cl.course_id !== course.id)
      .map((cl) => courses.find((c) => c.id === cl.course_id))
      .filter((c): c is Course => c !== undefined && !processed.has(c.id) && !forwardIds.has(c.id));

    const linked = [...forwardLinked, ...reverseLinked];

    if (linked.length > 0) {
      const group = [course.id, ...linked.map((c) => c.id)];
      pairs.push(group);
      group.forEach((id) => { processed.add(id); });
    } else {
      processed.add(course.id);
    }
  }

  return pairs;
}

/**
 * Walk the tree depth-first in sort_order and return course IDs in curriculum order.
 * Used to sort the flat course list so it matches the intended progression.
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: program, error: programError } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .eq("id", id)
    .single();

  if (programError || !program) {
    notFound();
  }

  const { data: blocks, error: blocksError } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select(`
      id, name, rule, n_required, credits_required,
      program_requirement_courses (
        courses:course_id ( id, subject, number, title, credits, description, course_req_sets(set_type, note) )
      )
    `)
    .eq("program_id", id)
    .order("name");

  if (blocksError) {
    throw new Error(`Failed to load requirement blocks: ${blocksError.message}`);
  }

  // Build a map of course id → Course for tree parsing
  const allCourses: Course[] = (blocks ?? []).flatMap((block: any) =>
    block.program_requirement_courses
      .map((prc: any) => prc.courses)
      .filter(Boolean)
      .map((c: any): Course => ({
        id: c.id,
        subject: c.subject,
        number: c.number,
        title: c.title,
        credits: c.credits,
        description: c.description,
        prereq_text:
          (c.course_req_sets as Array<{ set_type: string; note: string | null }> | null)
            ?.find((s) => s.set_type === "PREREQ")?.note ?? null,
      }))
  );
  const courseMap = new Map<number, Course>(allCourses.map((c) => [c.id, c]));

  // Fetch cross-listings for all courses so we can group alternatives in the table
  const allCourseIds = allCourses.map((c) => c.id);
  const { data: crossListingData, error: crossListingError } = allCourseIds.length
    ? await supabase
        .from("course_crosslistings")
        .select("course_id, cross_subject, cross_number")
        .in("course_id", allCourseIds)
    : { data: [], error: null };

  if (crossListingError) {
    throw new Error(`Failed to load cross-listings: ${crossListingError.message}`);
  }

  // Fetch OR/AND tree structure for all blocks.
  // Two separate queries are more reliable than a 3-level nested select.
  const blockIds = (blocks ?? []).map((b: any) => b.id);

  // Step 1: sets + their nodes (no atoms yet)
  const { data: reqSets, error: reqSetsError } = blockIds.length
    ? await supabase
        .from("program_req_sets")
        .select("id, block_id, program_req_nodes ( id, node_type, parent_id, sort_order )")
        .in("block_id", blockIds)
    : { data: [], error: null };

  if (reqSetsError) {
    throw new Error(`Failed to load requirement sets: ${reqSetsError.message}`);
  }

  // Step 2: collect node IDs, then fetch atoms for them
  const allNodeIds = (reqSets ?? []).flatMap((s: any) =>
    (s.program_req_nodes ?? []).map((n: any) => n.id as number)
  );

  const { data: atomRows, error: atomRowsError } = allNodeIds.length
    ? await supabase
        .from("program_req_atoms")
        .select("node_id, atom_type, required_course_id")
        .in("node_id", allNodeIds)
    : { data: [], error: null };

  if (atomRowsError) {
    throw new Error(`Failed to load requirement atoms: ${atomRowsError.message}`);
  }

  // Step 3: build nodeId → atom lookup and merge into ReqNode[]
  const atomByNodeId = new Map<number, { atom_type: string; required_course_id: number | null }>();
  for (const atom of atomRows ?? []) {
    atomByNodeId.set((atom as any).node_id, atom as any);
  }

  const nodesByBlockId = new Map<number, ReqNode[]>();
  for (const set of reqSets ?? []) {
    const blockId = (set as any).block_id as number;
    const nodes: ReqNode[] = ((set as any).program_req_nodes ?? []).map((n: any) => ({
      id: n.id,
      node_type: n.node_type,
      parent_id: n.parent_id,
      sort_order: n.sort_order,
      program_req_atoms: atomByNodeId.has(n.id) ? [atomByNodeId.get(n.id)!] : [],
    }));
    const existing = nodesByBlockId.get(blockId) ?? [];
    nodesByBlockId.set(blockId, [...existing, ...nodes]);
  }

  // Step 4: parse each block's tree into option groups and course order
  const optionsByBlock = new Map<number, Course[][]>();
  const orderByBlock = new Map<number, number[]>();
  for (const [blockId, nodes] of nodesByBlockId) {
    const options = parseOptionGroups(nodes, courseMap);
    if (options) optionsByBlock.set(blockId, options);

    const order = getCourseOrderFromTree(nodes);
    if (order.length > 0) orderByBlock.set(blockId, order);
  }

  const transformedBlocks = (blocks ?? []).map((block: any) => {
    const courses = block.program_requirement_courses
      .map((prc: any) => prc.courses)
      .filter(Boolean)
      .map((c: any): Course => ({
        id: c.id,
        subject: c.subject,
        number: c.number,
        title: c.title,
        credits: c.credits,
        description: c.description,
        prereq_text:
          (c.course_req_sets as Array<{ set_type: string; note: string | null }> | null)
            ?.find((s) => s.set_type === "PREREQ")?.note ?? null,
      }));

    // Sort courses by curriculum progression order from the tree
    const treeOrder = orderByBlock.get(block.id);
    const orderedCourses = treeOrder
      ? [...courses].sort((a, b) => {
          const ai = treeOrder.indexOf(a.id);
          const bi = treeOrder.indexOf(b.id);
          const aPos = ai === -1 ? Infinity : ai;
          const bPos = bi === -1 ? Infinity : bi;
          return aPos - bPos;
        })
      : courses;

    const crossPairs = computeCrossPairs(orderedCourses, crossListingData ?? []);

    return {
      id: block.id,
      name: block.name,
      rule: block.rule,
      n_required: block.n_required,
      credits_required: block.credits_required,
      courses: orderedCourses,
      options: optionsByBlock.get(block.id) ?? null,
      crossPairs,
    };
  });

  return <ProgramDetailClient program={program} blocks={transformedBlocks} />;
}
