import React from "react";

interface StatusBadgeProps {
  status: string | boolean | null | undefined;
  label?: string;
  className?: string;
}

export function formatStatusLabel(status: string | boolean | null | undefined): string {
  if (status === true || status === "true") return "Active";
  if (status === false || status === "false") return "Inactive";
  if (!status) return "Draft";

  const str = String(status).toUpperCase();
  switch (str) {
    case "DRAFT":
      return "Draft";
    case "ISSUED":
      return "Issued";
    case "SIGNED":
      return "Signed";
    case "COMPLETED":
      return "Completed";
    case "PARTIAL":
      return "Partial";
    case "PARTIALLY_DELIVERED":
      return "Partially Delivered";
    case "APPROVED":
      return "Approved";
    case "SUBMITTED":
      return "Submitted";
    case "FOR_SIGNING":
      return "For Signing";
    case "CANCELLED":
      return "Cancelled";
    case "REJECTED":
      return "Rejected";
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    default:
      return str
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export default function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  const displayLabel = label || formatStatusLabel(status);
  const normalized = typeof status === "boolean" ? (status ? "ACTIVE" : "INACTIVE") : String(status || "DRAFT").toUpperCase();

  // Color mapping with uniform dot + pill design
  let badgeStyle = "bg-slate-100 text-slate-700";
  let dotStyle = "bg-slate-500";

  if (["DRAFT", "PENDING", "NEW"].includes(normalized)) {
    // Amber / Warning
    badgeStyle = "bg-amber-100/90 text-amber-800";
    dotStyle = "bg-amber-500";
  } else if (["ISSUED", "SUBMITTED", "IN_PROGRESS", "PARTIAL", "PARTIALLY_DELIVERED"].includes(normalized)) {
    // Blue / Info
    badgeStyle = "bg-blue-100/90 text-blue-800";
    dotStyle = "bg-blue-600";
  } else if (["SIGNED", "FOR_SIGNING", "APPROVED"].includes(normalized)) {
    // Indigo / Violet
    badgeStyle = "bg-indigo-100/90 text-indigo-800";
    dotStyle = "bg-indigo-600";
  } else if (["COMPLETED", "ACTIVE", "DELIVERED", "AWARDED"].includes(normalized)) {
    // Emerald / Success
    badgeStyle = "bg-emerald-100/90 text-emerald-800";
    dotStyle = "bg-emerald-600";
  } else if (["CANCELLED", "REJECTED", "DISAPPROVED", "INACTIVE", "DELETED"].includes(normalized)) {
    // Rose / Destructive
    badgeStyle = "bg-rose-100/90 text-rose-800";
    dotStyle = "bg-rose-600";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-none ${badgeStyle} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotStyle}`} />
      <span>{displayLabel}</span>
    </span>
  );
}

