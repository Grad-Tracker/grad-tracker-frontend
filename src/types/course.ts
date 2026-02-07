export interface Course {
  id: number;
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
