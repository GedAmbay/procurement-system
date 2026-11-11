"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RotateCw,
  Calendar,
  Building2,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Send,
  Copy,
  Trash2,
  X,
  Check,
  CheckCircle2,
  PackageSearch,
} from "lucide-react";
import LoaderWave from "@/components/ui/loader-wave";
import FormModal from "@/components/ui/form-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface RFQ {
  id: string;
  rfqNumber: string;
  pr: {
    prNumber?: string | null;
    purpose: string;
    totalAmount: number;
    office: { name: string; code: string };
  };
  status: string;
  createdAt: string;
}

export default function RFQPage() {
  const router = useRouter();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [sortKey, setSortKey] = useState<"rfqNumber" | "abc" | "status" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [prs, setPrs] = useState<any[]>([]);
  const [rfqToDelete, setRfqToDelete] = useState<RFQ | null>(null);

  const datePickerRef = useRef<HTMLDivElement>(null);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
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

  // Fetch RFQs
  const fetchRfqs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rfqs");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRfqs(data);
    } catch {
      toast.error("Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs();
  }, []);

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      if (r.pr?.office?.name) set.add(r.pr.office.name);
    });
    return Array.from(set).sort();
  }, [rfqs]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: rfqs.length,
      draft: rfqs.filter((r) => r.status === "DRAFT").length,
      issued: rfqs.filter((r) => r.status === "ISSUED").length,
      completed: rfqs.filter((r) => r.status === "COMPLETED").length,
    };
  }, [rfqs]);

  // Filtered & sorted data
  const filteredRfqs = useMemo(() => {
    return rfqs
      .filter((rfq) => {
        // Tab filter
        if (activeTab === "DRAFT" && rfq.status !== "DRAFT") return false;
        if (activeTab === "ISSUED" && rfq.status !== "ISSUED") return false;
        if (activeTab === "COMPLETED" && rfq.status !== "COMPLETED") return false;

        // Department filter
        if (selectedDept && rfq.pr?.office?.name !== selectedDept) return false;

        // Date range filter
        if (dateRange.start) {
          const rfqDate = new Date(rfq.createdAt).getTime();
          const startDate = new Date(dateRange.start).setHours(0, 0, 0, 0);
          if (rfqDate < startDate) return false;
        }
        if (dateRange.end) {
          const rfqDate = new Date(rfq.createdAt).getTime();
          const endDate = new Date(dateRange.end).setHours(23, 59, 59, 999);
          if (rfqDate > endDate) return false;
        }

        // Search text
        if (search.trim()) {
          const query = search.toLowerCase();
          const rfqNo = (rfq.rfqNumber || "").toLowerCase();
          const office = (rfq.pr?.office?.name || "").toLowerCase();
          const purpose = (rfq.pr?.purpose || "").toLowerCase();
          const prNo = (rfq.pr?.prNumber || "").toLowerCase();
          return (
            rfqNo.includes(query) ||
            office.includes(query) ||
            purpose.includes(query) ||
            prNo.includes(query)
          );
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a.createdAt;
        let valB: any = b.createdAt;

        if (sortKey === "rfqNumber") {
          valA = a.rfqNumber || "";
          valB = b.rfqNumber || "";
        } else if (sortKey === "abc") {
          valA = a.pr?.totalAmount || 0;
          valB = b.pr?.totalAmount || 0;
        } else if (sortKey === "status") {
          valA = a.status;
          valB = b.status;
        }

        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [rfqs, activeTab, selectedDept, dateRange, search, sortKey, sortDir]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRfqs.length / rowsPerPage));
  const paginatedRfqs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRfqs.slice(start, start + rowsPerPage);
  }, [filteredRfqs, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, selectedDept, dateRange, rowsPerPage]);

  // Selection handlers
  const isAllSelected =
    paginatedRfqs.length > 0 &&
    paginatedRfqs.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = new Set(paginatedRfqs.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...paginatedRfqs.map((r) => r.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Create RFQ Modal
  const openAddModal = async () => {
    try {
      const res = await fetch("/api/purchase-requests");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPrs(data.filter((pr: any) => !pr.rfqId));
      setShowAddModal(true);
    } catch {
      toast.error("Failed to fetch Purchase Requests");
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prId: data.prId }),
      });
      if (!res.ok) throw new Error("Failed to create RFQ");
      const rfq = await res.json();
      toast.success("RFQ created successfully");
      setShowAddModal(false);
      router.push(`/rfqs/${rfq.id}`);
    } catch {
      toast.error("Error creating RFQ");
    }
  };

  // Single and Bulk Delete
  const handleDelete = async (rfq: RFQ) => {
    try {
      const res = await fetch(`/api/rfqs/${rfq.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("RFQ deleted successfully");
      setSelectedIds((prev) => prev.filter((id) => id !== rfq.id));
      fetchRfqs();
    } catch {
      toast.error("Failed to delete RFQ");
    } finally {
      setRfqToDelete(null);
    }
  };

  const handleBulkIssue = async () => {
    if (selectedIds.length === 0) return;
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await fetch(`/api/rfqs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        });
        if (res.ok) successCount++;
      }
      toast.success(`Issued ${successCount} RFQ(s)`);
      fetchRfqs();
      setSelectedIds([]);
    } catch {
      toast.error("Failed to issue selected RFQs");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected RFQ(s)?`)) return;
    try {
      let count = 0;
      for (const id of selectedIds) {
        const res = await fetch(`/api/rfqs/${id}`, { method: "DELETE" });
        if (res.ok) count++;
      }
      toast.success(`Deleted ${count} RFQ(s)`);
      fetchRfqs();
      setSelectedIds([]);
      setShowMoreActions(false);
    } catch {
      toast.error("Failed to delete selected RFQs");
    }
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const tabs = [
    { key: "ALL", label: "All", count: counts.all },
    { key: "DRAFT", label: "Draft", count: counts.draft },
    { key: "ISSUED", label: "Issued", count: counts.issued },
    { key: "COMPLETED", label: "Completed", count: counts.completed },
  ];

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
            placeholder="Search quotation no., office or purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-sm"
          />
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={fetchRfqs}
          title="Refresh list"
          className="h-11 w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-colors shrink-0"
        >
          <RotateCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Date Filter Dropdown */}
        <div className="relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setShowDatePicker((prev) => !prev)}
            className={`h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap ${dateRange.start || dateRange.end ? "text-blue-600 border-blue-200 bg-blue-50/50" : "text-slate-700"
              }`}
          >
            <Calendar size={15} className={dateRange.start || dateRange.end ? "text-blue-600" : "text-slate-500"} />
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
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Date Range</span>
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
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
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

        {/* Department Filter Dropdown */}
        <div className="relative" ref={deptDropdownRef}>
          <button
            type="button"
            onClick={() => setShowDeptDropdown((prev) => !prev)}
            className={`h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap ${selectedDept ? "text-blue-600 border-blue-200 bg-blue-50/50" : "text-slate-700"
              }`}
          >
            <Building2 size={15} className={selectedDept ? "text-blue-600" : "text-slate-500"} />
            <span className="max-w-[180px] truncate">{selectedDept || "All departments"}</span>
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
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${!selectedDept ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
              >
                <span>All departments</span>
                {!selectedDept && <Check size={14} className="text-blue-600" />}
              </button>
              <div className="h-px bg-slate-100 my-1" />
              {departments.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => {
                    setSelectedDept(dept);
                    setShowDeptDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${selectedDept === dept ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <span className="truncate mr-2">{dept}</span>
                  {selectedDept === dept && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Primary New RFQ Button */}
        <button
          type="button"
          onClick={openAddModal}
          className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors shrink-0"
        >
          <Plus size={18} />
          <span>New RFQ</span>
        </button>
      </div>

      {/* ─── Status Tabs & Budget Summary ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 mb-3 px-1">
        <div className="flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-semibold transition-all relative whitespace-nowrap flex items-center gap-1.5 ${isActive ? "text-blue-600 font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-blue-100 text-blue-700" : "text-slate-500"
                    }`}
                >
                  ({tab.count})
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Table Card ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoaderWave />
          </div>
        ) : filteredRfqs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            <PackageSearch size={40} className="text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No requests for quotation found.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search criteria.</p>
            {prs.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Create First RFQ
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 text-[12px] font-bold uppercase tracking-wider select-none">
                  {/* Checkbox column */}
                  <th className="w-12 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all rows"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>

                  {/* Quotation / PR */}
                  <th className="px-4 py-3.5">Quotation No.</th>

                  {/* Requesting Office */}
                  <th className="px-4 py-3.5">Requesting Office</th>

                  {/* Purpose */}
                  <th className="px-4 py-3.5">Purpose</th>

                  {/* Approved Budget */}
                  <th
                    className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort("abc")}
                  >
                    <div className="inline-flex items-center gap-1 justify-end">
                      <span>Approved Budget</span>
                      <span className="text-[10px] text-slate-400">
                        {sortKey === "abc" ? (sortDir === "asc" ? "▲" : "▼") : "▾"}
                      </span>
                    </div>
                  </th>

                  {/* Status */}
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort("status")}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Status</span>
                      <span className="text-[10px] text-slate-400">
                        {sortKey === "status" ? (sortDir === "asc" ? "▲" : "▼") : "▾"}
                      </span>
                    </div>
                  </th>

                  {/* Date */}
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort("createdAt")}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Date</span>
                      <span className="text-[10px] text-slate-400">
                        {sortKey === "createdAt" ? (sortDir === "asc" ? "▲" : "▼") : "▾"}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedRfqs.map((rfq) => {
                  const isSelected = selectedIds.includes(rfq.id);
                  const isDraft = rfq.status === "DRAFT";
                  const isIssued = rfq.status === "ISSUED";
                  const isCompleted = rfq.status === "COMPLETED";

                  return (
                    <tr
                      key={rfq.id}
                      onDoubleClick={() => router.push(`/rfqs/${rfq.id}`)}
                      className={`transition-colors duration-150 ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"
                        }`}
                    >
                      {/* Row Checkbox */}
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(rfq.id)}
                          aria-label={`Select RFQ ${rfq.rfqNumber || rfq.id}`}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Quotation Number */}
                      <td className="px-4 py-4">
                        <Link
                          href={`/rfqs/${rfq.id}`}
                          className="inline-flex items-center gap-1.5 font-bold font-mono text-sm text-blue-600 hover:text-blue-700 hover:underline group"
                        >
                          <span>{rfq.rfqNumber || "Draft (No Number)"}</span>
                          <ExternalLink size={13} className="text-blue-500 opacity-70 group-hover:opacity-100" />
                        </Link>
                      </td>

                      {/* Requesting Office */}
                      <td className="px-4 py-4">
                        <span className="font-medium text-slate-800">
                          {rfq.pr?.office?.name || "—"}
                        </span>
                      </td>

                      {/* Purpose */}
                      <td className="px-4 py-4">
                        <span
                          className="text-slate-600 line-clamp-1 max-w-[340px]"
                          title={rfq.pr?.purpose}
                        >
                          {rfq.pr?.purpose || "—"}
                        </span>
                      </td>

                      {/* Approved Budget */}
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-[#059669] font-mono text-sm">
                          {formatCurrency(rfq.pr?.totalAmount || 0)}
                        </span>
                      </td>

                      {/* Status Pill */}
                      <td className="px-4 py-4">
                        <StatusBadge status={rfq.status} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600 text-xs">
                        {new Date(rfq.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Table Pagination Footer ─── */}
        {!loading && filteredRfqs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-t border-slate-200/70 bg-white text-xs text-slate-500">
            <div className="flex items-center gap-6">
              <span>
                Showing{" "}
                <strong className="text-slate-700 font-semibold">
                  {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredRfqs.length)}
                </strong>{" "}
                of <strong className="text-slate-700 font-semibold">{filteredRfqs.length}</strong> records
              </span>

              <div className="hidden sm:flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
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
      {selectedIds.length > 0 && (
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
          <button
            type="button"
            onClick={() => router.push(`/rfqs/${selectedIds[0]}?mode=view`)}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Eye size={14} className="text-slate-500" />
            <span>View</span>
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => router.push(`/rfqs/${selectedIds[0]}`)}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Pencil size={14} className="text-slate-500" />
            <span>Edit</span>
          </button>

          {/* Issue RFQ Button */}
          <button
            type="button"
            onClick={handleBulkIssue}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Send size={14} className="text-blue-600" />
            <span>Issue RFQ</span>
          </button>

          {/* More Actions Dropdown */}
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
              <div className="absolute bottom-full left-0 mb-2 z-50 w-40 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/rfqs/new?duplicateFrom=${selectedIds[0]}`);
                    setShowMoreActions(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Copy size={14} className="text-slate-400" />
                  <span>Duplicate</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  <span>Delete Selected</span>
                </button>
              </div>
            )}
          </div>

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

      {/* ─── Add RFQ from PR Modal ─── */}
      {showAddModal && (
        <FormModal
          onClose={() => setShowAddModal(false)}
          title="Generate RFQ from PR"
          submitLabel="Generate RFQ"
          onSubmit={handleCreate}
          fields={[
            {
              key: "prId",
              label: "Select Purchase Request",
              type: "select",
              required: true,
              options: prs.map((pr: any) => ({
                label: `${pr.prNumber || "No PR No."} - ${pr.purpose}`,
                value: pr.id,
              })),
            },
          ]}
        />
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      <ConfirmModal
        isOpen={!!rfqToDelete}
        onClose={() => setRfqToDelete(null)}
        onConfirm={() => rfqToDelete && handleDelete(rfqToDelete)}
        title="Confirm Deletion"
        message={`Are you sure you want to delete RFQ "${rfqToDelete?.rfqNumber || 'Draft'}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
