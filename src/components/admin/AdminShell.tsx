"use client";

import React from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import LayoutShell from "@/components/shared/LayoutShell";

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LayoutShell sidebar={<AdminSidebar />} header={<AdminHeader />}>
      {children}
    </LayoutShell>
  );
}
