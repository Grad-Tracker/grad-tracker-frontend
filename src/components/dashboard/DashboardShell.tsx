"use client";

import React from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { AtlasPanelProvider } from "@/contexts/AtlasPanelContext";
import AtlasPanel from "@/components/dashboard/AtlasPanel";
import AtlasFAB from "@/components/dashboard/AtlasFAB";
import LayoutShell from "@/components/shared/LayoutShell";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AtlasPanelProvider>
      <LayoutShell sidebar={<DashboardSidebar />}>
        {children}
      </LayoutShell>

      <AtlasPanel />
      <AtlasFAB />
    </AtlasPanelProvider>
  );
}
