const SUBJECT_COLOR_MAP: Record<string, string> = {
  CS: "blue",
  CSCI: "blue",
  MATH: "violet",
  ENGL: "orange",
  COMM: "amber",
  PHIL: "teal",
  PSYC: "pink",
  BUSI: "cyan",
  BIOL: "emerald",
  BIOS: "emerald",
  CHEM: "red",
  PHYS: "teal",
  HIST: "yellow",
  ECON: "cyan",
  ART: "orange",
  MUSC: "violet",
  SOCI: "pink",
};

export function getSubjectColor(prefix: string): string {
  return SUBJECT_COLOR_MAP[prefix.toUpperCase()] ?? "gray";
}
