import { LuGraduationCap, LuBookOpen, LuAward } from "react-icons/lu";
import type { Program } from "@/types/onboarding";

export const TYPE_ORDER: Program["program_type"][] = [
  "MAJOR",
  "MINOR",
  "CERTIFICATE",
  "GRADUATE",
];

export const TYPE_META: Record<
  string,
  { label: string; color: string; icon: typeof LuGraduationCap }
> = {
  MAJOR: { label: "Majors", color: "blue", icon: LuGraduationCap },
  MINOR: { label: "Minors", color: "purple", icon: LuBookOpen },
  CERTIFICATE: { label: "Certificates", color: "orange", icon: LuAward },
  GRADUATE: {
    label: "Graduate Programs",
    color: "purple",
    icon: LuGraduationCap,
  },
};
