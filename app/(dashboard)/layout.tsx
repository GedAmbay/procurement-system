import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import DashboardShell from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || !(session.user as any)?.id) redirect("/login");
  if ((session.user as any)?.mustChangePassword) redirect("/change-password");

  return (
    <SidebarProvider>
      <DashboardShell user={session.user as any}>
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
