export interface Course {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
  description?: string | null;
  prereq_text?: string | null;
  is_active?: boolean;
}

/** Row returned by the paginated list query */
export interface CourseListItem {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
  is_active: boolean;
}

/** Full detail row (includes description + prereq_text) */
export interface CourseDetail {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
  description: string | null;
  prereq_text: string | null;
  is_active: boolean;
}

/** Paginated list result */
export interface CoursePage {
  data: CourseListItem[];
  total: number;
}

/** Input for add / edit */
export interface CourseInput {
  subject: string;
  number: string;
  title: string;
  credits: number;
  description?: string | null;
  prereq_text?: string | null;
}

export interface CourseFilters {
  search: string;
  subject: string | null;
}
