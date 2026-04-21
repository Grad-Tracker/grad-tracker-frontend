export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isStudentEmail(email: string): boolean {
  return normalizeEmail(email).endsWith("@rangers.uwp.edu");
}

export function isAdvisorEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.endsWith("@uwp.edu") && !normalized.endsWith("@rangers.uwp.edu");
}
