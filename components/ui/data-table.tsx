"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Loader2,
  RotateCw,
  Eye,
  Copy,
  X,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Check,
} from "lucide-react";
import LoaderWave from "@/components/ui/loader-wave";
import ConfirmModal from "@/components/ui/confirm-modal";
import { toast } from "sonner";

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => any;
  width?: string;
  align?: "left" | "center" | "right" | (string & {});
  sortable?: boolean;
}

export interface DataTableProps<T extends { id: string; isActive?: boolean }> {
  title: string;
  description?: string;
  apiPath: string;
  columns: Column<T>[];
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onDuplicate?: (row: T) => void;
  onDelete?: (row: T) => Promise<void>;
  deleteModalTitle?: string;
  deleteModalMessage?: string;
  deleteConfirmText?: string;
  deleteSuccessToast?: string;
  customActions?: {
    label: React.ReactNode | ((row: T) => React.ReactNode);
    icon?: React.ReactNode | ((row: T) => React.ReactNode);
    color?: string | ((row: T) => string);
    onClick: (row: T) => void;
  }[];
  extraHeaderContent?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  queryParams?: Record<string, string>;
  filterKey?: keyof T;
  filterTabs?: { label: string; value: string | null }[];
  dateFilterKey?: keyof T;
  departmentFilterKey?: keyof T | ((row: T) => string | undefined | null);
  customFilters?: { label: string; filterFn: (row: T) => boolean; colorClass?: string }[];
}

export default function DataTable<T extends { id: string; isActive?: boolean }>({
  title,
  description,
  apiPath,
  columns,
  searchPlaceholder = "Search...",
  onAdd,
  addLabel,
  onView,
  onEdit,
  onRowDoubleClick,
  onDuplicate,
  onDelete,
  deleteModalTitle,
  deleteModalMessage,
  deleteConfirmText,
  deleteSuccessToast,
  customActions,
  extraHeaderContent,
  emptyIcon,
  emptyText,
  queryParams = {},
  filterKey,
  filterTabs,
  dateFilterKey,
  departmentFilterKey,
  customFilters,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Filter & Sort states
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCustomFilter, setActiveCustomFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<T | null>(null);

  const datePickerRef = useRef<HTMLDivElement>(null);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        setShowDatePicker(false);
      }
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(target)) {
        setShowDeptDropdown(false);
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(target)) {
        setShowMoreActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute unique departments for filter
  const departments = useMemo(() => {
    if (!departmentFilterKey) return [];
    const set = new Set<string>();
    data.forEach((row) => {
      let deptName: string | undefined | null = "";
      if (typeof departmentFilterKey === "function") {
        deptName = departmentFilterKey(row);
      } else {
        const val = (row as any)[departmentFilterKey];
        if (val && typeof val === "object") {
          deptName = val.name || val.code;
        } else if (typeof val === "string") {
          deptName = val;
        }
      }
      if (deptName && typeof deptName === "string" && deptName.trim()) {
        set.add(deptName.trim());
      }
    });
    return Array.from(set).sort();
  }, [data, departmentFilterKey]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...queryParams, ...(search ? { search } : {}) });
      const res = await fetch(`${apiPath}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [apiPath, search, JSON.stringify(queryParams)]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Reset page when search or tab filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, activeCustomFilter, dateRange, selectedDept, itemsPerPage]);

  // Client filtering
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // Search Filter
      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        const matches = columns.some((col) => {
          if (col.accessor) {
            try {
              const val = col.accessor(row);
              if (val !== null && val !== undefined && (typeof val === "string" || typeof val === "number")) {
                return String(val).toLowerCase().includes(query);
              }
            } catch { }
          }
          const val = (row as any)[col.key];
          if (val !== null && val !== undefined && (typeof val === "string" || typeof val === "number")) {
            return String(val).toLowerCase().includes(query);
          }
          return false;
        }) || (function checkObj(obj: any, depth = 0): boolean {
          if (!obj || depth > 2) return false;
          return Object.values(obj).some((val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === "string" || typeof val === "number") {
              return String(val).toLowerCase().includes(query);
            }
            if (typeof val === "object" && !Array.isArray(val)) {
              return checkObj(val, depth + 1);
            }
            if (Array.isArray(val)) {
              return val.some((item) => {
                if (typeof item === "string" || typeof item === "number") {
                  return String(item).toLowerCase().includes(query);
                }
                if (typeof item === "object") {
                  return checkObj(item, depth + 1);
                }
                return false;
              });
            }
            return false;
          });
        })(row);

        if (!matches) return false;
      }

      // Tab Filter
      if (filterKey && activeFilter !== null && row[filterKey] !== activeFilter) {
        return false;
      }

      // Date Filter
      if (dateFilterKey) {
        if (dateRange.start) {
          const rowDate = new Date(row[dateFilterKey] as any).getTime();
          const startDate = new Date(dateRange.start).setHours(0, 0, 0, 0);
          if (rowDate < startDate) return false;
        }
        if (dateRange.end) {
          const rowDate = new Date(row[dateFilterKey] as any).getTime();
          const endDate = new Date(dateRange.end).setHours(23, 59, 59, 999);
          if (rowDate > endDate) return false;
        }
      }

      // Department Filter
      if (selectedDept && departmentFilterKey) {
        let rowDept = "";
        if (typeof departmentFilterKey === "function") {
          rowDept = departmentFilterKey(row) || "";
        } else {
          const val = (row as any)[departmentFilterKey];
          if (val && typeof val === "object") {
            rowDept = val.name || val.code || "";
          } else if (typeof val === "string") {
            rowDept = val;
          }
        }
        if (rowDept !== selectedDept) return false;
      }

      // Custom Filter
      if (activeCustomFilter && customFilters) {
        const filter = customFilters.find((f) => f.label === activeCustomFilter);
        if (filter && !filter.filterFn(row)) return false;
      }

      return true;
    });
  }, [data, filterKey, activeFilter, dateFilterKey, dateRange, selectedDept, departmentFilterKey, activeCustomFilter, customFilters, search, columns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  // Selection handlers
  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = new Set(paginatedData.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...paginatedData.map((r) => r.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Find first selected row for action bar single-row actions
  const firstSelectedRow = useMemo(() => {
    if (selectedIds.length === 0) return null;
    return data.find((r) => r.id === selectedIds[0]) || null;
  }, [data, selectedIds]);

  // Delete handler
  const confirmDelete = async () => {
    if (!onDelete || !rowToDelete) return;
    setDeleting(rowToDelete.id);
    const row = rowToDelete;
    setRowToDelete(null);
    try {
      await onDelete(row);
      toast.success(deleteSuccessToast || "Record deleted successfully");
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!onDelete || selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?`)) return;
    try {
      for (const id of selectedIds) {
        const item = data.find((d) => d.id === id);
        if (item) await onDelete(item);
      }
      toast.success(`Deleted ${selectedIds.length} record(s)`);
      setSelectedIds([]);
      setShowMoreActions(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete selected records");
    }
  };

  const hasRowActions = !!(
    onView ||
    onEdit ||
    onDuplicate ||
    onDelete ||
    (customActions && customActions.length > 0)
  );

  return (
    <div className="w-full max-w-full min-w-0 pb-20">
      {/* ─── Filter & Action Controls Bar ─── */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px] max-w-[440px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
          />
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={fetchData}
          title="Refresh list"
          className="h-11 w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-colors shrink-0"
        >
          <RotateCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Date Filter Dropdown */}
        {dateFilterKey && (
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((prev) => !prev)}
              className={`h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap ${dateRange.start || dateRange.end
                ? "text-blue-600 border-blue-200 bg-blue-50/50"
                : "text-slate-700"
                }`}
            >
              <Calendar
                size={15}
                className={dateRange.start || dateRange.end ? "text-blue-600" : "text-slate-500"}
              />
              <span>
                {dateRange.start
                  ? `${new Date(dateRange.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${dateRange.end
                    ? new Date(dateRange.end).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "..."
                  }`
                  : "Filter by date"}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 z-30 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Date Range
                  </span>
                  {(dateRange.start || dateRange.end) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateRange({ start: "", end: "" });
                        setShowDatePicker(false);
                      }}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, start: e.target.value }))
                      }
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, end: e.target.value }))
                      }
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="w-full mt-2 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Department Filter Dropdown */}
        {departmentFilterKey && (
          <div className="relative" ref={deptDropdownRef}>
            <button
              type="button"
              onClick={() => setShowDeptDropdown((prev) => !prev)}
              className={`h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap ${selectedDept
                ? "text-blue-600 border-blue-200 bg-blue-50/50"
                : "text-slate-700"
                }`}
            >
              <Building2
                size={15}
                className={selectedDept ? "text-blue-600" : "text-slate-500"}
              />
              <span className="max-w-[180px] truncate">
                {selectedDept || "All departments"}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {showDeptDropdown && (
              <div className="absolute top-full left-0 mt-2 z-30 w-64 max-h-64 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept("");
                    setShowDeptDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${!selectedDept
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <span>All departments</span>
                  {!selectedDept && <Check size={14} className="text-blue-600" />}
                </button>
                <div className="h-px bg-slate-100 my-1" />
                {departments.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">
                    No departments found
                  </div>
                ) : (
                  departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        setSelectedDept(dept);
                        setShowDeptDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${selectedDept === dept
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      <span className="truncate mr-2">{dept}</span>
                      {selectedDept === dept && (
                        <Check size={14} className="text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Extra Header Content (Custom dropdowns etc.) */}
        {extraHeaderContent}

        <div className="flex-1" />

        {/* Primary Add Button */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <Plus size={18} />
            <span>{addLabel || "Add New"}</span>
          </button>
        )}
      </div>

      {/* ─── Status Tabs Row ─── */}
      {filterTabs && filterKey && filterTabs.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-200/80 mb-3 px-1">
          <div className="flex items-center gap-6 overflow-x-auto">
            {filterTabs.map((tab) => {
              const count =
                tab.value === null
                  ? data.length
                  : data.filter((row) => row[filterKey] === tab.value).length;
              const isActive = activeFilter === tab.value;

              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveFilter(tab.value)}
                  className={`pb-3 text-sm font-semibold transition-all relative whitespace-nowrap flex items-center gap-1.5 ${isActive ? "text-blue-600 font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-blue-100 text-blue-700" : "text-slate-500"
                      }`}
                  >
                    ({count})
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              );
            })}

            {/* Custom Filters (e.g. Direct Acquisition) */}
            {customFilters &&
              customFilters.map((filter) => {
                const isActive = activeCustomFilter === filter.label;
                return (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => setActiveCustomFilter(isActive ? null : filter.label)}
                    className={`ml-2 mb-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isActive
                      ? filter.colorClass || "bg-blue-600 text-white"
                      : "text-slate-600 bg-slate-100 hover:bg-slate-200"
                      }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* ─── Main Table Card ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoaderWave />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            {search?.trim() ? (
              <Search size={40} className="text-slate-300 mb-3" />
            ) : (
              emptyIcon ?? <Search size={40} className="text-slate-300 mb-3" />
            )}
            <p className="font-semibold text-slate-700">
              {search?.trim() ? "No Records Found" : (emptyText ?? "No records found")}
            </p>
            {search?.trim() && (
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search query</p>
            )}
            {onAdd && !search?.trim() && (
              <button
                type="button"
                onClick={onAdd}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus size={14} className="inline mr-1" />
                {addLabel || "Add First Record"}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: "860px" }}>
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 text-[12px] font-bold uppercase tracking-wider select-none">
                  {/* Checkbox column */}
                  {hasRowActions && (
                    <th className="w-12 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all rows"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}

                  {/* Columns */}
                  {columns.map((col) => {
                    const isSorted = sortConfig?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        style={{ width: col.width, textAlign: (col.align || "left") as any }}
                        className={`px-4 py-3.5 ${col.sortable ? "cursor-pointer hover:text-slate-900" : ""
                          }`}
                        onClick={() => {
                          if (!col.sortable) return;
                          let nextDirection: "asc" | "desc" = "asc";
                          if (isSorted && sortConfig?.direction === "asc") {
                            nextDirection = "desc";
                          }
                          setSortConfig({ key: col.key, direction: nextDirection });
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1"
                          style={{
                            justifyContent:
                              col.align === "right"
                                ? "flex-end"
                                : col.align === "center"
                                  ? "center"
                                  : "flex-start",
                            width: "100%",
                          }}
                        >
                          <span>{col.label}</span>
                          {col.sortable && (
                            <span className="text-[10px] text-slate-400">
                              {isSorted ? (sortConfig?.direction === "asc" ? "▲" : "▼") : "▾"}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedData.map((row) => {
                  const isSelected = selectedIds.includes(row.id);

                  return (
                    <tr
                      key={row.id}
                      onDoubleClick={() => {
                        if (onRowDoubleClick) onRowDoubleClick(row);
                        else if (onEdit) onEdit(row);
                        else if (onView) onView(row);
                      }}
                      className={`transition-colors duration-150 ${row.isActive === false ? "opacity-60" : ""
                        } ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"}`}
                    >
                      {/* Checkbox column */}
                      {hasRowActions && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(row.id)}
                            aria-label={`Select row ${row.id}`}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Data Columns */}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{ textAlign: (col.align || "left") as any }}
                          className="px-4 py-4"
                        >
                          {col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Table Pagination Footer ─── */}
        {!loading && sortedData.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-t border-slate-200/70 bg-white text-xs text-slate-500">
            <div className="flex items-center gap-6">
              <span>
                Showing{" "}
                <strong className="text-slate-700 font-semibold">
                  {(currentPage - 1) * itemsPerPage + 1}–
                  {Math.min(currentPage * itemsPerPage, sortedData.length)}
                </strong>{" "}
                of <strong className="text-slate-700 font-semibold">{sortedData.length}</strong>{" "}
                records
              </span>

              <div className="hidden sm:flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="h-8 min-w-[32px] px-2 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                {currentPage}
              </div>

              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Floating Bottom Action Bar (When rows are selected) ─── */}
      {selectedIds.length > 0 && hasRowActions && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/90 px-4 py-2.5 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Selected count pill */}
          <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              ✓
            </div>
            <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
              {selectedIds.length} selected
            </span>
          </div>

          {/* View Button */}
          {onView && firstSelectedRow && (
            <button
              type="button"
              onClick={() => {
                onView(firstSelectedRow);
                setSelectedIds([]);
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Eye size={14} className="text-slate-500" />
              <span>View</span>
            </button>
          )}

          {/* Edit Button */}
          {onEdit && firstSelectedRow && (
            <button
              type="button"
              onClick={() => {
                onEdit(firstSelectedRow);
                setSelectedIds([]);
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Pencil size={14} className="text-slate-500" />
              <span>Edit</span>
            </button>
          )}

          {/* More Actions Dropdown */}
          {(onDuplicate || (customActions && customActions.length > 0) || onDelete) && (
            <div className="relative" ref={moreActionsRef}>
              <button
                type="button"
                onClick={() => setShowMoreActions((prev) => !prev)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
              >
                <span>More Actions</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {showMoreActions && (
                <div className="absolute bottom-full left-0 mb-2 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  {onDuplicate && firstSelectedRow && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicate(firstSelectedRow);
                        setSelectedIds([]);
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Copy size={14} className="text-slate-400" />
                      <span>Duplicate</span>
                    </button>
                  )}
                  {customActions &&
                    firstSelectedRow &&
                    customActions.map((action, i) => {
                      const label =
                        typeof action.label === "function"
                          ? action.label(firstSelectedRow)
                          : action.label;
                      const icon =
                        typeof action.icon === "function"
                          ? action.icon(firstSelectedRow)
                          : action.icon;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            action.onClick(firstSelectedRow);
                            setSelectedIds([]);
                            setShowMoreActions(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          {icon as React.ReactNode}
                          <span>{label as React.ReactNode}</span>
                        </button>
                      );
                    })}
                  {onDelete && (
                    <>
                      <div className="h-px bg-slate-100 my-1" />
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        <span>Delete Selected ({selectedIds.length})</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Cancel Selection */}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1"
          >
            <X size={14} />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!rowToDelete}
        onClose={() => setRowToDelete(null)}
        onConfirm={confirmDelete}
        title={deleteModalTitle || "Confirm Deletion"}
        message={
          deleteModalMessage ||
          "Are you sure you want to delete this record? This action cannot be undone."
        }
        confirmText={deleteConfirmText || "Delete"}
        isDestructive={true}
        isLoading={!!deleting}
      />
    </div>
  );
}
