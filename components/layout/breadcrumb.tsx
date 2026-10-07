"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/purchase-requests": "Purchase Requests",
  "/rfqs": "Requests for Quotation",
  "/abstract": "Abstract of Canvass",
  "/purchase-orders": "Purchase Orders",
  "/suppliers": "Suppliers",
  "/items": "Items & Catalog",
  "/signatories": "Signatories",
  "/fund-sources": "Fund Sources",
  "/offices": "Offices",
  "/users": "User Management",
  "/audit-log": "Audit Trail",
  "/reports": "Reports",
  "/acceptances": "Acceptance and Inspection",
  "/archives": "Archives",
};

export default function Breadcrumb() {
  const pathname = usePathname();

  // Do not show breadcrumb on top-level pages
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;

  // Do not show global breadcrumb for archives and procurement-folders 
  // because they have their own specific data-driven breadcrumbs.
  if (segments[0] === "archives" || segments[0] === "procurement-folders") {
    return null;
  }

  const rootPath = `/${segments[0]}`;
  const rootTitle = pageTitles[rootPath] || "ProcureEase";
  
  const crumbs = [{ label: rootTitle, href: rootPath }];

  if (segments[0] === "abstract") {
    crumbs.push({ label: "Abstract Hub", href: `/abstract/${segments[1]}` });
    if (segments.length > 2) {
      crumbs.push({ label: "Live Preview", href: pathname });
    }
  } else if (segments[0] === "acceptances") {
    if (segments[1] === "hub") {
       crumbs.push({ label: "Delivery Hub", href: pathname });
    } else {
       crumbs.push({ label: "Live Preview", href: pathname });
    }
  } else if (segments[0] === "archives") {
    if (segments.length === 2) crumbs.push({ label: "Department Folders", href: pathname });
  } else if (segments[0] === "procurement-folders") {
    crumbs.push({ label: "Folder View", href: pathname });
  } else {
    crumbs.push({ label: "Live Preview", href: pathname });
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 600 }}>
      {crumbs.map((crumb, index, arr) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link 
            href={crumb.href} 
            style={{ 
              color: index === arr.length - 1 ? "#1e293b" : "#64748b", 
              textDecoration: "none" 
            }}
          >
            {crumb.label}
          </Link>
          {index < arr.length - 1 && (
            <ChevronRight size={14} color="#94a3b8" />
          )}
        </div>
      ))}
    </div>
  );
}
