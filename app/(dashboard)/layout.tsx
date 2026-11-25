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
  if (!session || !session.user?.id) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <SidebarProvider>
      <DashboardShell user={session.user}>
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
