"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

const PROFILE_IMAGE_BUCKET = "profile-images";
const STAFF_TABLE = "staff";

interface UseUserProfileOptions {
  includeAvatar?: boolean;
}

interface UseUserProfileResult {
  userName: string;
  avatarUrl: string;
  loading: boolean;
}

export function useUserProfile(
  options: UseUserProfileOptions = {}
): UseUserProfileResult {
  const { includeAvatar = false } = options;
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAvatarSignedUrl(path: string): Promise<string> {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(PROFILE_IMAGE_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    }

    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { first_name, last_name } = user.user_metadata ?? {};
      const fallbackName = [first_name, last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      setUserName(fallbackName);

      // Try student table first
      const { data: student } = await supabase
        .from(DB_TABLES.students)
        .select("first_name, last_name, avatar_path")
        .eq(STUDENT_COLUMNS.authUserId, user.id)
        .maybeSingle();

      if (student) {
        const studentName = [student.first_name, student.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        setUserName(studentName || fallbackName);

        if (includeAvatar && student.avatar_path) {
          try {
            setAvatarUrl(await loadAvatarSignedUrl(student.avatar_path));
          } catch {
            setAvatarUrl("");
          }
        }
        setLoading(false);
        return;
      }

      // Fallback to staff table
      const { data: staff } = await supabase
        .from(STAFF_TABLE)
        .select("first_name, last_name, avatar_path")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staff) {
        const staffName = [staff.first_name, staff.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        setUserName(staffName || fallbackName);

        if (includeAvatar && staff.avatar_path) {
          try {
            setAvatarUrl(await loadAvatarSignedUrl(staff.avatar_path));
          } catch {
            setAvatarUrl("");
          }
        }
      }
      setLoading(false);
    }

    loadUser();
  }, [includeAvatar]);

  return { userName, avatarUrl, loading };
}
