"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, ChevronDown, User } from "lucide-react";
import { ROLE_LABELS } from "@/lib/utils";
import { useState } from "react";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    officeName?: string;
  };
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/purchase-requests": "Purchase Requests",
  "/rfqs": "Requests for Quotation",
  "/aoq": "Abstract of Quotation",
  "/purchase-orders": "Purchase Orders",
  "/suppliers": "Suppliers",
  "/items": "Items & Catalog",
  "/signatories": "Signatories",
  "/fund-sources": "Fund Sources",
  "/offices": "Offices",
  "/users": "User Management",
  "/audit-log": "Audit Trail",
  "/reports": "Reports",
};

export default function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

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
      <div>
        <h1 style={{ fontSize: "1.0625rem", fontWeight: "600", color: "#0f172a", margin: 0 }}>
          {getTitle()}
        </h1>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0, marginTop: "1px" }}>
          {user.officeName ?? "Municipality of Pandan"}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Notification Bell */}
        <button
          style={{
            width: "42px", height: "42px", borderRadius: "50%",
            border: "none", background: "var(--color-page-bg)",
            boxShadow: "var(--shadow-neu-drop-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#64748b", position: "relative",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-inner-sm)"}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-drop-sm)"}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-drop-sm)"}
          title="Notifications"
        >
          <Bell size={16} />
          <span style={{
            position: "absolute", top: "7px", right: "7px",
            width: "7px", height: "7px", borderRadius: "50%",
            background: "#ef4444", border: "1.5px solid white",
          }} />
        </button>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem 0.5rem 0.5rem",
              border: "none", borderRadius: "9999px",
              background: "var(--color-page-bg)",
              boxShadow: "var(--shadow-neu-drop-sm)",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseDown={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-inner-sm)"}
            onMouseUp={(e) => e.currentTarget.style.boxShadow = "var(--shadow-neu-drop-sm)"}
          >
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontWeight: "700", fontSize: "0.75rem",
            }}>
              {user.name?.charAt(0) ?? "U"}
            </div>
            <div style={{ textAlign: "left", display: "block" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#0f172a", lineHeight: "1.2" }}>
                {user.name?.split(" ")[0]}
              </div>
              <div style={{ fontSize: "0.625rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {user.role?.replace(/_/g, " ")}
              </div>
            </div>
            <ChevronDown size={14} color="#94a3b8" />
          </button>

          {showMenu && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                onClick={() => setShowMenu(false)}
              />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 1rem)",
                background: "var(--color-page-bg)", border: "none",
                borderRadius: "1rem", minWidth: "220px",
                boxShadow: "var(--shadow-neu-drop)",
                zIndex: 50, overflow: "hidden",
                animation: "slideUp 0.2s ease",
              }}>
                <div style={{ padding: "1rem", borderBottom: "1px solid rgba(209, 217, 230, 0.5)" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#0f172a" }}>{user.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{user.email}</div>
                  <div style={{
                    marginTop: "0.375rem",
                    display: "inline-block",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: "0.625rem",
                    fontWeight: "700",
                    padding: "0.1rem 0.5rem",
                    borderRadius: "4px",
                    textTransform: "uppercase",
                  }}>
                    {ROLE_LABELS[user.role ?? ""] ?? user.role}
                  </div>
                </div>
                <div style={{ padding: "0.5rem" }}>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
                      padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                      border: "none", background: "none", cursor: "pointer",
                      color: "#dc2626", fontSize: "0.875rem", fontWeight: "500",
                      transition: "background 0.15s",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
