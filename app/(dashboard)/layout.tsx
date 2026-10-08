import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

import Breadcrumb from "@/components/layout/breadcrumb";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "var(--full-vh)", background: "#f8fafc" }}>
      <Sidebar user={session.user as any} />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar user={session.user as any} />
        <main className="page-content" style={{ display: "flex", flexDirection: "column" }}>
          <div>
            <Breadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
