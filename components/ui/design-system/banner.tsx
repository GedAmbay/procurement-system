import React from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

export interface BannerProps {
  variant?: "warning" | "info" | "success" | "error";
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Banner({
  variant = "warning",
  children,
  icon,
  className = "",
}: BannerProps) {
  const configs = {
    warning: {
      bg: "bg-amber-50/70 border-amber-200/80 text-amber-900",
      icon: <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />,
    },
    info: {
      bg: "bg-blue-50/70 border-blue-200/80 text-blue-900",
      icon: <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />,
    },
    success: {
      bg: "bg-emerald-50/70 border-emerald-200/80 text-emerald-900",
      icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />,
    },
    error: {
      bg: "bg-red-50/70 border-red-200/80 text-red-900",
      icon: <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />,
    },
  };

  const current = configs[variant];

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 flex items-start gap-3 text-xs leading-relaxed ${current.bg} ${className}`}
    >
      {icon !== undefined ? icon : current.icon}
      <div className="flex-1 font-medium">{children}</div>
    </div>
  );
}

