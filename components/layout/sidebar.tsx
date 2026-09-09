"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, FileText, ClipboardList,
  Package, Users, Building2, Tag, Wallet,
  BarChart3, History, Settings, ChevronRight, Shield
} from "lucide-react";
import { ROLE_LABELS, LGU_INFO } from "@/lib/utils";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    officeName?: string;
  };
}

const navItems = [
  {
    section: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [] },
    ],
  },
  {
    section: "Procurement",
    items: [
      { label: "Purchase Requests", href: "/purchase-requests", icon: ShoppingCart, roles: [] },
      { label: "Requests for Quotation", href: "/rfqs", icon: FileText, roles: [] },
      { label: "Abstract of Quotation", href: "/aoq", icon: ClipboardList, roles: [] },
      { label: "Purchase Orders", href: "/purchase-orders", icon: Package, roles: [] },
    ],
  },
  {
    section: "Master Data",
    items: [
      { label: "Suppliers", href: "/suppliers", icon: Building2, roles: [] },
      { label: "Items & Catalog", href: "/items", icon: Tag, roles: [] },
      { label: "Signatories", href: "/signatories", icon: Users, roles: [] },
      { label: "Fund Sources", href: "/fund-sources", icon: Wallet, roles: [] },
      { label: "Offices", href: "/offices", icon: Building2, roles: [] },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "User Management", href: "/users", icon: Users, roles: ["ADMIN"] },
      { label: "Audit Trail", href: "/audit-log", icon: History, roles: ["ADMIN", "BAC_SECRETARIAT"] },
      { label: "Reports", href: "/reports", icon: BarChart3, roles: [] },
    ],
  },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 0 2px rgba(59,130,246,0.3)",
          overflow: "hidden",
        }}>
          <img src="/pandan_logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#64748b", fontWeight: "700", fontSize: "0.9375rem", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            ProcureEase
          </div>
          <div style={{ color: "#64748b", fontSize: "0.6875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {LGU_INFO.name}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {navItems.map((section) => {
          const visibleItems = section.items.filter(
            (item) => item.roles.length === 0 || item.roles.includes(user.role ?? "")
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section} className="sidebar-nav-section">
              <div className="sidebar-nav-label">{section.section}</div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item ${active ? "active" : ""}`}
                  >
                    <Icon className="icon" />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {active && <ChevronRight size={14} />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: "1rem 0.75rem",
        borderTop: "1px solid rgba(209, 217, 230, 0.5)",
        color: "#64748b",
        fontSize: "0.6875rem",
        textAlign: "center",
      }}>
        ProcureEase v1.0 · FY 2026
      </div>
    </nav>
  );
}
