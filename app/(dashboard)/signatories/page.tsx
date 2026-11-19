"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Calendar,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Building2,
  Check,
} from "lucide-react";
import FormModal from "@/components/ui/form-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import LoaderWave from "@/components/ui/loader-wave";
import { toast } from "sonner";

interface Office {
  id: string;
  name: string;
  code?: string;
}

interface SignatoryLeave {
  id: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string | null;
  approvedBy?: string | null;
  status: string;
}

interface Signatory {
  id: string;
  name: string;
  position: string;
  role: string;
  isActive: boolean;
  officeId?: string | null;
  office?: Office | null;
  bacLeaves?: SignatoryLeave[];
}

interface LeaveRecord {
  id: string;
  signatoryId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string | null;
  approvedBy?: string | null;
  status: string;
  signatory: {
    id: string;
    name: string;
    position: string;
    role: string;
  };
}

const SIGNATORY_ROLES = [
  { value: "BAC_CHAIRMAN", label: "BAC Chairman" },
  { value: "BAC_VICE_CHAIRMAN", label: "BAC Vice-Chairman" },
  { value: "BAC_MEMBER", label: "BAC Member" },
  { value: "HOPE", label: "HOPE / LCE (Municipal Mayor)" },
  { value: "SUPPLY_OFFICER", label: "Supply / Property Officer" },
  { value: "INSPECTION_OFFICER", label: "Inspection Officer / Committee" },
  { value: "END_USER", label: "End User / Requisitioning Officer" },
  { value: "BUDGET_OFFICER", label: "Budget Officer" },
  { value: "APPROVING_OFFICIAL", label: "Approving Official" },
];

function getInitials(name: string): string {
  if (!name) return "—";
  const clean = name
    .replace(/^(Hon\.|Engr\.|Dr\.|CPA|Atty\.|Mr\.|Ms\.|Mrs\.)\s+/i, "")
    .replace(/,\s*(Jr\.|Sr\.|II|III|IV|V)$/i, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    BAC_CHAIRMAN: "BAC Chairman",
    BAC_VICE_CHAIRMAN: "BAC Vice-Chairman",
    BAC_MEMBER: "BAC Member",
    HOPE: "HOPE / LCE",
    SUPPLY_OFFICER: "Supply Officer",
    INSPECTION_OFFICER: "Inspection Committee",
    END_USER: "End User",
    BUDGET_OFFICER: "Budget Officer",
    APPROVING_OFFICIAL: "Approving Official",
  };
  return map[role] || role;
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "BAC_CHAIRMAN":
      return "bg-blue-50 text-blue-700 border border-blue-200/60";
    case "BAC_VICE_CHAIRMAN":
    case "BAC_MEMBER":
      return "bg-slate-100 text-slate-700 border border-slate-200/60";
    case "HOPE":
    case "APPROVING_OFFICIAL":
      return "bg-purple-50 text-purple-700 border border-purple-200/60";
    case "SUPPLY_OFFICER":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200/60";
  }
}

function isAbstractSignatory(sig: Signatory): boolean {
  const r = (sig.role || "").toUpperCase();
  const p = (sig.position || "").toLowerCase();
  return (
    r.includes("BAC") ||
    r.includes("HOPE") ||
    r.includes("MAYOR") ||
    r.includes("APPROVING") ||
    p.includes("bac") ||
    p.includes("mayor") ||
    p.includes("chair") ||
    p.includes("member")
  );
}

function isAcceptanceSignatory(sig: Signatory): boolean {
  const r = (sig.role || "").toUpperCase();
  const p = (sig.position || "").toLowerCase();
  return (
    r.includes("SUPPLY") ||
    r.includes("PROPERTY") ||
    r.includes("END_USER") ||
    r.includes("INSPECTION") ||
    r.includes("REQUISITION") ||
    r.includes("HOPE") ||
    p.includes("supply") ||
    p.includes("property") ||
    p.includes("inspection") ||
    p.includes("health") ||
    p.includes("engineer") ||
    p.includes("treasurer")
  );
}

function formatDateShort(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateRange(startInput: string | Date, endInput: string | Date): string {
  const s = new Date(startInput);
  const e = new Date(endInput);
  if (s.toDateString() === e.toDateString()) {
    return formatDateShort(s);
  }
  return `${formatDateShort(s)} – ${formatDateShort(e)}`;
}

export default function SignatoriesPage() {
  const [viewMode, setViewMode] = useState<"signatories" | "attendance">("signatories");
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for signatories table
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ABSTRACT" | "ACCEPTANCE">("ALL");

  // Signatory Add/Edit Modal
  const [showSignatoryModal, setShowSignatoryModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Signatory | null>(null);
  const [signatoryToDelete, setSignatoryToDelete] = useState<Signatory | null>(null);

  // Attendance Calendar state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date>(new Date());

  // Attendance Records table filter
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<"ALL" | "ON_LEAVE" | "OB" | "ABSENT">("ALL");

  // Add / Edit Leave form state
  const [formSignatoryId, setFormSignatoryId] = useState("");
  const [formStatus, setFormStatus] = useState<"ON_LEAVE" | "OB" | "ABSENT">("ON_LEAVE");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [formSignsInBehalf, setFormSignsInBehalf] = useState("");
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRecord | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sigRes, leaveRes, officeRes] = await Promise.all([
        fetch("/api/signatories"),
        fetch("/api/bac/leave"),
        fetch("/api/offices"),
      ]);

      if (sigRes.ok) {
        const sigData = await sigRes.json();
        setSignatories(sigData);
      }
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaves(leaveData);
      }
      if (officeRes.ok) {
        const officeData = await officeRes.json();
        setOffices(officeData);
      }
    } catch {
      toast.error("Failed to load signatories data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: signatories.length,
      abstract: signatories.filter(isAbstractSignatory).length,
      acceptance: signatories.filter(isAcceptanceSignatory).length,
    };
  }, [signatories]);

  // Filtered signatories
  const filteredSignatories = useMemo(() => {
    return signatories.filter((sig) => {
      // Tab filter
      if (activeTab === "ABSTRACT" && !isAbstractSignatory(sig)) return false;
      if (activeTab === "ACCEPTANCE" && !isAcceptanceSignatory(sig)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = sig.name.toLowerCase().includes(q);
        const posMatch = (sig.position || "").toLowerCase().includes(q);
        const roleMatch = getRoleLabel(sig.role).toLowerCase().includes(q);
        const officeMatch = (sig.office?.name || "").toLowerCase().includes(q);
        if (!nameMatch && !posMatch && !roleMatch && !officeMatch) return false;
      }
      return true;
    });
  }, [signatories, activeTab, searchQuery]);

  // Handle open Leave form for a specific signatory
  const handleOpenSetLeave = (sig: Signatory) => {
    setFormSignatoryId(sig.id);
    setFormStatus("ON_LEAVE");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate(new Date().toISOString().split("T")[0]);
    setFormSignsInBehalf("");
    setEditingLeaveId(null);
    setViewMode("attendance");
  };

  // Signatory modal fields
  const signatoryFields = [
    { key: "name", label: "Full Name", required: true, placeholder: "e.g., Hon. Ricardo Dela Cruz" },
    { key: "position", label: "Position / Designation", required: true, placeholder: "e.g., Municipal Mayor" },
    {
      key: "role",
      label: "Signatory Role",
      type: "select" as const,
      required: true,
      options: SIGNATORY_ROLES,
    },
    {
      key: "officeId",
      label: "Office / Department",
      type: "select" as const,
      options: offices.map((o) => ({ value: o.id, label: o.name })),
    },
  ];

  // Submit Signatory Add / Edit
  const handleSignatorySubmit = async (data: Record<string, string>) => {
    try {
      if (editTarget) {
        const res = await fetch(`/api/signatories/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update signatory");
        toast.success("Signatory updated successfully");
      } else {
        const res = await fetch("/api/signatories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to add signatory");
        toast.success("Signatory created successfully");
      }
      setShowSignatoryModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save signatory");
    }
  };

  // Delete Signatory
  const handleDeleteSignatory = async () => {
    if (!signatoryToDelete) return;
    try {
      const res = await fetch(`/api/signatories/${signatoryToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete signatory");
      toast.success("Signatory removed");
      setSignatoryToDelete(null);
      fetchData();
    } catch {
      toast.error("Failed to remove signatory");
    }
  };

  // ─── Attendance Calendar Helpers ───
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split("T")[0];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const dStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    // Trailing days for complete rows (up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Leaves active on a specific day
  const getLeavesForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return leaves.filter((l) => {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return s <= dayEnd && e >= dayStart;
    });
  };

  // Month navigation
  const prevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  // Filtered leave records in bottom table
  const filteredLeaveRecords = useMemo(() => {
    return leaves.filter((rec) => {
      // Filter by month
      const recStart = new Date(rec.startDate);
      const recEnd = new Date(rec.endDate);
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      if (recEnd < monthStart || recStart > monthEnd) return false;

      // Status filter
      if (leaveStatusFilter === "ON_LEAVE") {
        if (rec.leaveType === "OFFICIAL_BUSINESS" || rec.leaveType === "OB" || rec.leaveType === "ABSENT") return false;
      } else if (leaveStatusFilter === "OB") {
        if (rec.leaveType !== "OFFICIAL_BUSINESS" && rec.leaveType !== "OB") return false;
      } else if (leaveStatusFilter === "ABSENT") {
        if (rec.leaveType !== "ABSENT") return false;
      }

      return true;
    });
  }, [leaves, year, month, leaveStatusFilter]);

  // Click on a calendar day
  const handleCalendarDayClick = (dayDate: Date) => {
    setSelectedCalendarDay(dayDate);
    const dateStr = dayDate.toISOString().split("T")[0];
    setFormStartDate(dateStr);
    setFormEndDate(dateStr);
  };

  // Save / Update Leave Record
  const handleSaveLeaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSignatoryId) {
      toast.error("Please select a signatory");
      return;
    }
    if (!formStartDate || !formEndDate) {
      toast.error("Please select start and end dates");
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error("End date cannot be earlier than start date");
      return;
    }

    try {
      const payload = {
        signatoryId: formSignatoryId,
        startDate: formStartDate,
        endDate: formEndDate,
        leaveType: formStatus === "OB" ? "OFFICIAL_BUSINESS" : formStatus === "ABSENT" ? "ABSENT" : "VACATION",
        reason: formStatus === "OB" ? "Official Business" : formStatus === "ABSENT" ? "Absent" : "On Leave",
        approvedBy: formSignsInBehalf.trim() || null,
      };

      if (editingLeaveId) {
        const res = await fetch(`/api/bac/leave/${editingLeaveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update record");
        toast.success("Leave / OB record updated");
      } else {
        const res = await fetch("/api/bac/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save record");
        toast.success("Leave / OB record saved");
      }

      // Reset form
      setEditingLeaveId(null);
      setFormSignsInBehalf("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save record");
    }
  };

  // Edit an existing leave record
  const handleEditLeaveRecord = (rec: LeaveRecord) => {
    setEditingLeaveId(rec.id);
    setFormSignatoryId(rec.signatoryId);
    if (rec.leaveType === "OFFICIAL_BUSINESS" || rec.leaveType === "OB") {
      setFormStatus("OB");
    } else if (rec.leaveType === "ABSENT") {
      setFormStatus("ABSENT");
    } else {
      setFormStatus("ON_LEAVE");
    }
    setFormStartDate(new Date(rec.startDate).toISOString().split("T")[0]);
    setFormEndDate(new Date(rec.endDate).toISOString().split("T")[0]);
    setFormSignsInBehalf(rec.approvedBy || "");
  };

  // Delete leave record
  const handleDeleteLeaveRecord = async () => {
    if (!leaveToDelete) return;
    try {
      const res = await fetch(`/api/bac/leave/${leaveToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete record");
      toast.success("Leave record removed");
      setLeaveToDelete(null);
      fetchData();
    } catch {
      toast.error("Failed to delete record");
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── Top Control Bar (Search, Filter Tabs, Attendance & Add New Buttons) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search & Filter Tabs */}
        {viewMode === "signatories" ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or position"
                className="w-64 sm:w-72 h-10 pl-9 pr-3.5 bg-white border border-slate-200/90 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
              />
            </div>

            {/* Filter Pills (All, Abstract, Acceptance) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`h-9 px-4 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 shadow-2xs"
                }`}
              >
                <span>All</span>
                <span className={`text-[11px] font-bold ${activeTab === "ALL" ? "text-slate-300" : "text-slate-400"}`}>
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ABSTRACT")}
                className={`h-9 px-4 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "ABSTRACT"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 shadow-2xs"
                }`}
              >
                <span>Abstract</span>
                <span
                  className={`text-[11px] font-bold ${
                    activeTab === "ABSTRACT" ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {counts.abstract}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ACCEPTANCE")}
                className={`h-9 px-4 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "ACCEPTANCE"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 shadow-2xs"
                }`}
              >
                <span>Acceptance</span>
                <span
                  className={`text-[11px] font-bold ${
                    activeTab === "ACCEPTANCE" ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {counts.acceptance}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("signatories")}
              className="h-10 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Users size={14} className="text-slate-500" />
              <span>Back to Signatories</span>
            </button>
          </div>
        )}

        {/* Right Side: Action Buttons (Only in Signatories List View) */}
        {viewMode === "signatories" && (
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={() => setViewMode("attendance")}
              className="h-10 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-slate-500" />
              <span>Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditTarget(null);
                setShowSignatoryModal(true);
              }}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Add New</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── VIEW 1: SIGNATORIES TABLE (Matching Reference Image 1) ─── */}
      {viewMode === "signatories" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {loading ? (
            <div className="py-24 flex justify-center items-center">
              <LoaderWave />
            </div>
          ) : filteredSignatories.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center">
              <Users size={40} className="text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700">No Signatories Found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filter tab</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ minWidth: "860px" }}>
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-slate-400 text-[11px] font-bold uppercase tracking-wider select-none">
                    <th className="px-6 py-4">SIGNATORY</th>
                    <th className="px-6 py-4">ROLE</th>
                    <th className="px-6 py-4">OFFICE</th>
                    <th className="px-6 py-4">TODAY</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSignatories.map((sig) => {
                    // Check active leave for today
                    const activeLeave = sig.bacLeaves && sig.bacLeaves.length > 0 ? sig.bacLeaves[0] : null;
                    const isOB =
                      activeLeave?.leaveType === "OFFICIAL_BUSINESS" || activeLeave?.leaveType === "OB";
                    const isAbsent = activeLeave?.leaveType === "ABSENT";
                    const isOnLeave = activeLeave && !isOB && !isAbsent;

                    return (
                      <tr
                        key={sig.id}
                        className="hover:bg-slate-50/60 transition-colors duration-150 group"
                      >
                        {/* Signatory Column: Avatar + Name + Position */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-bold text-xs flex items-center justify-center shrink-0 tracking-tight">
                              {getInitials(sig.name)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm">{sig.name}</span>
                              <span className="text-xs text-slate-500 font-medium">{sig.position}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${getRoleBadgeClass(
                              sig.role
                            )}`}
                          >
                            {getRoleLabel(sig.role)}
                          </span>
                        </td>

                        {/* Office */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-sm font-medium">
                          {sig.office?.name || "—"}
                        </td>

                        {/* Today Attendance Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isOnLeave ? (
                            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70">
                              On Leave · until {formatDateShort(activeLeave.endDate)}
                            </span>
                          ) : isOB ? (
                            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
                              OB · today
                            </span>
                          ) : isAbsent ? (
                            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70">
                              Absent · today
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span>Present</span>
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenSetLeave(sig)}
                              className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-xs cursor-pointer"
                            >
                              Set leave / OB
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditTarget(sig);
                                setShowSignatoryModal(true);
                              }}
                              className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                              title="Edit Signatory Details"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSignatoryToDelete(sig)}
                              className="text-slate-300 hover:text-rose-600 transition p-1 cursor-pointer"
                              title="Remove Signatory"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── VIEW 2: ATTENDANCE TRACKER (Matching Reference Image 2) ─── */}
      {viewMode === "attendance" && (
        <div className="space-y-6">
          {/* Top Section: Interactive Monthly Calendar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
            {/* Calendar Header with Month Navigation and Legend */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <h3 className="text-sm font-bold text-slate-900 px-2 min-w-[140px] text-center select-none">
                  {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h3>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Legend on right */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  On Leave
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                  OB
                </span>
              </div>
            </div>

            {/* Calendar Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-100 pb-2 mb-1 text-center">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                <div key={day} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-l border-t border-slate-100">
              {calendarDays.map((cell, idx) => {
                const dayLeaves = getLeavesForDate(cell.date);
                const isSelected = selectedCalendarDay.toDateString() === cell.date.toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => handleCalendarDayClick(cell.date)}
                    className={`min-h-[96px] p-1.5 border-r border-b border-slate-100 transition-colors cursor-pointer flex flex-col justify-between ${
                      cell.isCurrentMonth ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/40 text-slate-400"
                    } ${isSelected ? "ring-2 ring-blue-500/30 bg-blue-50/20" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      {cell.isToday ? (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {cell.date.getDate()}
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-semibold pl-1 ${
                            cell.isCurrentMonth ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>
                      )}
                    </div>

                    {/* Leave / OB badges inside cell */}
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {dayLeaves.slice(0, 3).map((l) => {
                        const isOB = l.leaveType === "OFFICIAL_BUSINESS" || l.leaveType === "OB";
                        const isAbsent = l.leaveType === "ABSENT";
                        const nameParts = l.signatory.name.split(" ");
                        const shortName = nameParts.length > 1 ? nameParts[0] : l.signatory.name;

                        let rolePrefix = shortName;
                        if (l.signatory.role === "BAC_CHAIRMAN") rolePrefix = "Chair";
                        else if (l.signatory.role === "BAC_VICE_CHAIRMAN") rolePrefix = "Vice-Chair";
                        else if (l.signatory.role === "BAC_MEMBER") rolePrefix = "Member";

                        const label = isOB
                          ? `${rolePrefix} - OB`
                          : isAbsent
                          ? `${rolePrefix} - Absent`
                          : `${rolePrefix} - Leave`;

                        return (
                          <div
                            key={l.id}
                            title={`${l.signatory.name} (${label})`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate ${
                              isOB
                                ? "bg-blue-100/90 text-blue-800"
                                : isAbsent
                                ? "bg-rose-100/90 text-rose-800"
                                : "bg-amber-100/90 text-amber-900"
                            }`}
                          >
                            {label}
                          </div>
                        );
                      })}
                      {dayLeaves.length > 3 && (
                        <div className="text-[9px] text-slate-400 font-bold pl-1">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footnote below calendar */}
            <p className="text-xs text-slate-400 italic mt-3">
              Click a day to add a record for that date. Multi-day leave shows on each day.
            </p>
          </div>

          {/* Bottom Section: 2 Columns (Leave & OB records + Add leave / OB card) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Leave & OB records table (~65% width) */}
            <div className="xl:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h4 className="font-bold text-slate-900 text-sm">Leave & OB records</h4>

                <div className="flex items-center gap-2">
                  <div className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 flex items-center">
                    {calendarDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </div>

                  <select
                    value={leaveStatusFilter}
                    onChange={(e: any) => setLeaveStatusFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="OB">OB</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              {filteredLeaveRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                  No leave or OB records recorded for this month.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">SIGNATORY</th>
                        <th className="py-2.5 px-3">STATUS</th>
                        <th className="py-2.5 px-3">DATES</th>
                        <th className="py-2.5 px-3">SIGNS IN BEHALF</th>
                        <th className="py-2.5 px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredLeaveRecords.map((rec) => {
                        const isOB = rec.leaveType === "OFFICIAL_BUSINESS" || rec.leaveType === "OB";
                        const isAbsent = rec.leaveType === "ABSENT";

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs">{rec.signatory.name}</span>
                                <span className="text-[11px] text-slate-400">
                                  {getRoleLabel(rec.signatory.role) || rec.signatory.position}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  isOB
                                    ? "bg-blue-100 text-blue-700"
                                    : isAbsent
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isOB ? "OB" : isAbsent ? "Absent" : "On Leave"}
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium text-xs">
                              {formatDateRange(rec.startDate, rec.endDate)}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-xs">
                              {rec.approvedBy ? (
                                <span className="font-medium text-slate-700">{rec.approvedBy}</span>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditLeaveRecord(rec)}
                                  className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-xs cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLeaveToDelete(rec)}
                                  className="text-slate-300 hover:text-rose-600 transition p-1 cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-slate-400 italic mt-4">
                Documents dated within these ranges show the status above the signatory&apos;s name.
              </p>
            </div>

            {/* Right Column: Add leave / OB Card (~35% width) */}
            <div className="xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-slate-900 text-sm">
                  {editingLeaveId ? "Edit leave / OB" : "Add leave / OB"}
                </h4>
                {editingLeaveId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLeaveId(null);
                      setFormSignsInBehalf("");
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveLeaveRecord} className="space-y-4">
                {/* Signatory Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Signatory</label>
                  <select
                    value={formSignatoryId}
                    onChange={(e) => setFormSignatoryId(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">Select signatory</option>
                    {signatories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({getRoleLabel(s.role)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Toggle Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus("ON_LEAVE")}
                      className={`h-9 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                        formStatus === "ON_LEAVE"
                          ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      On Leave
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus("OB")}
                      className={`h-9 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                        formStatus === "OB"
                          ? "bg-blue-100 text-blue-900 border-blue-300 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      OB
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus("ABSENT")}
                      className={`h-9 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                        formStatus === "ABSENT"
                          ? "bg-rose-100 text-rose-900 border-rose-300 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>

                {/* From & To Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">From</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">To</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
                    />
                  </div>
                </div>

                {/* Signs in behalf (optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Signs in behalf (optional)
                  </label>
                  <select
                    value={formSignsInBehalf}
                    onChange={(e) => setFormSignsInBehalf(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">Select OIC / alternate</option>
                    {signatories
                      .filter((s) => s.id !== formSignatoryId)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({getRoleLabel(s.role)})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                >
                  {editingLeaveId ? "Update record" : "Save record"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── Signatory Add / Edit Form Modal ─── */}
      {showSignatoryModal && (
        <FormModal
          title={editTarget ? "Edit Signatory" : "Add New Signatory"}
          fields={signatoryFields}
          initialValues={
            editTarget
              ? {
                  name: editTarget.name,
                  position: editTarget.position,
                  role: editTarget.role,
                  officeId: editTarget.officeId || editTarget.office?.id || "",
                }
              : {}
          }
          onClose={() => setShowSignatoryModal(false)}
          onSubmit={handleSignatorySubmit}
          submitLabel={editTarget ? "Update Signatory" : "Create Signatory"}
        />
      )}

      {/* ─── Confirm Delete Signatory Modal ─── */}
      {signatoryToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Remove Signatory"
          message={`Are you sure you want to remove ${signatoryToDelete.name} from the signatories master list?`}
          confirmText="Remove Signatory"
          isDestructive={true}
          onClose={() => setSignatoryToDelete(null)}
          onConfirm={handleDeleteSignatory}
        />
      )}

      {/* ─── Confirm Delete Leave Record Modal ─── */}
      {leaveToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Leave / OB Record"
          message={`Are you sure you want to delete this ${
            leaveToDelete.leaveType === "OFFICIAL_BUSINESS" || leaveToDelete.leaveType === "OB"
              ? "OB"
              : "leave"
          } record for ${leaveToDelete.signatory?.name}?`}
          confirmText="Delete Record"
          isDestructive={true}
          onClose={() => setLeaveToDelete(null)}
          onConfirm={handleDeleteLeaveRecord}
        />
      )}
    </div>
  );
}
