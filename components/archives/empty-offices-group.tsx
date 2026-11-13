"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmptyOfficesGroupProps } from "./types";
import { FolderTile } from "./folder-tile";

export function EmptyOfficesGroup({
  offices,
  fiscalYear,
  defaultOpen = true,
  onActionClick,
  className = "",
}: EmptyOfficesGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!offices || offices.length === 0) {
    return null;
  }

  const officeCountText = `${offices.length} ${offices.length === 1 ? "office" : "offices"}`;

  return (
    <section className={`mt-10 ${className}`} aria-label={`Empty offices in FY ${fiscalYear}`}>
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="empty-offices-grid"
        className="group w-full flex items-center justify-between py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#0f172a] tracking-tight">
            No folders in FY {fiscalYear} ·{" "}
            <span className="text-[#5b6b82] font-normal">{officeCountText}</span>
          </h2>
        </div>

        <div className="flex items-center text-slate-400 group-hover:text-slate-700 transition-colors">
          <ChevronDown
            size={20}
            className={`transition-transform duration-200 ease-out ${
              isOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {/* Collapsible Body */}
      {isOpen && (
        <div
          id="empty-offices-grid"
          className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-7 gap-y-8 animate-in fade-in duration-200"
        >
          {offices.map((office) => (
            <FolderTile
              key={office.id}
              office={office}
              fiscalYear={fiscalYear}
              isEmpty={true}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default EmptyOfficesGroup;

