"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Calendar,
  ChevronDown,
  Check,
  Clock,
  CalendarX,
  AlertCircle,
  Plus,
  X,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export interface BacMemberItem {
  id: string;
  name: string;
  role: string;
  positionLabel: string;
  status: "PRESENT" | "ON_LEAVE" | "ABSENT" | "EXCUSED" | "NOT_RECORDED";
  initials: string;
  leaveInfo?: {
    id: string;
    leaveType: string;
    reason: string | null;
    startDate: string;
    endDate: string;
  } | null;
  attendanceId?: string | null;
  remarks?: string | null;
}

interface BacAttendancePanelProps {
  initialMembers?: { id: string; name: string; position?: string | null; role: string }[];
  selectedDate?: Date;
  onLeaveAdded?: () => void;
}

const DEFAULT_MEMBERS: BacMemberItem[] = [
  {
    id: "bac-1",
    name: "Engr. Jose Reyes",
    role: "BAC_CHAIRMAN",
    positionLabel: "BAC Chairman",
    status: "ON_LEAVE",
    initials: "JR",
  },
  {
    id: "bac-2",
    name: "Engr. Carlos Cruz",
    role: "BAC_MEMBER",
    positionLabel: "BAC Member",
    status: "ON_LEAVE",
    initials: "CC",
  },
  {
    id: "bac-3",
    name: "Hon. Maria Santos",
    role: "BAC_MEMBER",
    positionLabel: "BAC Member",
    status: "PRESENT",
    initials: "MS",
  },
  {
    id: "bac-4",
    name: "Dr. Ana Lim",
    role: "BAC_MEMBER",
    positionLabel: "BAC Member",
    status: "PRESENT",
    initials: "AL",
  },
  {
    id: "bac-5",
    name: "CPA Luz Bautista",
    role: "BAC_MEMBER",
    positionLabel: "BAC Member",
    status: "PRESENT",
    initials: "LB",
  },
];

function getInitials(name: string): string {
  const clean = name.replace(/^(hon\.|engr\.|dr\.|cpa|atty\.)\s+/i, "");
  const parts = clean.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0] ? parts[0].slice(0, 2) : "BM").toUpperCase();
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case "BAC_CHAIRMAN":
      return "BAC Chairman";
    case "BAC_VICE_CHAIRMAN":
      return "BAC Vice Chairman";
    case "BAC_MEMBER":
      return "BAC Member";
    default:
      return "BAC Member";
  }
}

export default function BacAttendancePanel({
  initialMembers,
  selectedDate = new Date(),
  onLeaveAdded,
}: BacAttendancePanelProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "VIEWER";
  const canEdit = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  const [dateStr, setDateStr] = useState<string>(format(selectedDate, "yyyy-MM-dd"));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [members, setMembers] = useState<BacMemberItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Leave filing modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveSignatoryId, setLeaveSignatoryId] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [leaveEndDate, setLeaveEndDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [leaveType, setLeaveType] = useState("VACATION");
  const [leaveReason, setLeaveReason] = useState("");

  // Quick attendance menu popup for a member
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  // Fetch real attendance for the active date
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bac/attendance?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.members && data.members.length > 0) {
          const mapped: BacMemberItem[] = data.members.map((m: any) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            positionLabel: formatRoleLabel(m.role),
            status: m.status,
            initials: getInitials(m.name),
            leaveInfo: m.leaveInfo,
            attendanceId: m.attendanceId,
            remarks: m.remarks,
          }));
          setMembers(mapped);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }

    // Fallback if no database members returned
    if (initialMembers && initialMembers.length > 0) {
      setMembers(
        initialMembers.map((sig, idx) => ({
          id: sig.id,
          name: sig.name,
          role: sig.role,
          positionLabel: formatRoleLabel(sig.role),
          status: idx < 2 ? "ON_LEAVE" : "PRESENT",
          initials: getInitials(sig.name),
        }))
      );
    } else {
      setMembers(DEFAULT_MEMBERS);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [dateStr]);

  // Quick attendance update
  const updateAttendanceStatus = async (
    memberId: string,
    newStatus: "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_RECORDED"
  ) => {
    if (!canEdit) return;
    try {
      const res = await fetch("/api/bac/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatoryId: memberId,
          date: dateStr,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Attendance updated");
      setActiveMenuMemberId(null);
      fetchAttendance();
    } catch {
      toast.error("Error updating attendance");
    }
  };

  // Submit approved leave record
  const submitLeaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveSignatoryId) {
      toast.error("Please select a BAC member");
      return;
    }

    try {
      const res = await fetch("/api/bac/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatoryId: leaveSignatoryId,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          leaveType,
          reason: leaveReason || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save leave");
      toast.success("Approved leave record saved and reflected on calendar");
      setShowLeaveModal(false);
      setLeaveReason("");
      fetchAttendance();
      if (onLeaveAdded) onLeaveAdded();
    } catch (error) {
      toast.error("Error recording leave");
    }
  };

  const selectedDisplayDate = new Date(`${dateStr}T12:00:00`);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={18} />
          </div>
          BAC Members – Attendance
        </h3>

        {/* Date Selector & Leave Action */}
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setLeaveSignatoryId(members[0]?.id || "");
                setShowLeaveModal(true);
              }}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs mr-1"
              title="Record verified BAC Member Leave"
            >
              <Plus size={12} className="stroke-[2.5]" />
              Leave
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <Calendar size={13} className="text-blue-600" />
              <span>{format(selectedDisplayDate, "MMM d, yyyy")}</span>
              <ChevronDown size={13} className="text-slate-400 ml-0.5" />
            </button>

            {/* Date Input Dropdown */}
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-100 p-2.5 z-30 flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Date
                </label>
                <input
                  type="date"
                  className="form-input text-xs py-1"
                  value={dateStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    setShowDatePicker(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Member Attendance List */}
      <div className="flex flex-col gap-2.5">
        {members.map((m) => {
          const isMenuOpen = activeMenuMemberId === m.id;

          return (
            <div
              key={m.id}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50/80 transition-colors relative"
            >
              {/* Member Profile */}
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-800 truncate leading-snug">
                  {m.name}
                </div>
                <div className="text-xs text-slate-400 font-medium truncate">
                  {m.positionLabel}
                </div>
              </div>

              {/* Status Pill & Interactive Status Toggle */}
              <div className="shrink-0 ml-3 relative">
                {m.status === "ON_LEAVE" ? (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/70 shadow-2xs"
                    title={
                      m.leaveInfo?.reason
                        ? `Approved Leave: ${m.leaveInfo.reason}`
                        : "Approved Leave"
                    }
                  >
                    <CalendarX size={12} className="text-rose-500" />
                    On Leave
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setActiveMenuMemberId(isMenuOpen ? null : m.id)
                    }
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${canEdit
                        ? "cursor-pointer hover:ring-2 hover:ring-blue-400/30"
                        : "cursor-default"
                      } ${m.status === "PRESENT"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-2xs"
                        : m.status === "ABSENT"
                          ? "bg-red-50 text-red-700 border border-red-200/70 shadow-2xs"
                          : m.status === "EXCUSED"
                            ? "bg-amber-50 text-amber-700 border border-amber-200/70 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border border-slate-200/70"
                      }`}
                  >
                    {m.status === "PRESENT" && (
                      <Check size={12} className="text-emerald-600 stroke-[3]" />
                    )}
                    {m.status === "ABSENT" && (
                      <AlertCircle size={12} className="text-red-500" />
                    )}
                    {m.status === "EXCUSED" && (
                      <Clock size={12} className="text-amber-500" />
                    )}

                    <span>
                      {m.status === "PRESENT"
                        ? "Present"
                        : m.status === "ABSENT"
                          ? "Absent"
                          : m.status === "EXCUSED"
                            ? "Excused"
                            : "Not Recorded"}
                    </span>
                    {canEdit && <ChevronDown size={11} className="opacity-50 ml-0.5" />}
                  </button>
                )}

                {/* Status Selection Popup */}
                {isMenuOpen && canEdit && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 z-30 flex flex-col gap-1 w-32">
                    <button
                      type="button"
                      onClick={() => updateAttendanceStatus(m.id, "PRESENT")}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 text-left flex items-center justify-between"
                    >
                      Present <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendanceStatus(m.id, "ABSENT")}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-red-700 hover:bg-red-50 text-left flex items-center justify-between"
                    >
                      Absent <AlertCircle size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendanceStatus(m.id, "EXCUSED")}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-amber-700 hover:bg-amber-50 text-left flex items-center justify-between"
                    >
                      Excused <Clock size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendanceStatus(m.id, "NOT_RECORDED")}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-50 text-left"
                    >
                      Not Recorded
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Record Approved Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <CalendarX size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  Record BAC Member Leave
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitLeaveRecord} className="p-5 flex flex-col gap-4">
              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  BAC Member *
                </label>
                <select
                  required
                  className="form-select text-xs font-medium"
                  value={leaveSignatoryId}
                  onChange={(e) => setLeaveSignatoryId(e.target.value)}
                >
                  <option value="">-- Select Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.positionLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    Start Date *
                  </label>
                  <input
                    required
                    type="date"
                    className="form-input text-xs"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    End Date *
                  </label>
                  <input
                    required
                    type="date"
                    className="form-input text-xs"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  Leave Type
                </label>
                <select
                  className="form-select text-xs"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="VACATION">Vacation Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="OFFICIAL_BUSINESS">Official Business (OB)</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  Reason / Order Reference (Optional)
                </label>
                <textarea
                  className="form-input text-xs h-20 resize-none"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Official Travel Order / Special Leave Application..."
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Save Leave Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
