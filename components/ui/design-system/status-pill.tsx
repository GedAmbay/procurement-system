import React from "react";

export type StatusPillVariant =
  | "draft"
  | "pending"
  | "returned"
  | "no_bid"
  | "lowest_so_far"
  | "provisional"
  | "finalized"
  | "issued"
  | "custom";

export interface StatusPillProps {
  variant?: StatusPillVariant;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatusPill({
  variant = "pending",
  label,
  icon,
  className = "",
}: StatusPillProps) {
  const configs: Record<
    Exclude<StatusPillVariant, "custom">,
    { bg: string; text: string; border: string; defaultLabel: string; icon?: React.ReactNode }
  > = {
    draft: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200/80",
      defaultLabel: "Draft",
    },
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200/80",
      defaultLabel: "Pending",
    },
    returned: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200/80",
      defaultLabel: "Returned",
    },
    no_bid: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      defaultLabel: "No bid",
    },
    lowest_so_far: {
      bg: "bg-emerald-50",
      text: "text-emerald-700 font-semibold",
      border: "border-emerald-200",
      defaultLabel: "Lowest so far",
      icon: <span>★</span>,
    },
    provisional: {
      bg: "bg-amber-50",
      text: "text-amber-800 font-medium",
      border: "border-amber-200",
      defaultLabel: "Provisional",
    },
    finalized: {
      bg: "bg-blue-50",
      text: "text-blue-700 font-semibold",
      border: "border-blue-200",
      defaultLabel: "Finalized",
    },
    issued: {
      bg: "bg-purple-50",
      text: "text-purple-700 font-semibold",
      border: "border-purple-200",
      defaultLabel: "Issued",
    },
  };

  const current = variant !== "custom" ? configs[variant] : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        current
          ? `${current.bg} ${current.text} ${current.border}`
          : "bg-slate-100 text-slate-700 border-slate-200"
      } ${className}`}
    >
      {icon || current?.icon}
      <span>{label || current?.defaultLabel}</span>
    </span>
  );
}

