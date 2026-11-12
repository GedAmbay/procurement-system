import React from "react";

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  badge?: React.ReactNode;
  progressPercent?: number;
  className?: string;
  onClick?: () => void;
}

export function StatTile({
  label,
  value,
  subtext,
  badge,
  progressPercent,
  className = "",
  onClick,
}: StatTileProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between ${
        onClick ? "cursor-pointer hover:border-slate-300 transition-colors" : ""
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
          {badge && <div>{badge}</div>}
        </div>

        <div className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-2">
          {value}
        </div>

        {progressPercent !== undefined && (
          <div className="w-full bg-slate-100 rounded-full h-1.5 my-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        )}
      </div>

      {subtext && (
        <div className="text-xs text-slate-500 font-medium mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

