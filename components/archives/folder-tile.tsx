"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FolderOpen, Copy, ExternalLink, Check } from "lucide-react";
import { FolderTileProps } from "./types";

export function FolderTile({
  office,
  fiscalYear,
  onActionClick,
  className = "",
}: FolderTileProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(office.code || office.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMenuOpen(false);
  };

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen(false);
    if (onActionClick) {
      onActionClick(office, action);
    } else {
      if (action === "open") {
        router.push(`/archives/${office.id}?year=${fiscalYear}`);
      }
    }
  };

  const hasMultiplePapers = office.count >= 2;
  const targetHref = `/archives/${office.id}?year=${fiscalYear}`;

  return (
    <div className={`group flex flex-col ${className}`}>
      {/* Tile (176px tall) */}
      <Link
        href={targetHref}
        className="relative w-full h-[176px] rounded-[18px] block cursor-pointer transition-transform duration-200 ease-out group-hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-4"
        aria-label={`Open folders for ${office.name}, ${office.count} folders`}
      >
        {/* Back panel: #e9eef6 with tab on top-left */}
        <svg
          className="absolute inset-0 w-full h-full text-[#e9eef6] fill-current pointer-events-none drop-shadow-2xs"
          viewBox="0 0 280 176"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0,20 Q 0,0 20,0 L 96,0 C 112,0 120,18 136,18 L 260,18 Q 280,18 280,38 L 280,156 Q 280,176 260,176 L 20,176 Q 0,176 0,156 Z" />
        </svg>

        {/* Background second paper if >= 2 folders */}
        {hasMultiplePapers && (
          <div
            className="absolute left-[36px] top-[14px] w-[68%] h-[82px] bg-white/90 rounded-[10px] border border-slate-200/50 shadow-2xs rotate-[2deg] transition-transform duration-200 ease-out group-hover:-translate-y-[6px] pointer-events-none z-5"
            aria-hidden="true"
          />
        )}

        {/* Primary paper peeking out rotated -3deg */}
        <div
          className="absolute left-[20px] top-[16px] w-[74%] h-[84px] bg-white rounded-[10px] border border-slate-200/80 shadow-xs -rotate-3 transition-transform duration-200 ease-out group-hover:-translate-y-[6px] p-2.5 z-10 pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2">
            {/* Tiny blue doc glyph */}
            <div className="w-3.5 h-4.5 rounded-[2px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0">
              <svg
                className="w-2.5 h-3 fill-current"
                viewBox="0 0 12 16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M1 0C0.45 0 0 0.45 0 1V15C0 15.55 0.45 16 1 16H11C11.55 16 12 15.55 12 15V4L8 0H1Z" />
              </svg>
            </div>

            {/* Skeleton lines */}
            <div className="flex-1 space-y-1">
              <div className="h-1.5 w-16 bg-slate-200 rounded-full" />
              <div className="h-1.5 w-24 bg-slate-100 rounded-full" />
            </div>
          </div>
        </div>

        {/* Front panel covering lower ~65% (114px) */}
        <div className="absolute bottom-0 inset-x-0 h-[114px] bg-[#F8D775] rounded-[18px] border border-[#dde4ef] shadow-xs p-4 flex items-start gap-3 z-20">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef3c7] text-[#92400e]">
            {office.code}
          </span>
        </div>
      </Link>

      {/* Details below tile */}
      <div className="mt-3.5 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <Link
            href={targetHref}
            className="font-bold text-[14px] text-[#0f172a] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] rounded block truncate leading-tight transition-colors"
            title={office.name}
          >
            {office.name}
          </Link>

          <div
            className="text-[13px] text-[#5b6b82] truncate leading-normal mt-0.5"
            title={`${office.count} folders · ${office.head || "Unassigned"}`}
          >
            {office.count} {office.count === 1 ? "folder" : "folders"} · {office.head || "Unassigned"}
          </div>
        </div>

        {/* More actions button (•••) */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="More actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] transition-colors"
          >
            <MoreHorizontal size={18} />
          </button>

          {/* Action dropdown menu */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl border border-slate-200 shadow-md py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                role="menuitem"
                onClick={(e) => handleAction(e, "open")}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-slate-100 font-medium"
              >
                <FolderOpen size={14} className="text-[#1d4ed8]" />
                <span>Open folders</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleCopyCode}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-slate-100 font-medium"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-slate-400" />
                    <span>Copy office name</span>
                  </>
                )}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={(e) => handleAction(e, "details")}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-slate-100 font-medium"
              >
                <ExternalLink size={14} className="text-slate-400" />
                <span>View office info</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FolderTile;
