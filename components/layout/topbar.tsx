"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  LogOut,
  ChevronDown,
  User,
  PanelLeft,
  Building2,
  Users,
  FileText,
  UserCog,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useSidebar } from "@/components/layout/sidebar-context";

interface TopbarProps {
  user: {
    name?: string | null;
    nickname?: string | null;
    username?: string | null;
    email?: string | null;
    role?: string;
    officeName?: string;
  };
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/purchase-requests": "Purchase Requests",
  "/rfqs": "Requests for Quotation",
  "/abstract": "Abstract of Canvass",
  "/purchase-orders": "Purchase Orders",
  "/suppliers": "Suppliers",
  "/signatories": "Signatories",
  "/offices": "Offices",
  "/users": "User Management",
  "/audit-log": "Audit Trail",
  "/acceptances": "Acceptance & Inspection",
  "/archives": "Archives",
  "/profile": "Edit Profile",
};

interface CalendarNotification {
  id: string;
  title: string;
  message: string;
  date: string | Date;
}

export default function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const { isEditor, isRail, isOverlayOpen, toggleOverlay, toggleButtonRef } = useSidebar();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<CalendarNotification[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchNotifs() {
      if (user.role === "ADMIN" || user.role === "BAC_SECRETARIAT") {
        try {
          const res = await fetch("/api/calendar/notifications");
          if (res.ok) {
            const data = await res.json();
            setNotifications(data);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    fetchNotifs();
  }, [user.role]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const getTitle = () => {
    const exact = pageTitles[pathname];
    if (exact) return exact;
    for (const [key, val] of Object.entries(pageTitles)) {
      if (pathname.startsWith(key + "/")) return val;
    }
    return "ProcureEase";
  };

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {(isEditor || isRail) && (
          <button
            ref={toggleButtonRef}
            type="button"
            onClick={toggleOverlay}
            aria-label={isOverlayOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOverlayOpen}
            aria-controls="primary-sidebar"
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 shrink-0"
            title={isOverlayOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            <PanelLeft size={18} />
          </button>
        )}
        <h1 style={{ fontSize: "1.75rem", fontWeight: "900", color: "#0f172a", marginLeft: (isEditor || isRail) ? "0" : "10px" }}>
          {getTitle()}
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Notification Bell */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              width: "42px", height: "42px", borderRadius: "50%",
              border: "none", background: "var(--color-page-bg)",
              boxShadow: "var(--shadow-neu-drop-sm)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: notifications.length > 0 ? "#2563eb" : "#64748b", position: "relative",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseDown={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-inner-sm)"}
            onMouseUp={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-drop-sm)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-drop-sm)"}
            title="Notifications"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span style={{
                position: "absolute", top: "7px", right: "7px",
                width: "16px", height: "16px", borderRadius: "50%",
                background: "#ef4444", border: "1.5px solid white",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: "9px", fontWeight: "bold"
              }}>{notifications.length}</span>
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "0.75rem",
              background: "white", borderRadius: "12px", width: "320px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0", zIndex: 50, overflow: "hidden"
            }}>
              <div style={{ padding: "1rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a" }}>Notifications</h3>
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div key={n.id} style={{ padding: "1rem", borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} className="hover:bg-slate-50">
                      <div style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#0f172a", marginBottom: "0.25rem" }}>{n.title}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>{n.message}</div>
                      <div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{format(new Date(n.date), "MMM d, yyyy")}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem" }}>
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            type="button"
            aria-expanded={showMenu}
            aria-haspopup="true"
            className={`group flex items-center gap-2.5 py-1 pl-1.5 pr-3 rounded-full cursor-pointer transition-all duration-200 select-none ${showMenu
              ? "bg-white ring-2 ring-blue-500/20 shadow-sm"
              : "bg-[var(--color-page-bg)] hover:bg-white/80"
              }`}
            style={{
              boxShadow: showMenu ? "0 4px 12px rgba(15,23,42,0.08)" : "var(--shadow-neu-drop-sm)",
            }}
          >
            {/* Avatar with User icon & online dot */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white ring-2 ring-white/90 shadow-2xs">
                <User size={15} className="stroke-[2.25]" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            {/* User name & role label */}
            <div className="text-left hidden sm:block">
              <div className="text-sm font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                {user.nickname?.trim() || user.name?.split(" ")[0]}
              </div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                {user.role === "END_USER" ? "CLERK" : user.role?.replace(/_/g, " ")}
              </div>
            </div>

            {/* Chevron with rotation animation */}
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${showMenu ? "rotate-180 text-blue-600" : "group-hover:text-slate-600"
                }`}
            />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-[calc(100%+0.625rem)] w-72 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.06)] z-50 overflow-hidden"
              style={{
                transformOrigin: "top right",
                animation: "dropdownOpen 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              {/* Header: User Identity & Profile details */}
              <div className="p-3.5 bg-gradient-to-b from-slate-50 via-blue-50/30 to-white border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white ring-2 ring-white shadow-xs">
                      <User size={18} className="stroke-[2.25]" />
                    </div>
                    <span
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center"
                      title="Active Session"
                    >
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-900 truncate tracking-tight leading-snug">
                      {user.nickname?.trim() || user.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5 font-normal">
                      {user.nickname?.trim() && user.name ? `${user.name} • ` : ""}
                      {user.username ? `ID: ${user.username}` : user.email || "No ID"}
                      {user.email && user.username ? ` • ${user.email}` : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-600 truncate max-w-[170px]">
                    <Building2 size={12} className="text-slate-400 shrink-0" />
                    {user.officeName || "Bids & Awards Committee"}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    Pandan, Antique
                  </span>
                </div>
              </div>

              {/* Quick Role Navigation Links */}
              {(user.role === "ADMIN" || user.role === "BAC_SECRETARIAT") && (
                <div className="p-1.5 space-y-0.5">
                  {user.role === "ADMIN" && (
                    <Link
                      href="/users"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                        <Users size={14} />
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold block">User Management</span>
                        <span className="text-[10px] text-slate-400 block font-normal leading-tight">
                          System accounts & roles
                        </span>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/audit-log"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                      <FileText size={14} />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold block">Audit Trail</span>
                      <span className="text-[10px] text-slate-400 block font-normal leading-tight">
                        System events & activity
                      </span>
                    </div>
                  </Link>
                </div>
              )}

              {/* Account & Edit Profile */}
              <div className="p-1.5 border-t border-slate-100">
                <Link
                  href="/profile"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <UserCog size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold block">Edit Profile</span>
                    <span className="text-[10px] text-slate-400 block font-normal leading-tight">
                      Nickname & login password
                    </span>
                  </div>
                </Link>
              </div>

              {/* Sign Out Button */}
              <div className="p-1.5 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  type="button"
                  className="group w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-red-50 text-slate-700 hover:text-red-600 transition-all duration-150 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100/70 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-2xs">
                    <LogOut size={15} className="stroke-[2.25]" />
                  </div>
                  <span className="text-xs font-semibold leading-tight group-hover:text-red-700">
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
