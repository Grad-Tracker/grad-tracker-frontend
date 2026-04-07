const PROGRAM_COLOR_MAP: Record<string, string> = {
  MAJOR: "blue",
  MINOR: "purple",
  GRADUATE: "green",
  CERTIFICATE: "orange",
};

const PROGRAM_TYPE_LABEL_MAP: Record<string, string> = {
  MAJOR: "Major",
  MINOR: "Minor",
  GRADUATE: "Graduate",
  CERTIFICATE: "Certificate",
};

export function getProgramColor(type: string): string {
  return PROGRAM_COLOR_MAP[type] || "gray";
}

export function getProgramTypeLabel(type: string): string {
  return PROGRAM_TYPE_LABEL_MAP[type] || type;
}
