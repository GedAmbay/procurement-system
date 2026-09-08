import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar user={session.user as any} />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar user={session.user as any} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
