"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  X,
  FolderOpen,
  FolderX,
  Check,
  Calendar,
  Layers,
} from "lucide-react";
import {
  ArchiveOffice,
  ArchivesPageProps,
  RecentlyOpenedItem,
  SortOption,
  StatusFilter,
} from "./types";
import { RecentlyOpenedRow } from "./recently-opened-row";
import { FolderTile } from "./folder-tile";
import { EmptyOfficesGroup } from "./empty-offices-group";
import { getRecentlyOpened } from "@/lib/recently-opened";

export function ArchivesPage({
  archives = [],
  fiscalYear: initialFiscalYear = 2026,
  availableYears = [2026, 2025, 2024, 2023, 2022],
  initialRecentlyOpened,
  isLoading = false,
}: ArchivesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL State sync
  const yearParam = searchParams?.get("year");
  const parsedYear = yearParam ? parseInt(yearParam, 10) : NaN;
  const fiscalYear = !isNaN(parsedYear) ? parsedYear : initialFiscalYear;

  // Local interactive states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [recentlyOpened, setRecentlyOpened] = useState<RecentlyOpenedItem[]>(
    initialRecentlyOpened || []
  );

  const sortRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  // Sync recently opened on mount and on custom events
  useEffect(() => {
    if (!initialRecentlyOpened || initialRecentlyOpened.length === 0) {
      setRecentlyOpened(getRecentlyOpened());
    }

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setRecentlyOpened(e.detail);
      } else {
        setRecentlyOpened(getRecentlyOpened());
      }
    };

    window.addEventListener("lgu:recently-opened-changed", handleUpdate);
    return () => {
      window.removeEventListener("lgu:recently-opened-changed", handleUpdate);
    };
  }, [initialRecentlyOpened]);

  // Handle outside click for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleYearChange = (year: number) => {
    setIsYearDropdownOpen(false);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("year", year.toString());
    router.push(`?${params.toString()}`);
  };

  // Search filtering
  const searchFilteredOffices = useMemo(() => {
    if (!searchQuery.trim()) return archives;
    const query = searchQuery.trim().toLowerCase();
    return archives.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.head && a.head.toLowerCase().includes(query)) ||
        (a.code && a.code.toLowerCase().includes(query))
    );
  }, [archives, searchQuery]);

  // Active / Foldered offices vs Empty offices
  const { activeOffices, emptyOffices } = useMemo(() => {
    const withFolders: ArchiveOffice[] = [];
    const withoutFolders: ArchiveOffice[] = [];

    for (const office of searchFilteredOffices) {
      if (office.count > 0) {
        // Status chip filtering
        if (statusFilter === "active" && office.activeCount === 0) {
          continue;
        }
        if (statusFilter === "finished" && office.finishedCount === 0) {
          continue;
        }
        withFolders.push(office);
      } else {
        // Empty offices only shown when "all" is active
        if (statusFilter === "all") {
          withoutFolders.push(office);
        }
      }
    }

    // Sorting for offices with folders
    withFolders.sort((a, b) => {
      if (sortOption === "folders") {
        return b.count - a.count;
      }
      if (sortOption === "recent") {
        return (b.activeCount || 0) - (a.activeCount || 0);
      }
      // Default: sort by name
      return a.name.localeCompare(b.name);
    });

    // Sort empty offices alphabetically
    withoutFolders.sort((a, b) => a.name.localeCompare(b.name));

    return { activeOffices: withFolders, emptyOffices: withoutFolders };
  }, [searchFilteredOffices, statusFilter, sortOption]);

  const sortLabelMap: Record<SortOption, string> = {
    name: "Name",
    recent: "Most recent",
    folders: "Most folders",
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortOption("name");
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-slate-200 rounded-lg" />
            <div className="h-4 w-64 bg-slate-100 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-64 bg-slate-200 rounded-lg" />
            <div className="h-10 w-28 bg-slate-200 rounded-lg" />
          </div>
        </div>

        {/* Recently opened skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 flex-1 min-w-[240px] bg-slate-100 rounded-2xl shrink-0" />
            ))}
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-slate-200 rounded-full" />
          <div className="h-8 w-20 bg-slate-100 rounded-full" />
          <div className="h-8 w-20 bg-slate-100 rounded-full" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-7 gap-y-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-[176px] bg-slate-100 rounded-[18px]" />
              <div className="h-4 w-3/4 bg-slate-200 rounded" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasAnyResults = activeOffices.length > 0 || emptyOffices.length > 0;

  return (
    <div className="w-full space-y-6">
      {/* ─── Top Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            Department archives
          </h1>
          <p className="text-sm text-[#5b6b82] mt-1">
            Browse procurement folders by office
          </p>
        </div>

        {/* Top Right Controls: Search + FY Select */}
        <div className="flex items-center gap-3">
          {/* Search input (office or head) */}
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search office or head"
              aria-label="Search office or head"
              className="w-full pl-9 pr-8 py-2 text-sm text-[#0f172a] bg-white rounded-lg border border-slate-200/90 shadow-2xs placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:outline-none"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* FY Select (default FY 2026) */}
          <div className="relative shrink-0" ref={yearRef}>
            <button
              type="button"
              onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              aria-label={`Selected Fiscal Year: FY ${fiscalYear}`}
              aria-haspopup="listbox"
              aria-expanded={isYearDropdownOpen}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#0f172a] bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] cursor-pointer transition-colors"
            >
              <span>FY {fiscalYear}</span>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-150 ${
                  isYearDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isYearDropdownOpen && (
              <div
                role="listbox"
                aria-label="Select Fiscal Year"
                className="absolute right-0 mt-1 w-32 bg-white rounded-xl border border-slate-200 shadow-md py-1.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-100"
              >
                {availableYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    role="option"
                    aria-selected={year === fiscalYear}
                    onClick={() => handleYearChange(year)}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 text-xs font-semibold focus-visible:outline-none focus-visible:bg-slate-100 transition-colors ${
                      year === fiscalYear ? "text-[#1d4ed8] bg-blue-50/50" : "text-[#0f172a]"
                    }`}
                  >
                    <span>FY {year}</span>
                    {year === fiscalYear && <Check size={14} className="text-[#1d4ed8]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── 1. RECENTLY OPENED ROW ────────────────────────────────────────── */}
      <RecentlyOpenedRow items={recentlyOpened} />

      {/* ─── 2. FILTER + SORT BAR ─────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        {/* Status Chips: All / Active / Finished */}
        <div className="flex items-center gap-2" role="group" aria-label="Filter folders by status">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 ${
              statusFilter === "all"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "bg-white text-[#5b6b82] border border-slate-200/90 hover:text-[#0f172a] hover:border-slate-300"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            aria-pressed={statusFilter === "active"}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 ${
              statusFilter === "active"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "bg-white text-[#5b6b82] border border-slate-200/90 hover:text-[#0f172a] hover:border-slate-300"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("finished")}
            aria-pressed={statusFilter === "finished"}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 ${
              statusFilter === "finished"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "bg-white text-[#5b6b82] border border-slate-200/90 hover:text-[#0f172a] hover:border-slate-300"
            }`}
          >
            Finished
          </button>
        </div>

        {/* Sort by dropdown */}
        <div className="relative flex items-center gap-1.5 text-xs text-[#5b6b82]" ref={sortRef}>
          <span>Sort by</span>
          <button
            type="button"
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            aria-label={`Sort by ${sortLabelMap[sortOption]}`}
            aria-haspopup="listbox"
            aria-expanded={isSortDropdownOpen}
            className="inline-flex items-center gap-1 font-bold text-[#0f172a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] rounded px-1 transition-colors cursor-pointer"
          >
            <span>{sortLabelMap[sortOption]}</span>
            <ChevronDown size={14} className="text-[#0f172a]" />
          </button>

          {isSortDropdownOpen && (
            <div
              role="listbox"
              aria-label="Sort options"
              className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl border border-slate-200 shadow-md py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
            >
              {(["name", "recent", "folders"] as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={sortOption === opt}
                  onClick={() => {
                    setSortOption(opt);
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 font-medium focus-visible:outline-none focus-visible:bg-slate-100 transition-colors ${
                    sortOption === opt ? "text-[#1d4ed8] bg-blue-50/50 font-bold" : "text-[#0f172a]"
                  }`}
                >
                  <span>{sortLabelMap[opt]}</span>
                  {sortOption === opt && <Check size={14} className="text-[#1d4ed8]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── 3. OFFICE FOLDERS GRID ────────────────────────────────────────── */}
      {activeOffices.length > 0 && (
        <main aria-label="Offices with procurement folders" className="mt-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-7 gap-y-8">
            {activeOffices.map((office) => (
              <FolderTile
                key={office.id}
                office={office}
                fiscalYear={fiscalYear}
                isEmpty={false}
              />
            ))}
          </div>
        </main>
      )}

      {/* ─── 4. EMPTY OFFICES GROUP (COLLAPSIBLE) ──────────────────────────── */}
      {emptyOffices.length > 0 && (
        <EmptyOfficesGroup offices={emptyOffices} fiscalYear={fiscalYear} />
      )}

      {/* ─── EMPTY STATE (NO RESULTS MATCH) ────────────────────────────────── */}
      {!hasAnyResults && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center shadow-xs my-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-4">
            <FolderX size={28} />
          </div>
          <h3 className="text-base font-bold text-[#0f172a]">No offices found</h3>
          <p className="text-xs text-[#5b6b82] max-w-sm mt-1 mb-5">
            {searchQuery
              ? `No office matches "${searchQuery}" with the current filter settings in FY ${fiscalYear}.`
              : `No procurement folders found for FY ${fiscalYear}.`}
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-semibold text-[#1d4ed8] bg-blue-50 hover:bg-blue-100 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

export default ArchivesPage;

