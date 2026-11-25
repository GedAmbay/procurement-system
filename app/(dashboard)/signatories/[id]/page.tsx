"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  AlertTriangle,
  UserCheck,
  UserX,
  Briefcase,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import LoaderWave from "@/components/ui/loader-wave";
import FormModal from "@/components/ui/form-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import StatusBadge from "@/components/ui/status-badge";

interface Office {
  id: string;
  name: string;
  code?: string;
}

interface SignatoryDetail {
  id: string;
  name: string;
  position: string;
  role: string;
  isActive: boolean;
  officeId?: string | null;
  office?: Office | null;
}

interface AttendanceRecord {
  id: string;
  signatoryId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_RECORDED";
  remarks?: string | null;
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
}

interface CalendarEventItem {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  eventTime?: string | null;
  prId?: string | null;
  pr?: { id: string; prNumber: string | null; purpose: string } | null;
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

function formatLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getUtcYMD(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function getEventBadgeStyle(eventType: string, title?: string): string {
  const t = `${eventType} ${title || ""}`.toLowerCase();
  if (t.includes("award")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (t.includes("pre-bid") || t.includes("pre bid"))
    return "bg-teal-50 text-teal-700 border-teal-200";
  if (t.includes("pre-proc") || t.includes("pre proc"))
    return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export default function SignatoryDetailPage() {
  const params = useParams<{ id: string }>();
  const signatoryId = params?.id;
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role || "VIEWER";
  const canEdit = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  const [monthDate, setMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => formatLocalYMD(new Date()));

  const [signatory, setSignatory] = useState<SignatoryDetail | null>(null);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [monthLeaves, setMonthLeaves] = useState<LeaveRecord[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRecord | null>(null);

  // Quick Leave/OB/Travel form
  const [leaveType, setLeaveType] = useState<"ON_LEAVE" | "OB" | "ON_TRAVEL" | "ABSENT">("ON_LEAVE");
  const [leaveStartDate, setLeaveStartDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [leaveEndDate, setLeaveEndDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [signsInBehalf, setSignsInBehalf] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  const fetchDetail = useCallback(async () => {
    if (!signatoryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/signatories/${signatoryId}?month=${monthKey}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load signatory");
      }
      const data = await res.json();
      setSignatory(data.signatory);
      setAttendances(data.attendances || []);
      setMonthLeaves(data.monthLeaves || []);
      setAllLeaves(data.allLeaves || []);
      setCalendarEvents(data.calendarEvents || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load signatory");
    } finally {
      setLoading(false);
    }
  }, [signatoryId, monthKey]);

  useEffect(() => {
    if (!signatoryId) return;
    let active = true;

    fetch(`/api/signatories/${signatoryId}?month=${monthKey}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load signatory");
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSignatory(data.signatory);
        setAttendances(data.attendances || []);
        setMonthLeaves(data.monthLeaves || []);
        setAllLeaves(data.allLeaves || []);
        setCalendarEvents(data.calendarEvents || []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load signatory");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [signatoryId, monthKey]);

  useEffect(() => {
    fetch("/api/offices")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setOffices(d) : setOffices([])))
      .catch(() => {});
  }, []);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const todayStr = formatLocalYMD(new Date());

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const dateStr = formatLocalYMD(d);
      days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = formatLocalYMD(d);
      days.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === todayStr });
    }

    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatLocalYMD(d);
      days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    return days;
  }, [year, month]);

  const getDayStatus = useCallback(
    (dateStr: string) => {
      // Check leave records first
      const activeLeave = monthLeaves.find((l) => {
        const s = getUtcYMD(l.startDate);
        const e = getUtcYMD(l.endDate);
        return dateStr >= s && dateStr <= e;
      });
      if (activeLeave) {
        if (activeLeave.leaveType === "OFFICIAL_BUSINESS" || activeLeave.leaveType === "OB") {
          return { kind: "OB" as const, label: "OB", record: activeLeave };
        }
        if (activeLeave.leaveType === "ON_TRAVEL") {
          return { kind: "ON_TRAVEL" as const, label: "On Travel", record: activeLeave };
        }
        if (activeLeave.leaveType === "ABSENT") {
          return { kind: "ABSENT" as const, label: "Absent", record: activeLeave };
        }
        return { kind: "ON_LEAVE" as const, label: "On Leave", record: activeLeave };
      }

      const att = attendances.find((a) => getUtcYMD(a.date) === dateStr);
      if (att) {
        if (att.status === "PRESENT") return { kind: "PRESENT" as const, label: "Present", att };
        if (att.status === "ABSENT") return { kind: "ABSENT" as const, label: "Absent", att };
        if (att.status === "EXCUSED") return { kind: "EXCUSED" as const, label: "Excused", att };
      }
      return null;
    },
    [monthLeaves, attendances]
  );

  // Monthly summary counts
  const monthlyStats = useMemo(() => {
    let present = 0;
    let onLeave = 0;
    let ob = 0;
    let onTravel = 0;
    let absent = 0;
    let excused = 0;

    calendarDays
      .filter((d) => d.isCurrentMonth)
      .forEach((d) => {
        const st = getDayStatus(d.dateStr);
        if (!st) return;
        if (st.kind === "PRESENT") present++;
        else if (st.kind === "ON_LEAVE") onLeave++;
        else if (st.kind === "OB") ob++;
        else if (st.kind === "ON_TRAVEL") onTravel++;
        else if (st.kind === "ABSENT") absent++;
        else if (st.kind === "EXCUSED") excused++;
      });

    return { present, onLeave, ob, onTravel, absent, excused };
  }, [calendarDays, getDayStatus]);

  const getEventsForDate = (dateStr: string) => {
    return calendarEvents.filter((ev) => getUtcYMD(ev.eventDate) === dateStr);
  };

  const handleMarkAttendance = async (status: "PRESENT" | "ABSENT" | "EXCUSED") => {
    if (!canEdit || !signatory) return;
    setSavingAction(true);
    try {
      const res = await fetch("/api/bac/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatoryId: signatory.id,
          date: selectedDayStr,
          status,
        }),
      });
      if (!res.ok) throw new Error("Failed to save attendance");
      toast.success(`Marked ${status.toLowerCase()} for ${selectedDayStr}`);
      await fetchDetail();
    } catch {
      toast.error("Failed to record attendance");
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !signatory) return;
    if (new Date(leaveEndDate) < new Date(leaveStartDate)) {
      toast.error("End date cannot be earlier than start date");
      return;
    }
    setSavingAction(true);
    try {
      const mappedType =
        leaveType === "OB"
          ? "OFFICIAL_BUSINESS"
          : leaveType === "ON_TRAVEL"
          ? "ON_TRAVEL"
          : leaveType === "ABSENT"
          ? "ABSENT"
          : "VACATION";
      const res = await fetch("/api/bac/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatoryId: signatory.id,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          leaveType: mappedType,
          approvedBy: signsInBehalf.trim() || null,
          reason:
            leaveType === "OB"
              ? "Official Business"
              : leaveType === "ON_TRAVEL"
              ? "On Travel"
              : leaveType === "ABSENT"
              ? "Absent"
              : "On Leave",
        }),
      });
      if (!res.ok) throw new Error("Failed to save leave");
      toast.success("Leave / OB record saved");
      setSignsInBehalf("");
      await fetchDetail();
    } catch {
      toast.error("Failed to save leave record");
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteLeave = async () => {
    if (!leaveToDelete) return;
    try {
      const res = await fetch(`/api/bac/leave/${leaveToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Record deleted");
      setLeaveToDelete(null);
      await fetchDetail();
    } catch {
      toast.error("Failed to delete record");
    }
  };

  const handleEditSignatory = async (data: Record<string, string>) => {
    if (!signatory) return;
    const res = await fetch(`/api/signatories/${signatory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        position: data.position,
        role: data.role,
        officeId: data.officeId || null,
        isActive: signatory.isActive,
      }),
    });
    if (!res.ok) throw new Error("Failed to update signatory");
    toast.success("Signatory updated");
    setShowEditModal(false);
    await fetchDetail();
  };

  if (loading && !signatory) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoaderWave />
      </div>
    );
  }

  if (error || !signatory) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-900">Signatory Not Found</h2>
        <p className="mt-1 text-sm text-slate-500">{error || "Unable to load signatory."}</p>
        <Link
          href="/signatories"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <ArrowLeft size={16} /> Back to Signatories
        </Link>
      </div>
    );
  }

  const selectedDayEvents = getEventsForDate(selectedDayStr);
  const selectedDayStatus = getDayStatus(selectedDayStr);

  return (
    <div className="w-full space-y-5">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/signatories"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Back to Signatories & Attendance
        </Link>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
          >
            <Edit2 size={14} />
            Edit Signatory
          </button>
        )}
      </div>

      {/* Hero Signatory Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-xl font-bold text-white shadow-md">
              {getInitials(signatory.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{signatory.name}</h1>
                <StatusBadge status={signatory.isActive} />
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-600">{signatory.position}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
                  {getRoleLabel(signatory.role)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  {signatory.office?.name || "No Office Assigned"}
                </span>
              </div>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setMonthDate(new Date(year, month - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-[150px] text-center text-sm font-bold text-slate-900">
              {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              onClick={() => setMonthDate(new Date(year, month + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold text-slate-500">Present Days</span>
            <UserCheck size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.present}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold text-slate-500">On Leave</span>
            <CalendarIcon size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.onLeave}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-semibold text-slate-500">Official Business</span>
            <Briefcase size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.ob}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-cyan-600">
            <span className="text-xs font-semibold text-slate-500">On Travel</span>
            <Briefcase size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.onTravel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-semibold text-slate-500">Absent</span>
            <UserX size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.absent}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-500">Excused</span>
            <Clock size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{monthlyStats.excused}</div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left: Monthly Attendance Calendar + History Table */}
        <div className="space-y-5 xl:col-span-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Monthly Attendance Calendar</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                  Present
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">
                  On Leave
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-blue-700">OB</span>
                <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-cyan-800">
                  On Travel
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-700">Absent</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
                  Excused
                </span>
              </div>
            </div>

            <div className="mb-1 grid grid-cols-7 border-b border-slate-100 pb-2 text-center">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                <div
                  key={day}
                  className="text-[11px] font-bold tracking-wider text-slate-400 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 border-t border-l border-slate-100">
              {calendarDays.map((cell, idx) => {
                const statusInfo = getDayStatus(cell.dateStr);
                const dayEvents = getEventsForDate(cell.dateStr);
                const isSelected = selectedDayStr === cell.dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDayStr(cell.dateStr);
                      setLeaveStartDate(cell.dateStr);
                      setLeaveEndDate(cell.dateStr);
                    }}
                    className={`min-h-[92px] cursor-pointer border-r border-b border-slate-100 p-1.5 transition-colors flex flex-col justify-between ${
                      cell.isCurrentMonth
                        ? "bg-white hover:bg-slate-50/80"
                        : "bg-slate-50/40 text-slate-400"
                    } ${isSelected ? "bg-blue-50/30 ring-2 ring-blue-500/40" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      {cell.isToday ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {cell.date.getDate()}
                        </span>
                      ) : (
                        <span
                          className={`pl-1 text-xs font-semibold ${
                            cell.isCurrentMonth ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1 overflow-hidden">
                      {statusInfo && (
                        <div
                          className={`truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            statusInfo.kind === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : statusInfo.kind === "OB"
                              ? "bg-blue-100 text-blue-800"
                              : statusInfo.kind === "ON_TRAVEL"
                              ? "bg-cyan-100 text-cyan-900"
                              : statusInfo.kind === "ABSENT"
                              ? "bg-rose-100 text-rose-800"
                              : statusInfo.kind === "EXCUSED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {statusInfo.label}
                        </div>
                      )}
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          title={`${ev.eventType}: ${ev.title}`}
                          className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getEventBadgeStyle(
                            ev.eventType,
                            ev.title
                          )}`}
                        >
                          {ev.eventType}: {ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave & OB History for this Signatory */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              Leave & OB History ({allLeaves.length})
            </h3>
            {allLeaves.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                No leave or OB records filed for this signatory.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Dates</th>
                      <th className="px-3 py-2">Signs In Behalf</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allLeaves.map((l) => {
                      const isOB = l.leaveType === "OFFICIAL_BUSINESS" || l.leaveType === "OB";
                      const isOnTravel = l.leaveType === "ON_TRAVEL";
                      const isAbsent = l.leaveType === "ABSENT";
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isOB
                                  ? "bg-blue-100 text-blue-700"
                                  : isOnTravel
                                  ? "bg-cyan-100 text-cyan-800"
                                  : isAbsent
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {isOB ? "OB" : isOnTravel ? "On Travel" : isAbsent ? "Absent" : "On Leave"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-700">
                            {getUtcYMD(l.startDate)}
                            {getUtcYMD(l.startDate) !== getUtcYMD(l.endDate)
                              ? ` → ${getUtcYMD(l.endDate)}`
                              : ""}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{l.approvedBy || "—"}</td>
                          <td className="px-3 py-2.5 text-right">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setLeaveToDelete(l)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Day Inspector & Quick Record */}
        <div className="space-y-5 xl:col-span-4">
          {/* Selected Day Panel */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Selected Date: {selectedDayStr}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Current status:{" "}
              <strong className="text-slate-800">
                {selectedDayStatus ? selectedDayStatus.label : "Not recorded"}
              </strong>
            </p>

            {canEdit && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => handleMarkAttendance("PRESENT")}
                  className="flex items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Present
                </button>
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => handleMarkAttendance("ABSENT")}
                  className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                >
                  <UserX size={13} /> Absent
                </button>
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => handleMarkAttendance("EXCUSED")}
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  <Clock size={13} /> Excused
                </button>
              </div>
            )}

            {selectedDayEvents.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Scheduled BAC Activities
                </div>
                <div className="space-y-1.5">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-lg border px-3 py-2 text-xs ${getEventBadgeStyle(
                        ev.eventType,
                        ev.title
                      )}`}
                    >
                      <div className="font-bold">{ev.eventType}</div>
                      <div>{ev.title}</div>
                      {ev.pr?.id && (
                        <Link
                          href={`/procurement-folders/${ev.pr.id}`}
                          className="mt-1 inline-block text-[11px] font-semibold underline"
                        >
                          Open Folder ({ev.pr.prNumber || "PR"})
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File Leave / OB Form */}
          {canEdit && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <h3 className="mb-3 text-sm font-bold text-slate-900">File Leave / OB</h3>
              <form onSubmit={handleSaveLeave} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["ON_LEAVE", "OB", "ON_TRAVEL", "ABSENT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLeaveType(t)}
                      className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold cursor-pointer ${
                        leaveType === t
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {leaveType === t && <Check size={12} />}
                      {t === "ON_LEAVE"
                        ? "On Leave"
                        : t === "OB"
                        ? "OB"
                        : t === "ON_TRAVEL"
                        ? "On Travel"
                        : "Absent"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Signs in behalf (optional)
                  </label>
                  <input
                    type="text"
                    value={signsInBehalf}
                    onChange={(e) => setSignsInBehalf(e.target.value)}
                    placeholder="e.g., Vice-Chair / Alternate"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingAction}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  Save Leave / OB Record
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Edit Signatory Modal */}
      {showEditModal && (
        <FormModal
          title="Edit Signatory"
          fields={[
            { key: "name", label: "Full Name (with Title)", required: true },
            { key: "position", label: "Official Position / Designation", required: true },
            {
              key: "role",
              label: "System Signatory Role",
              type: "select",
              required: true,
              options: SIGNATORY_ROLES,
            },
            {
              key: "officeId",
              label: "Assigned Office (Optional)",
              type: "select",
              options: offices.map((o) => ({ value: o.id, label: o.name })),
            },
          ]}
          initialValues={{
            name: signatory.name,
            position: signatory.position,
            role: signatory.role,
            officeId: signatory.officeId || "",
          }}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSignatory}
          submitLabel="Save Changes"
        />
      )}

      {/* Delete Leave Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(leaveToDelete)}
        onClose={() => setLeaveToDelete(null)}
        onConfirm={handleDeleteLeave}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this leave/OB record?"
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
