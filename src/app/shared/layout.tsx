import DashboardShell from "@/components/dashboard/DashboardShell";

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
