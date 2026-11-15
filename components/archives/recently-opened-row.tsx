"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingCart, FileText, ClipboardList, Package, CheckSquare } from "lucide-react";
import { RecentlyOpenedRowProps } from "./types";
import { formatRelativeTime, getLivePreviewUrl } from "@/lib/recently-opened";
import { RecentlyOpenedModal } from "./recently-opened-modal";

function getDocumentSidebarIcon(documentType: string, size = 18) {
  const norm = (documentType || "").toLowerCase();
  if (norm.includes("abstract")) {
    return <ClipboardList size={size} className="stroke-[1.75]" />;
  }
  if (norm.includes("rfq")) {
    return <FileText size={size} className="stroke-[1.75]" />;
  }
  if (norm.includes("po") || norm.includes("order")) {
    return <Package size={size} className="stroke-[1.75]" />;
  }
  if (norm.includes("accept") || norm.includes("air")) {
    return <CheckSquare size={size} className="stroke-[1.75]" />;
  }
  // Default: Purchase Request
  return <ShoppingCart size={size} className="stroke-[1.75]" />;
}

export function RecentlyOpenedRow({
  items,
  onViewAll,
  className = "",
  isLoading = false,
}: RecentlyOpenedRowProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      setModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <section className={`mb-8 ${className}`} aria-label="Loading recently opened documents">
        <div className="flex items-center justify-between mb-3.5">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3.5 animate-pulse"
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

  // Display top 4 on the row grid
  const displayedItems = items.slice(0, 4);

  return (
    <section className={`mb-8 ${className}`} aria-label="Recently opened documents">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#0f172a] tracking-tight">
            Recently opened
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/60">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleOpenViewAll}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded px-1.5 py-0.5 -mr-1 transition-colors cursor-pointer"
        >
          View all
        </button>
      </div>

      {/* Responsive Grid - Matching sidebar icons & text color */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {displayedItems.map((item) => {
          const displayOpenedTime = formatRelativeTime(item.openedAt);
          const liveUrl = item.url || getLivePreviewUrl(item.documentType, item.documentId);

          return (
            <Link
              key={item.id}
              href={liveUrl}
              className="group bg-white rounded-2xl border border-[#dde4ef] p-3.5 flex items-center gap-3.5 hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 transition-all cursor-pointer"
            >
              {/* Document Icon matching the sidebar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-500 border border-slate-200/70 group-hover:bg-slate-200/70 group-hover:text-slate-700 transition-colors"
              >
                {getDocumentSidebarIcon(item.documentType, 18)}
              </div>

              {/* Document details */}
              <div className="min-w-0 flex-1">
                <div
                  className="font-semibold text-[13.5px] text-[#0f172a] truncate leading-tight group-hover:text-blue-600 transition-colors"
                  title={item.title}
                >
                  {item.title}
                </div>
                <div
                  className="text-[12px] text-slate-500 truncate leading-normal mt-0.5"
                  title={item.officeName}
                >
                  {item.officeName}
                </div>
                <div className="text-[11px] text-slate-400 leading-normal mt-0.5">
                  {displayOpenedTime}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* View All Modal */}
      <RecentlyOpenedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        items={items}
      />
    </section>
  );
}

export default RecentlyOpenedRow;
