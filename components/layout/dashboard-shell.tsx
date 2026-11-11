"use client";

import React from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import Breadcrumb from "@/components/layout/breadcrumb";

export default function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const { isRail, isEditor } = useSidebar();

  return (
    <div
      className="dashboard-container print:!bg-white print:!min-h-0 print:!h-auto print:!block"
      style={{ display: "flex", minHeight: "var(--full-vh)", background: "var(--color-page-bg, #e8edf4)" }}
    >
      <Sidebar user={user} />
      <div
        className={`main-content print:!bg-white print:!min-h-0 print:!h-auto print:!block ${
          isRail ? "is-rail" : ""
        }`}
        style={{ flex: 1, background: "var(--color-page-bg, #e8edf4)" }}
      >
        <Topbar user={user} />
        <main
          className={`page-content print:!bg-white print:!min-h-0 print:!h-auto print:!block ${
            isEditor ? "!p-0 overflow-hidden" : ""
          }`}
          style={{ display: "flex", flexDirection: "column" }}
        >
          {!isEditor && (
            <div className="no-print">
              <Breadcrumb />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

