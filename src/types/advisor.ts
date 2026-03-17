export interface Advisor {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface ProgramAdvisor {
  advisor_id: string;
  program_id: string;
}
