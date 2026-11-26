"use client";

import React, { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSidebar } from "@/components/layout/sidebar-context";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import Breadcrumb from "@/components/layout/breadcrumb";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface DashboardUser {
  id?: string;
  name?: string | null;
  nickname?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string;
  officeId?: string | null;
  officeName?: string;
}

export default function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser;
  children: React.ReactNode;
}) {
  const { isRail, isEditor } = useSidebar();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut({ callbackUrl: "/login?reason=idle" });
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, []);

  return (
    <div
      className="dashboard-container print:!bg-white print:!min-h-0 print:!h-auto print:!block"
      style={{ display: "flex", minHeight: "var(--full-vh)", background: "var(--color-page-bg, #e8edf4)" }}
    >
      <Sidebar user={user} />
      <div
        className={`main-content print:!bg-white print:!min-h-0 print:!h-auto print:!block ${isRail ? "is-rail" : ""
          }`}
        style={{ flex: 1, background: "var(--color-page-bg, #e8edf4)" }}
      >
        <Topbar user={user} />
        <main
          className={`page-content print:!bg-white print:!min-h-0 print:!h-auto print:!block ${isEditor ? "!p-0 overflow-hidden" : ""
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

