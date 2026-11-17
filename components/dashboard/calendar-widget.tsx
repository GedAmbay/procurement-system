"use client";

import { useState, useEffect, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  FileText,
  Plus,
  X,
  Cake,
  Trophy,
  Users,
  CalendarX,
  FileSpreadsheet,
  Link as LinkIcon,
  UserCheck,
  Tag,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import LoaderWave from "@/components/ui/loader-wave";

export interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  eventTime: string | null;
  notes: string | null;
  prId: string | null;
  pr?: { id?: string; prNumber: string; purpose: string };
}

interface ParsedEventMeta {
  venue?: string;
  description?: string;
  participants?: string;
  recipient?: string;
  isRecurring?: boolean;
  birthMonth?: number | null;
  birthDay?: number | null;
  notes?: string;
}

export function parseEventNotes(notesString: string | null): ParsedEventMeta {
  if (!notesString) return {};
  try {
    const parsed = JSON.parse(notesString);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // legacy string
  }
  return { notes: notesString, description: notesString };
}

export const EVENT_CATEGORIES: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    dotBg: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  "Award Date": {
    label: "Award Date",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dotBg: "bg-emerald-500",
  },
  "Bid Opening": {
    label: "Bid Opening",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dotBg: "bg-blue-500",
  },
  "Pre-Bid": {
    label: "Pre-Bid",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dotBg: "bg-teal-500",
    icon: FileSpreadsheet,
  },
  COA: {
    label: "COA",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dotBg: "bg-indigo-500",
    icon: Users,
  },
  Birthday: {
    label: "Birthday",
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    dotBg: "bg-pink-500",
    icon: Cake,
  },
  "Award / Recognition": {
    label: "Award / Recognition",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dotBg: "bg-amber-500",
    icon: Trophy,
  },
  Award: {
    label: "Award",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dotBg: "bg-amber-500",
    icon: Trophy,
  },
  "On Leave / Absent": {
    label: "On Leave / Absent",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dotBg: "bg-rose-500",
    icon: CalendarX,
  },
  Other: {
    label: "Other",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dotBg: "bg-slate-400",
  },
  // Backward compatibility for historical events
  "BAC Meeting": {
    label: "BAC Meeting",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dotBg: "bg-purple-500",
  },
  Delivery: {
    label: "Delivery",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dotBg: "bg-amber-500",
  },
};

// Selectable categories for NEW event creation (BAC Meeting and Delivery removed per specs)
const CREATABLE_CATEGORIES = [
  "Pre-Bid",
  "Bid Opening",
  "Award Date",
  "COA",
  "Birthday",
  "Award / Recognition",
  "Other",
];

function getTitlePlaceholder(cat: string) {
  switch (cat) {
    case "Pre-Bid": return "e.g., Pre-bid Conference for Office Supplies";
    case "Bid Opening": return "e.g., Opening & Preliminary Examination of Bids";
    case "Award Date": return "e.g., Notice of Award Issuance";
    case "COA": return "e.g., COA Entrance Conference / Audit Inspection";
    case "Award / Recognition": return "e.g., Loyalty Service Award / Special Citation";
    case "Birthday": return "e.g., Engr. Cruz's Birthday";
    default: return "e.g., Budget Call / Town Hall Briefing";
  }
}

function getDescriptionPlaceholder(cat: string) {
  switch (cat) {
    case "Pre-Bid": return "Clarification of procurement requirements and specifications...";
    case "Bid Opening": return "Invited observers, eligibility requirements checklist...";
    case "Award Date": return "Recommended winning bidder, NOA conditions, or delivery timeline...";
    case "COA": return "Audit documentation, voucher inspection, or entrance briefing...";
    case "Award / Recognition": return "Special citation for outstanding procurement management...";
    case "Birthday": return "BAC Member / Municipal Engineering Office...";
    default: return "Event description, agenda, or notes...";
  }
}

export default function CalendarWidget() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "VIEWER";
  const canEdit = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Active filter
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Modal & Drawer State
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Category-specific Form states
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Pre-Bid");
  const [eventTime, setEventTime] = useState("");
  const [eventDateStr, setEventDateStr] = useState("");
  const [prId, setPrId] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isRecurringBirthday, setIsRecurringBirthday] = useState(true);

  const [prs, setPrs] = useState<{ id: string; prNumber: string; purpose: string }[]>([]);

  // Fetch events
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const monthStart = startOfWeek(startOfMonth(currentDate));
      const monthEnd = endOfWeek(endOfMonth(currentDate));

      const queryParams = new URLSearchParams({
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      });
      if (selectedCategory !== "ALL") {
        queryParams.set("category", selectedCategory);
      }

      const res = await fetch(`/api/calendar?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, selectedCategory]);

  useEffect(() => {
    if (canEdit && prs.length === 0) {
      fetch("/api/purchase-requests?limit=100")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setPrs(data);
        })
        .catch(console.error);
    }
  }, [canEdit, prs.length]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Reset form with category-specific defaults
  const openNewEventModal = (day?: Date, defaultCategory = "Pre-Bid") => {
    const targetDate = day || selectedDate || new Date();
    setSelectedDate(targetDate);
    setEventDateStr(format(targetDate, "yyyy-MM-dd"));
    setSelectedEvent(null);
    setIsEditingExisting(false);

    setEventType(defaultCategory);
    setTitle("");
    setEventTime("09:00");
    setPrId("");
    setVenue(defaultCategory === "Pre-Bid" || defaultCategory === "Bid Opening" ? "BAC Conference Room" : "");
    setDescription("");
    setParticipants("");
    setRecipient("");
    setIsRecurringBirthday(true);

    setShowEventModal(true);
  };

  const openViewOrEditModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    const parsedDate = parseISO(event.eventDate);
    setSelectedDate(parsedDate);
    setEventDateStr(format(parsedDate, "yyyy-MM-dd"));
    setIsEditingExisting(false);

    // Populate category-specific fields from event and its parsed notes
    setTitle(event.title);
    setEventType(event.eventType);
    setEventTime(event.eventTime || "");
    setPrId(event.prId || "");

    const meta = parseEventNotes(event.notes);
    setVenue(meta.venue || "");
    setDescription(meta.description || meta.notes || "");
    setParticipants(meta.participants || "");
    setRecipient(meta.recipient || "");
    setIsRecurringBirthday(meta.isRecurring !== undefined ? meta.isRecurring : true);

    setShowEventModal(true);
  };

  const startEditingEvent = () => {
    setIsEditingExisting(true);
  };

  const handleDateClick = (day: Date) => {
    const dayEvents = events.filter((e) => isSameDay(parseISO(e.eventDate), day));
    if (dayEvents.length === 1 && !canEdit) {
      openViewOrEditModal(dayEvents[0]);
    } else if (dayEvents.length > 0) {
      // If events exist, open first event or add event if canEdit
      openViewOrEditModal(dayEvents[0]);
    } else if (canEdit) {
      openNewEventModal(day);
    }
  };

  const handleEventBadgeClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    openViewOrEditModal(event);
  };

  // Submit form (Create or Update)
  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    // Generate formatted title for birthday if empty
    let finalTitle = title.trim();
    if (eventType === "Birthday" && !finalTitle) {
      finalTitle = `${recipient || "Member"}'s Birthday`;
    }

    if (!finalTitle) {
      toast.error("Please enter an event title");
      return;
    }

    try {
      const targetDate = new Date(`${eventDateStr}T12:00:00`);

      const payload = {
        title: finalTitle,
        eventType,
        eventDate: targetDate.toISOString(),
        eventTime: eventTime || null,
        prId: prId || null,
        venue: venue || null,
        description: description || null,
        participants: participants || null,
        recipient: recipient || null,
        isRecurring: eventType === "Birthday" ? isRecurringBirthday : undefined,
        birthMonth: eventType === "Birthday" ? targetDate.getMonth() + 1 : undefined,
        birthDay: eventType === "Birthday" ? targetDate.getDate() : undefined,
      };

      const isUpdate = selectedEvent && isEditingExisting;
      const url = isUpdate ? `/api/calendar/${selectedEvent.id}` : "/api/calendar";
      const method = isUpdate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save event");
      toast.success(`Event ${isUpdate ? "updated" : "created"} successfully`);
      setShowEventModal(false);
      fetchEvents();
    } catch (error) {
      toast.error("Error saving event");
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      const res = await fetch(`/api/calendar/${selectedEvent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Event deleted");
      setShowEventModal(false);
      fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    }
  };

  // Build Calendar Matrix
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDate;

  // Filter events according to selectedCategory
  const displayedEvents = useMemo(() => {
    if (selectedCategory === "ALL") return events;
    return events.filter((e) => e.eventType === selectedCategory);
  }, [events, selectedCategory]);

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const formattedDate = format(day, "d");
      const dayEvents = displayedEvents.filter((e) => isSameDay(parseISO(e.eventDate), cloneDay));
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, new Date());

      days.push(
        <div
          key={day.toString()}
          onClick={() => handleDateClick(cloneDay)}
          className={`min-h-[92px] border border-slate-100/90 p-1.5 flex flex-col gap-1 transition-all ${
            !isCurrentMonth ? "bg-slate-50/50 text-slate-400" : "bg-white text-slate-800"
          } ${canEdit || dayEvents.length > 0 ? "cursor-pointer hover:bg-slate-50/80" : ""}`}
        >
          {/* Day number cell header */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center justify-center">
              {isToday ? (
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {formattedDate}
                </span>
              ) : (
                <span
                  className={`text-xs font-semibold ${
                    isCurrentMonth ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {formattedDate}
                </span>
              )}
            </div>

            {/* Quick add button on hover for authorized users */}
            {canEdit && isCurrentMonth && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openNewEventModal(cloneDay);
                }}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-blue-600 p-0.5 rounded transition-opacity"
                title="Add event on this date"
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          {/* Event Badges inside cell */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 hide-scrollbar">
            {dayEvents.map((evt) => {
              const category = EVENT_CATEGORIES[evt.eventType] || EVENT_CATEGORIES["Other"];
              const Icon = category.icon;

              return (
                <div
                  key={evt.id}
                  onClick={(e) => handleEventBadgeClick(e, evt)}
                  className={`text-[10px] leading-tight px-1.5 py-1 rounded-md border ${category.bg} ${category.text} ${category.border} truncate font-semibold flex items-center gap-1 shadow-2xs hover:opacity-90 hover:scale-[1.01] transition-all cursor-pointer`}
                  title={`${evt.title}${evt.eventTime ? ` (${evt.eventTime})` : ""}`}
                >
                  {Icon && <Icon size={11} className="shrink-0" />}
                  <span className="truncate">{evt.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  // Active event metadata helper for view modal
  const activeEventMeta = selectedEvent ? parseEventNotes(selectedEvent.notes) : {};

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon size={20} className="text-blue-600" />
            <span>{format(currentDate, "MMMM yyyy")}</span>
            {loading && <LoaderWave />}
          </h2>
        </div>

        {/* Navigation & Action Controls */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => openNewEventModal(new Date())}
              className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors flex items-center gap-1 shadow-2xs mr-1"
            >
              <Plus size={13} className="stroke-[2.5]" />
              Event
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="px-3.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 my-3 text-center">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div
            key={d}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Days Matrix */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-100/90 shadow-2xs">
        {rows}
      </div>

      {/* Bottom Category Filter & Legend */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-3.5 pt-4 mt-4 border-t border-slate-100 text-xs font-medium text-slate-600">
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
            selectedCategory === "ALL"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(selectedCategory === "Award Date" ? "ALL" : "Award Date")
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Award Date"
              ? "bg-emerald-100 text-emerald-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span>Award Date</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(selectedCategory === "Bid Opening" ? "ALL" : "Bid Opening")
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Bid Opening"
              ? "bg-blue-100 text-blue-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          <span>Bid Opening</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(selectedCategory === "Pre-Bid" ? "ALL" : "Pre-Bid")
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Pre-Bid"
              ? "bg-teal-100 text-teal-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet size={13} className="text-teal-600" />
          <span>Pre-Bid</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === "COA" ? "ALL" : "COA")}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "COA"
              ? "bg-indigo-100 text-indigo-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <Users size={13} className="text-indigo-600" />
          <span>COA</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(selectedCategory === "Other" ? "ALL" : "Other")
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Other"
              ? "bg-slate-200 text-slate-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
          <span>Other</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(selectedCategory === "Birthday" ? "ALL" : "Birthday")
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Birthday"
              ? "bg-pink-100 text-pink-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <Cake size={13} className="text-pink-500" />
          <span>Birthday</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(
              selectedCategory === "Award / Recognition" ? "ALL" : "Award / Recognition"
            )
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "Award / Recognition"
              ? "bg-amber-100 text-amber-900 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <Trophy size={13} className="text-amber-500" />
          <span>Award</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedCategory(
              selectedCategory === "On Leave / Absent" ? "ALL" : "On Leave / Absent"
            )
          }
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
            selectedCategory === "On Leave / Absent"
              ? "bg-rose-100 text-rose-800 font-bold"
              : "hover:bg-slate-100"
          }`}
        >
          <CalendarX size={13} className="text-rose-500" />
          <span>On Leave / Not Present</span>
        </button>
      </div>

      {/* Event Details / Category-Specific Form Modal */}
      {showEventModal && (() => {
        const inputClass = "w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs font-normal";
        const selectClass = "w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200/90 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs font-medium cursor-pointer";
        const textareaClass = "w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs resize-none";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/90 max-h-[90vh] flex flex-col transition-all">
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-2xs">
                    <CalendarIcon size={17} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                      {selectedEvent && !isEditingExisting
                        ? "Event Details"
                        : selectedEvent && isEditingExisting
                        ? "Edit Event"
                        : "Add New Event"}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      {selectedEvent && !isEditingExisting
                        ? "View event milestones and linked records"
                        : "Schedule procurement milestones and activities"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Modal Body */}
              {selectedEvent && !isEditingExisting ? (
                /* VIEW MODE: If viewing existing event and not editing */
                <div className="p-6 overflow-y-auto flex flex-col gap-4">
                  {/* Category badge & Title */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const CategoryIcon = EVENT_CATEGORIES[selectedEvent.eventType]?.icon;
                        return (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                              EVENT_CATEGORIES[selectedEvent.eventType]?.bg || "bg-slate-100"
                            } ${
                              EVENT_CATEGORIES[selectedEvent.eventType]?.text || "text-slate-700"
                            } border ${
                              EVENT_CATEGORIES[selectedEvent.eventType]?.border || "border-slate-200"
                            }`}
                          >
                            {CategoryIcon && <CategoryIcon size={12} />}
                            {selectedEvent.eventType}
                          </span>
                        );
                      })()}
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 leading-snug">
                      {selectedEvent.title}
                    </h4>
                  </div>

                  {/* Metadata Grid */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-700">{format(parseISO(selectedEvent.eventDate), "MMMM d, yyyy")}</span>
                    </div>

                    {selectedEvent.eventTime && (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-blue-600 shrink-0" />
                        <span className="font-medium text-slate-700">{selectedEvent.eventTime}</span>
                      </div>
                    )}

                    {activeEventMeta.venue && (
                      <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                        <MapPin size={14} className="text-blue-600 shrink-0" />
                        <span className="font-medium text-slate-800">
                          {activeEventMeta.venue}
                        </span>
                      </div>
                    )}

                    {activeEventMeta.recipient && (
                      <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                        <Trophy size={14} className="text-amber-600 shrink-0" />
                        <span>
                          Recipient:{" "}
                          <strong className="text-slate-800">
                            {activeEventMeta.recipient}
                          </strong>
                        </span>
                      </div>
                    )}

                    {activeEventMeta.participants && (
                      <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                        <Users size={14} className="text-indigo-600 shrink-0" />
                        <span>
                          Participants:{" "}
                          <strong className="text-slate-800">
                            {activeEventMeta.participants}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Linked Procurement Record */}
                  {selectedEvent.pr && (
                    <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-blue-900">
                            PR #{selectedEvent.pr.prNumber}
                          </div>
                          <div className="text-[11px] text-blue-700 truncate max-w-xs">
                            {selectedEvent.pr.purpose}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/procurement-folders/${selectedEvent.prId || selectedEvent.pr.id}`}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1 hover:underline"
                      >
                        Open <ExternalLink size={12} />
                      </Link>
                    </div>
                  )}

                  {/* Description / Notes */}
                  {activeEventMeta.description && (
                    <div className="text-xs text-slate-700 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 leading-relaxed">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Description / Agenda
                      </div>
                      {activeEventMeta.description}
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={deleteEvent}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={startEditingEvent}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}

                    <button
                      type="button"
                      onClick={() => setShowEventModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* EDIT OR CREATE FORM MODE */
                <form onSubmit={saveEvent} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-6 overflow-y-auto space-y-4">
                    {/* Category Selector Chips */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        Event Category
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {CREATABLE_CATEGORIES.map((cat) => {
                          const isSelected = eventType === cat;
                          const meta = EVENT_CATEGORIES[cat];
                          const Icon = meta?.icon;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setEventType(cat);
                                if ((cat === "Pre-Bid" || cat === "Bid Opening") && !venue) {
                                  setVenue("BAC Conference Room");
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isSelected
                                  ? `${meta?.bg || "bg-blue-50"} ${meta?.text || "text-blue-700"} ring-2 ring-blue-500/30 border border-blue-200 shadow-2xs`
                                  : "bg-slate-50/80 hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                              }`}
                            >
                              {Icon ? <Icon size={13} /> : <span className={`w-2 h-2 rounded-full ${meta?.dotBg || "bg-slate-400"}`} />}
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Birthday-Specific Fields */}
                    {eventType === "Birthday" ? (
                      <>
                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Celebrant / Person Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            className={inputClass}
                            value={recipient}
                            onChange={(e) => {
                              setRecipient(e.target.value);
                              setTitle(`${e.target.value}'s Birthday`);
                            }}
                            placeholder="e.g. Engr. Carlos Cruz"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Event Title
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Engr. Cruz's Birthday"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Birth Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            required
                            type="date"
                            className={inputClass}
                            value={eventDateStr}
                            onChange={(e) => setEventDateStr(e.target.value)}
                          />
                        </div>

                        {/* Annual Recurring Birthday Card */}
                        <div className="flex items-center justify-between p-3.5 bg-pink-50/60 rounded-xl border border-pink-100/90">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                              <Cake size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-pink-900">Annual Recurring Birthday</div>
                              <div className="text-[11px] text-pink-700/80">Automatically repeats every year on this date</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isRecurringBirthday}
                            onChange={(e) => setIsRecurringBirthday(e.target.checked)}
                            className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 cursor-pointer accent-pink-600"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Department / Notes
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="BAC Member / Municipal Engineering Office"
                          />
                        </div>
                      </>
                    ) : (
                      /* Standard Categories (Pre-Bid, Bid Opening, Award Date, COA, Award / Recognition, Other) */
                      <>
                        {/* Title */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Title <span className="text-rose-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            className={inputClass}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={getTitlePlaceholder(eventType)}
                          />
                        </div>

                        {/* Date & Time Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                              Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                              required
                              type="date"
                              className={inputClass}
                              value={eventDateStr}
                              onChange={(e) => setEventDateStr(e.target.value)}
                            />
                          </div>
                          {eventType !== "Award Date" ? (
                            <div>
                              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                <span>Time</span>
                                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                              </label>
                              <input
                                type="time"
                                className={inputClass}
                                value={eventTime}
                                onChange={(e) => setEventTime(e.target.value)}
                              />
                            </div>
                          ) : null}
                        </div>

                        {/* Linked PR (Pre-Bid, Bid Opening, Award Date, COA) */}
                        {(eventType === "Pre-Bid" || eventType === "Bid Opening" || eventType === "Award Date" || eventType === "COA") && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700">
                                Linked Procurement Record (PR)
                              </label>
                              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                            </div>
                            <select
                              className={selectClass}
                              value={prId}
                              onChange={(e) => {
                                setPrId(e.target.value);
                                const matched = prs.find((p) => p.id === e.target.value);
                                if (matched) {
                                  if (eventType === "Award Date") {
                                    setTitle(`Award – ${matched.prNumber || "Procurement"}`);
                                  } else if (!title) {
                                    setTitle(`${eventType} – ${matched.prNumber}`);
                                  }
                                }
                              }}
                            >
                              <option value="">-- None / General Event (Optional) --</option>
                              {prs.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.prNumber} – {p.purpose.slice(0, 45)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Venue (Pre-Bid, Bid Opening, COA) */}
                        {(eventType === "Pre-Bid" || eventType === "Bid Opening" || eventType === "COA") && (
                          <div>
                            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                              Venue / Location
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={venue}
                              onChange={(e) => setVenue(e.target.value)}
                              placeholder="e.g. BAC Conference Room, Municipal Hall"
                            />
                          </div>
                        )}

                        {/* Participants (Pre-Bid) */}
                        {eventType === "Pre-Bid" && (
                          <div>
                            <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                              <span>Participants</span>
                              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={participants}
                              onChange={(e) => setParticipants(e.target.value)}
                              placeholder="BAC Members, TWG, Secretariat, Observers"
                            />
                          </div>
                        )}

                        {/* Recipient (Award / Recognition) */}
                        {eventType === "Award / Recognition" && (
                          <div>
                            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                              Recipient or Department
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={recipient}
                              onChange={(e) => setRecipient(e.target.value)}
                              placeholder="e.g. Municipal Engineering Office / Hon. Maria Santos"
                            />
                          </div>
                        )}

                        {/* Description / Notes */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            {eventType === "Award Date" ? "Notes / Conditions" : "Description / Agenda"}
                          </label>
                          <textarea
                            rows={3}
                            className={textareaClass}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={getDescriptionPlaceholder(eventType)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Form Submission Controls - Sticky at bottom */}
                  <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    {selectedEvent && isEditingExisting ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingExisting(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        ← Back to Details
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEventModal(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        {selectedEvent && isEditingExisting ? "Save Changes" : "Create Event"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
