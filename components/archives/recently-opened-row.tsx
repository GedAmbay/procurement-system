"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RecentlyOpenedRowProps, DocumentType } from "./types";
import { formatRelativeTime } from "@/lib/recently-opened";

interface ChipStyle {
  bg: string;
  color: string;
}

const DOCUMENT_STYLES: Record<DocumentType, ChipStyle> = {
  Abstract: {
    bg: "bg-[#eff6ff]",
    color: "text-[#2563eb]",
  },
  RFQ: {
    bg: "bg-[#fef3c7]",
    color: "text-[#d97706]",
  },
  PR: {
    bg: "bg-[#ecfdf5]",
    color: "text-[#059669]",
  },
  PO: {
    bg: "bg-[#f5f3ff]",
    color: "text-[#7c3aed]",
  },
};

function DocumentGlyph({ className = "w-4 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 0C0.89543 0 0 0.89543 0 2V18C0 19.1046 0.89543 20 2 20H14C15.1046 20 16 19.1046 16 18V6L10 0H2Z" />
      <path
        d="M10 0V5C10 5.55228 10.4477 6 11 6H16L10 0Z"
        fill="white"
        fillOpacity="0.4"
      />
    </svg>
  );
}

export function RecentlyOpenedRow({
  items,
  onViewAll,
  className = "",
  isLoading = false,
}: RecentlyOpenedRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);

    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [items, isLoading]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (isLoading) {
    return (
      <section className={`mb-8 ${className}`} aria-label="Loading recently opened documents">
        <div className="flex items-center justify-between mb-3.5">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex flex-nowrap overflow-hidden gap-3.5 pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3.5 min-w-[240px] flex-1 shrink-0 animate-pulse"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="h-4 bg-slate-200 rounded w-4/5" />
                <div className="h-3 bg-slate-100 rounded w-3/5" />
                <div className="h-2.5 bg-slate-100 rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Hide the whole section if empty
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className={`mb-8 ${className}`} aria-label="Recently opened documents">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-base font-bold text-[#0f172a] tracking-tight">
          Recently opened
        </h2>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-medium text-[#1d4ed8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] rounded px-1 -mr-1 transition-colors"
          >
            View all
          </button>
        ) : (
          <Link
            href="/procurement-folders"
            className="text-sm font-medium text-[#1d4ed8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] rounded px-1 -mr-1 transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {/* Horizontal Cards Row */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        aria-label="Recently opened document cards list"
        className="flex flex-nowrap overflow-x-auto gap-3.5 pb-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 rounded-2xl scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => {
          const style = DOCUMENT_STYLES[item.documentType] || DOCUMENT_STYLES.PR;
          const displayOpenedTime = formatRelativeTime(item.openedAt);

          return (
            <Link
              key={item.id}
              href={item.url || "#"}
              className="group bg-white rounded-2xl border border-[#dde4ef] p-3.5 flex items-center gap-3.5 min-w-[240px] flex-1 shrink-0 hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 transition-all cursor-pointer"
            >
              {/* 40px rounded icon chip */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.color} transition-transform group-hover:scale-105`}
              >
                <DocumentGlyph className="w-4 h-5" />
              </div>

              {/* Document details */}
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold text-[14px] text-[#0f172a] truncate leading-tight group-hover:text-[#1d4ed8] transition-colors"
                  title={item.title}
                >
                  {item.title}
                </div>
                <div
                  className="text-[12px] text-[#5b6b82] truncate leading-normal mt-0.5"
                  title={item.officeName}
                >
                  {item.officeName}
                </div>
                <div className="text-[11px] text-[#94a3b8] leading-normal mt-0.5">
                  {displayOpenedTime}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Track indicator with arrow buttons matching screenshot */}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll recently opened left"
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="relative flex-1 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-slate-500 rounded-full transition-all duration-150"
            style={{
              width: "25%",
              left: `${Math.min(75, Math.max(0, scrollProgress * 0.75))}%`,
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="Scroll recently opened right"
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

export default RecentlyOpenedRow;

