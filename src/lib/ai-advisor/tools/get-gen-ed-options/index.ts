import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetGenEdOptionsInput = {
  bucketName?: string;
  bucketId?: number;
};

export const GET_GEN_ED_OPTIONS_DEFINITION = {
  name: "get_gen_ed_options",
  description:
    "List all courses that satisfy a general education requirement bucket. Use when the student asks 'what can I take for my gen-ed X requirement?' or 'what counts toward my math requirement?'.",
  input_schema: {
    type: "object" as const,
    properties: {
      bucketName: { type: "string" as const, description: 'Partial gen-ed bucket name to search for, e.g. "Math" or "Writing"' },
      bucketId: { type: "integer" as const, description: "Exact gen-ed bucket ID if known" },
    },
  },
} as const;

export function createGetGenEdOptionsTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetGenEdOptionsInput) {
    const buckets = await deps.getGenEdOptions(
      input?.bucketName ?? null,
      input?.bucketId != null ? Number(input.bucketId) : null
    );
    return { buckets, total: buckets.length };
  };
}
