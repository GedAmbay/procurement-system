"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, FileText, ClipboardList,
  Package, Users, Building2, Tag, Wallet,
  BarChart3, History, ChevronRight, CheckSquare, Archive,
  X, Pin, PinOff
} from "lucide-react";
import { LGU_INFO } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import { useEffect, useRef } from "react";

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
      { label: "Abstract", href: "/abstract", icon: ClipboardList, roles: [] },
      { label: "Purchase Orders", href: "/purchase-orders", icon: Package, roles: [] },
      { label: "Acceptance & Inspection", href: "/acceptances", icon: CheckSquare, roles: [] },
      { label: "Archives", href: "/archives", icon: Archive, roles: [] },
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
  const {
    isRail,
    isOverlayOpen,
    closeOverlay,
    isPinned,
    togglePinned,
    canPin,
    toggleButtonRef,
  } = useSidebar();

  const sidebarRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Mode: is it currently showing as the collapsed 72px rail?
  // When overlay is open, it expands to full overlay drawer even on editor routes
  const isRailMode = isRail && !isOverlayOpen;

  // Handle ESC key to close overlay and return focus to the toggle button
  useEffect(() => {
    if (!isOverlayOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
        toggleButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOverlayOpen, closeOverlay, toggleButtonRef]);

  // Trap focus within overlay when open
  useEffect(() => {
    if (!isOverlayOpen || !sidebarRef.current) return;

    // Shift initial focus to close button or first interactive element
    const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0]?.focus();
    }

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!elements || elements.length === 0) return;

      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    window.addEventListener("keydown", handleTabTrap);
    return () => window.removeEventListener("keydown", handleTabTrap);
  }, [isOverlayOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Dimmed backdrop when expanded as overlay */}
      {isOverlayOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px] z-40 transition-opacity duration-200"
          onClick={() => {
            closeOverlay();
            toggleButtonRef.current?.focus();
          }}
          aria-hidden="true"
        />
      )}

      <nav
        id="primary-sidebar"
        ref={sidebarRef}
        aria-label="Primary"
        className={`sidebar ${isRailMode ? "is-rail" : ""} ${
          isOverlayOpen ? "is-overlay is-overlay-open open" : ""
        }`}
      >
        {/* Sidebar Header / Logo */}
        {isRailMode ? (
          <div
            style={{
              padding: "1.25rem 0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <Link
              href="/dashboard"
              aria-label="ProcureEase Home"
              className="group relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-full"
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 2px rgba(59,130,246,0.3)",
                  overflow: "hidden",
                }}
              >
                <img
                  src="/pandan_logo.png"
                  alt="Logo"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150"
              >
                ProcureEase Dashboard
              </div>
            </Link>
          </div>
        ) : (
          <div className="sidebar-logo justify-between items-center">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 0 2px rgba(59,130,246,0.3)",
                  overflow: "hidden",
                }}
              >
                <img
                  src="/pandan_logo.png"
                  alt="Logo"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#f8fafc",
                    fontWeight: "700",
                    fontSize: "1.125rem",
                    lineHeight: "1.2",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  ProcureEase
                </div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.6875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {LGU_INFO.name}
                </div>
              </div>
            </div>

            {/* Action buttons when in overlay drawer */}
            {isOverlayOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {canPin && (
                  <button
                    type="button"
                    onClick={togglePinned}
                    title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
                    aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                )}
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => {
                    closeOverlay();
                    toggleButtonRef.current?.focus();
                  }}
                  aria-label="Close sidebar overlay"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation list */}
        <div className="sidebar-nav">
          {navItems.map((section, idx) => {
            const visibleItems = section.items.filter(
              (item) => item.roles.length === 0 || item.roles.includes(user.role ?? "")
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section} className={isRailMode ? "mb-2" : "sidebar-nav-section"}>
                {isRailMode ? (
                  idx > 0 ? (
                    <div
                      className="h-px bg-slate-800/80 my-2.5 mx-2"
                      role="separator"
                      aria-hidden="true"
                    />
                  ) : null
                ) : (
                  <div className="sidebar-nav-label">{section.section}</div>
                )}

                {visibleItems.map((item: any) => {
                  const Icon = item.icon;
                  const active =
                    isActive(item.href) ||
                    item.subItems?.some((sub: any) => isActive(sub.href));

                  if (isRailMode) {
                    return (
                      <div key={item.label} className="relative group/rail-item flex justify-center mb-1">
                        <Link
                          href={item.href}
                          aria-label={item.label}
                          className={`sidebar-nav-item ${active ? "active" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
                        >
                          <Icon className="icon" size={20} />
                          <span className="sr-only">{item.label}</span>
                        </Link>

                        {/* Tooltip on right side for rail mode */}
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover/rail-item:opacity-100 group-focus-within/rail-item:opacity-100 transition-opacity duration-150"
                        >
                          {item.label}
                        </div>
                      </div>
                    );
                  }

                  // Standard / Expanded item
                  return (
                    <div key={item.label} className="mb-3">
                      <Link
                        href={item.href}
                        className={`sidebar-nav-item ${active ? "active" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
                        style={{
                          marginBottom: item.subItems && active ? "0.25rem" : "0.75rem",
                        }}
                      >
                        <Icon className="icon" />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <ChevronRight size={14} className="sidebar-nav-chevron" />
                      </Link>

                      {item.subItems && (
                        <div
                          className={`sidebar-submenu ${active ? "open" : ""}`}
                          aria-hidden={!active}
                        >
                          <div className="sidebar-submenu-inner">
                            <div className="sidebar-submenu-list">
                              {item.subItems.map((sub: any) => (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  tabIndex={active ? 0 : -1}
                                  className={`sidebar-submenu-link ${
                                    pathname === sub.href ||
                                    pathname.startsWith(sub.href + "/")
                                      ? "active"
                                      : ""
                                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
                                >
                                  {sub.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer (hidden in rail mode) */}
        {!isRailMode && (
          <div
            style={{
              padding: "1rem 0.75rem",
              borderTop: "1px solid rgba(209, 217, 230, 0.1)",
              color: "#64748b",
              fontSize: "0.6875rem",
              textAlign: "center",
            }}
          >
            ProcureEase v1.0 · FY 2026
          </div>
        )}
      </nav>
    </>
  );
}
