"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { X, Search, ShoppingCart, FileText, ClipboardList, Package, CheckSquare, ArrowUpRight } from "lucide-react";
import { RecentlyOpenedItem } from "./types";
import { formatRelativeTime } from "@/lib/recently-opened";
import { ModalPortal } from "@/components/ui/modal-portal";

interface RecentlyOpenedModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecentlyOpenedItem[];
}

function normalizeDocType(type: string): "PR" | "RFQ" | "Abstract" | "PO" | "Acceptance" {
  const norm = (type || "").toLowerCase();
  if (norm.includes("abstract")) return "Abstract";
  if (norm.includes("rfq")) return "RFQ";
  if (norm.includes("po") || norm.includes("order")) return "PO";
  if (norm.includes("accept") || norm.includes("air")) return "Acceptance";
  return "PR";
}

function renderDocIcon(normType: string) {
  switch (normType) {
    case "Abstract":
      return <ClipboardList size={16} className="stroke-[1.75]" />;
    case "RFQ":
      return <FileText size={16} className="stroke-[1.75]" />;
    case "PO":
      return <Package size={16} className="stroke-[1.75]" />;
    case "Acceptance":
      return <CheckSquare size={16} className="stroke-[1.75]" />;
    default:
      return <ShoppingCart size={16} className="stroke-[1.75]" />;
  }
}

export function RecentlyOpenedModal({ isOpen, onClose, items }: RecentlyOpenedModalProps) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Compute category counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length, PR: 0, RFQ: 0, Abstract: 0, PO: 0, Acceptance: 0 };
    for (const it of items) {
      const t = normalizeDocType(it.documentType);
      c[t] = (c[t] || 0) + 1;
    }
    return c;
  }, [items]);

  if (!isOpen) return null;

  const filteredItems = items.filter((item) => {
    const norm = normalizeDocType(item.documentType);
    const matchesSearch =
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.officeName.toLowerCase().includes(search.toLowerCase()) ||
      norm.toLowerCase().includes(search.toLowerCase());

    const matchesType = selectedType === "ALL" || norm.toUpperCase() === selectedType.toUpperCase();

    return matchesSearch && matchesType;
  });

  return (
    <ModalPortal onBackdropClick={onClose}>
      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recent-modal-title"
        className="relative w-full max-w-2xl max-h-[82vh] bg-white rounded-[1.25rem] shadow-[0_20px_50px_rgba(15,23,42,0.15)] border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Integrated Command/Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-white">
          <Search size={18} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder="Search recent documents by title, office, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-800 placeholder:text-slate-400"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Gray Filter Pills Bar matching sidebar tone */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: "ALL", label: "All" },
            { key: "PR", label: "PR" },
            { key: "RFQ", label: "RFQ" },
            { key: "Abstract", label: "Abstract" },
            { key: "PO", label: "PO" },
            { key: "Acceptance", label: "Acceptance" },
          ].map((tab) => {
            const count = counts[tab.key] || 0;
            const isSelected = selectedType === tab.key;
            if (tab.key !== "ALL" && count === 0) return null;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedType(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Document List - Monochromatic Slate/Gray matching sidebar */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-slate-100/80">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <FileText size={28} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-600 text-xs">No matching documents found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Try searching for a different title or office</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const normType = normalizeDocType(item.documentType);
              const relativeTime = formatRelativeTime(item.openedAt);

              return (
                <Link
                  key={item.id}
                  href={item.url}
                  onClick={onClose}
                  className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50/90 transition-all cursor-pointer"
                >
                  {/* Left: Gray Icon matching sidebar + Title & Office */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-500 border border-slate-200/70 group-hover:bg-slate-200/70 group-hover:text-slate-700 transition-colors">
                      {renderDocIcon(normType)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate leading-tight">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                        <span className="text-slate-500">{item.officeName}</span>
                        <span>•</span>
                        <span>{relativeTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Neutral slate badge + subtle hover arrow */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide bg-slate-100 text-slate-600 border border-slate-200/60">
                      {normType}
                    </span>

                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 group-hover:text-slate-700 group-hover:bg-slate-100 transition-all">
                      <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Minimal Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
          <span>{filteredItems.length} recent documents</span>
          <span className="hidden sm:inline text-[11px] text-slate-400">Click any document to open live preview</span>
        </div>
      </div>
    </ModalPortal>
  );
}

export default RecentlyOpenedModal;
