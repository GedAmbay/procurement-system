"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  Printer,
  Eye,
  Trash2,
  PlusCircle,
  ArrowRightLeft,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Clock,
  Activity,
  Building2,
  AlertCircle,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import CustomSelect from "@/components/ui/custom-select";
import { ModalPortal } from "@/components/ui/modal-portal";
import LoaderWave from "@/components/ui/loader-wave";
import { getLivePreviewUrl } from "@/lib/recently-opened";

interface AuditLogItem {
  id: string;
  documentType: string;
  documentId: string;
  action: string;
  userId: string;
  notes: string | null;
  metadata: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    office?: { id?: string; name: string } | null;
  } | null;
}

interface AuditStats {
  totalFiltered: number;
  totalSystemLogs: number;
  todayCount: number;
  usersCount: number;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DOC_TYPES = [
  { value: "ALL", label: "All Document Types" },
  { value: "PR", label: "Purchase Request (PR)" },
  { value: "RFQ", label: "Request for Quotation (RFQ)" },
  { value: "ABSTRACT", label: "Abstract of Canvass" },
  { value: "PO", label: "Purchase Order (PO)" },
  { value: "ACCEPTANCE", label: "Inspection & Acceptance (AIR)" },
  { value: "AUTH", label: "Authentication & Security" },
  { value: "USER", label: "User Account Management" },
];

const ACTIONS = [
  { value: "ALL", label: "All Actions" },
  { value: "CREATE", label: "Created" },
  { value: "UPDATE", label: "Updated / Saved" },
  { value: "STATUS_CHANGE", label: "Status Change" },
  { value: "PRINT", label: "Printed" },
  { value: "FINALIZE", label: "Finalized" },
  { value: "OPENED", label: "Viewed / Opened" },
  { value: "DELETE", label: "Deleted" },
  { value: "LOGIN_SUCCESS", label: "Sign In Success" },
  { value: "LOGIN_FAILED", label: "Sign In Failed" },
  { value: "ACCOUNT_LOCKED", label: "Account Locked" },
  { value: "ACCOUNT_UNLOCKED", label: "Account Unlocked" },
  { value: "PASSWORD_CHANGED", label: "Password Changed" },
  { value: "PASSWORD_RESET", label: "Admin Password Reset" },
];

function getActionBadge(action: string) {
  const norm = (action || "").toUpperCase();
  if (norm === "CREATE") {
    return {
      label: "Created",
      icon: PlusCircle,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    };
  }
  if (norm === "UPDATE" || norm === "SAVE") {
    return {
      label: "Updated",
      icon: FileText,
      className: "bg-blue-50 text-blue-700 border-blue-200/80",
    };
  }
  if (norm === "STATUS_CHANGE") {
    return {
      label: "Status Changed",
      icon: ArrowRightLeft,
      className: "bg-purple-50 text-purple-700 border-purple-200/80",
    };
  }
  if (norm === "PRINT") {
    return {
      label: "Printed",
      icon: Printer,
      className: "bg-amber-50 text-amber-700 border-amber-200/80",
    };
  }
  if (norm === "FINALIZE") {
    return {
      label: "Finalized",
      icon: CheckCircle2,
      className: "bg-teal-50 text-teal-700 border-teal-200/80",
    };
  }
  if (norm === "OPENED" || norm === "VIEW") {
    return {
      label: "Viewed",
      icon: Eye,
      className: "bg-slate-50 text-slate-600 border-slate-200/80",
    };
  }
  if (norm === "DELETE") {
    return {
      label: "Deleted",
      icon: Trash2,
      className: "bg-red-50 text-red-700 border-red-200/80",
    };
  }
  return {
    label: action,
    icon: Activity,
    className: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

function getDocBadgeColor(docType: string) {
  const norm = (docType || "").toUpperCase();
  if (norm === "PR" || norm.includes("REQUEST")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (norm === "RFQ" || norm.includes("QUOTATION")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (norm === "ABSTRACT" || norm.includes("CANVASS")) {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  if (norm === "PO" || norm.includes("ORDER")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (norm === "ACCEPTANCE" || norm === "AIR" || norm.includes("INSPECTION")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default function AuditLogPage() {
  const { data: session, status } = useSession();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalFiltered: 0,
    totalSystemLogs: 0,
    todayCount: 0,
    usersCount: 0,
  });
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Filters state
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("ALL"); // ALL, TODAY, WEEK, MONTH
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Selected log for viewing payload modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load audit logs from API
  useEffect(() => {
    let active = true;
    if (status !== "authenticated") return;

    const runFetch = async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", limit.toString());

        if (debouncedSearch) params.set("search", debouncedSearch);
        if (docTypeFilter !== "ALL") params.set("documentType", docTypeFilter);
        if (actionFilter !== "ALL") params.set("action", actionFilter);
        if (userFilter !== "ALL") params.set("userId", userFilter);

        const now = new Date();
        if (dateRange === "TODAY") {
          const todayStr = now.toISOString().slice(0, 10);
          params.set("startDate", todayStr);
          params.set("endDate", todayStr);
        } else if (dateRange === "WEEK") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          params.set("startDate", weekAgo.toISOString().slice(0, 10));
        } else if (dateRange === "MONTH") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          params.set("startDate", monthAgo.toISOString().slice(0, 10));
        }

        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load audit logs");
        }

        const data = await res.json();
        if (!active) return;
        setLogs(data.logs || []);
        setStats(
          data.stats || {
            totalFiltered: 0,
            totalSystemLogs: 0,
            todayCount: 0,
            usersCount: 0,
          }
        );
        setUserOptions(data.users || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (err: unknown) {
        if (!active) return;
        toast.error((err as Error).message || "Failed to fetch audit records");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    runFetch();

    return () => {
      active = false;
    };
  }, [
    page,
    limit,
    debouncedSearch,
    docTypeFilter,
    actionFilter,
    userFilter,
    dateRange,
    status,
    refreshTrigger,
  ]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (docTypeFilter !== "ALL") params.set("documentType", docTypeFilter);
    if (actionFilter !== "ALL") params.set("action", actionFilter);
    if (userFilter !== "ALL") params.set("userId", userFilter);
    params.set("export", "csv");

    window.open(`/api/audit-logs?${params.toString()}`, "_blank");
    toast.success("Audit trail export started");
  };

  // Check role authorization
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAuthorized = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoaderWave />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-slate-500 mb-6">
          The Audit Trail is restricted to System Administrators and BAC Secretariat members for
          compliance and security purposes.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Audit Trail</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              COA / LGU Compliance
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time chronological activity ledger for all document creation, edits, prints, and status changes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-600" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <History size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Records
            </div>
            <div className="text-xl font-black text-slate-900 truncate">
              {stats.totalSystemLogs.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Activity Today
            </div>
            <div className="text-xl font-black text-slate-900 truncate">
              {stats.todayCount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <UserIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Staff
            </div>
            <div className="text-xl font-black text-slate-900 truncate">
              {stats.usersCount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Filter size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Matching Filter
            </div>
            <div className="text-xl font-black text-slate-900 truncate">
              {stats.totalFiltered.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, user, notes, or keyword..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Document Type Filter */}
          <div className="md:col-span-2">
            <CustomSelect
              size="sm"
              searchable={false}
              value={docTypeFilter}
              onChange={(val) => {
                setDocTypeFilter(val);
                setPage(1);
              }}
              options={DOC_TYPES.map((dt) => ({ value: dt.value, label: dt.label }))}
            />
          </div>

          {/* Action Filter */}
          <div className="md:col-span-2">
            <CustomSelect
              size="sm"
              value={actionFilter}
              onChange={(val) => {
                setActionFilter(val);
                setPage(1);
              }}
              options={ACTIONS.map((ac) => ({ value: ac.value, label: ac.label }))}
            />
          </div>

          {/* User Filter */}
          <div className="md:col-span-2">
            <CustomSelect
              size="sm"
              value={userFilter}
              onChange={(val) => {
                setUserFilter(val);
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "All Staff / Users" },
                ...userOptions.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.role === "END_USER" ? "Clerk" : u.role})`,
                })),
              ]}
            />
          </div>

          {/* Date Range Preset */}
          <div className="md:col-span-2">
            <CustomSelect
              size="sm"
              searchable={false}
              value={dateRange}
              onChange={(val) => {
                setDateRange(val);
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "All Dates" },
                { value: "TODAY", label: "Today Only" },
                { value: "WEEK", label: "Last 7 Days" },
                { value: "MONTH", label: "Last 30 Days" },
              ]}
            />
          </div>
        </div>

        {/* Active Filter Clear Bar */}
        {(debouncedSearch ||
          docTypeFilter !== "ALL" ||
          actionFilter !== "ALL" ||
          userFilter !== "ALL" ||
          dateRange !== "ALL") && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Showing filtered results ({stats.totalFiltered.toLocaleString()} matching)
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDocTypeFilter("ALL");
                  setActionFilter("ALL");
                  setUserFilter("ALL");
                  setDateRange("ALL");
                  setPage(1);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoaderWave />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No audit records found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No audit logs matched your current search filters or date range. Try clearing filters to view all entries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-52">Actor / User</th>
                  <th className="py-3 px-4 w-32">Action</th>
                  <th className="py-3 px-4 w-48">Document</th>
                  <th className="py-3 px-4">Activity Description & Notes</th>
                  <th className="py-3 px-4 w-28 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const actionMeta = getActionBadge(log.action);
                  const ActionIcon = actionMeta.icon;
                  const docUrl = getLivePreviewUrl(log.documentType, log.documentId);
                  const dateObj = new Date(log.createdAt);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-800">
                          {dateObj.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {dateObj.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Actor / User */}
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {log.user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">
                              {log.user?.name || "System"}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {log.user?.role === "END_USER"
                                ? "Clerk"
                                : log.user?.role?.replace(/_/g, " ") || "Staff"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${actionMeta.className}`}
                        >
                          <ActionIcon size={12} className="stroke-[2.5]" />
                          {actionMeta.label}
                        </span>
                      </td>

                      {/* Document Reference */}
                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getDocBadgeColor(
                              log.documentType
                            )}`}
                          >
                            {log.documentType}
                          </span>
                          <Link
                            href={docUrl}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors group"
                            title="Open live document preview"
                          >
                            <span className="font-mono truncate max-w-[150px]">
                              {log.documentId ? `${log.documentId.slice(0, 12)}...` : "Doc"}
                            </span>
                            <ExternalLink size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
                          </Link>
                        </div>
                      </td>

                      {/* Notes / Description */}
                      <td className="py-3 px-4 align-top text-slate-700">
                        <div className="line-clamp-2 leading-relaxed">
                          {log.notes || (
                            <span className="text-slate-400 italic">No additional notes</span>
                          )}
                        </div>
                        {log.user?.office?.name && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-medium">
                            <Building2 size={11} />
                            <span>{log.user.office.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Payload / Details */}
                      <td className="py-3 px-4 align-top text-right">
                        {log.metadata ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                          >
                            <Code size={12} />
                            <span>Payload</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <div className="w-[74px]">
                <CustomSelect
                  size="sm"
                  searchable={false}
                  value={String(limit)}
                  onChange={(val) => {
                    setLimit(Number(val));
                    setPage(1);
                  }}
                  options={[
                    { value: "15", label: "15" },
                    { value: "25", label: "25" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                />
              </div>
              <span className="text-slate-400">
                · Showing {(page - 1) * limit + 1} to{" "}
                {Math.min(page * limit, stats.totalFiltered)} of {stats.totalFiltered} entries
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Payload Modal */}
      {selectedLog && (
        <ModalPortal onBackdropClick={() => setSelectedLog(null)}>
          <div className="w-full max-w-xl bg-white rounded-[1.25rem] shadow-[0_20px_50px_rgba(15,23,42,0.15)] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Audit Event Metadata</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Document</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedLog.documentType} ({selectedLog.documentId})
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Actor</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedLog.user?.name || "System"} (
                    {selectedLog.user?.role === "END_USER" ? "Clerk" : selectedLog.user?.role})
                  </div>
                </div>
              </div>

              {selectedLog.notes && (
                <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">Event Notes</div>
                  <div className="text-slate-700 mt-0.5 font-medium">{selectedLog.notes}</div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Raw JSON Payload
                </div>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-60">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedLog.metadata || "{}"), null, 2);
                    } catch {
                      return selectedLog.metadata;
                    }
                  })()}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
