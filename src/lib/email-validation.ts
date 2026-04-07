export type UserRole = "student" | "advisor";

interface EmailValidationResult {
  isValid: boolean;
  errorTitle?: string;
  errorDescription?: string;
}

const STUDENT_DOMAIN = "@rangers.uwp.edu";
const ADVISOR_DOMAIN = "@uwp.edu";

export function validateEmailDomain(role: UserRole, email: string): EmailValidationResult {
  const normalizedEmail = email.trim().toLowerCase();
  if (role === "student") {
    if (!normalizedEmail.endsWith(STUDENT_DOMAIN)) {
      return { isValid: false, errorTitle: "Invalid email domain", errorDescription: "Student sign up requires a @rangers.uwp.edu email address." };
    }
  } else {
    if (!normalizedEmail.endsWith(ADVISOR_DOMAIN) || normalizedEmail.endsWith(STUDENT_DOMAIN)) {
      return { isValid: false, errorTitle: "Invalid email domain", errorDescription: "Advisor sign up requires a @uwp.edu email address." };
    }
  }
  return { isValid: true };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
