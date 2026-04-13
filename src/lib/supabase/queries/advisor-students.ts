export function computeProgressPct(
  completed: Set<number>,
  required: Set<number>
): number {
  if (required.size === 0) return 0;
  let hit = 0;
  for (const id of required) if (completed.has(id)) hit++;
  return Math.round((hit / required.size) * 100);
}
