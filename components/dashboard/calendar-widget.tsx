"use client";

import { useState, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO, isAfter } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, FileText, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import LoaderWave from "@/components/ui/loader-wave";

interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  eventTime: string | null;
  notes: string | null;
  prId: string | null;
  pr?: { prNumber: string; purpose: string };
}

const EVENT_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  "Award Date": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "Bid Opening": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "BAC Meeting": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Delivery": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Other": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

export default function CalendarWidget({ actionRequiredNode }: { actionRequiredNode?: React.ReactNode }) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "VIEWER";
  const canEdit = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Award Date");
  const [eventTime, setEventTime] = useState("");
  const [notes, setNotes] = useState("");
  const [prId, setPrId] = useState("");
  const [prs, setPrs] = useState<{ id: string, prNumber: string, purpose: string }[]>([]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const monthStart = startOfWeek(startOfMonth(currentDate));
      const monthEnd = endOfWeek(endOfMonth(currentDate));

      const res = await fetch(`/api/calendar?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`);
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
  }, [currentDate]);

  useEffect(() => {
    if (canEdit && prs.length === 0) {
      fetch('/api/purchase-requests?limit=100')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setPrs(data);
        })
        .catch(console.error);
    }
  }, [canEdit, prs.length]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDateClick = (day: Date) => {
    if (!canEdit) return;
    setSelectedDate(day);
    setSelectedEvent(null);
    setTitle("");
    setEventType("Award Date");
    setEventTime("");
    setNotes("");
    setPrId("");
    setShowEventModal(true);
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setSelectedDate(parseISO(event.eventDate));
    setSelectedEvent(event);
    setTitle(event.title);
    setEventType(event.eventType);
    setEventTime(event.eventTime || "");
    setNotes(event.notes || "");
    setPrId(event.prId || "");
    setShowEventModal(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title, eventType, eventDate: selectedDate?.toISOString(), eventTime, notes, prId: prId || null
      };

      const url = selectedEvent ? `/api/calendar/${selectedEvent.id}` : '/api/calendar';
      const method = selectedEvent ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save event");
      toast.success(`Event ${selectedEvent ? 'updated' : 'created'}`);
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
      const res = await fetch(`/api/calendar/${selectedEvent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success("Event deleted");
      setShowEventModal(false);
      fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    }
  };

  // Render Grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const dayEvents = events.filter(e => isSameDay(parseISO(e.eventDate), cloneDay));
      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <div
          key={day.toString()}
          onClick={() => handleDateClick(cloneDay)}
          className={`min-h-[100px] border border-slate-100 p-1 flex flex-col gap-1 transition-colors ${!isCurrentMonth ? "bg-slate-50 text-slate-400" : "bg-white text-slate-800"} ${canEdit ? "cursor-pointer hover:bg-slate-50" : ""}`}
        >
          <div className={`text-right text-xs font-semibold p-1 ${isSameDay(day, new Date()) ? "text-blue-600 font-bold bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center ml-auto" : ""}`}>
            {formattedDate}
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 hide-scrollbar">
            {dayEvents.map((evt) => {
              const color = EVENT_COLORS[evt.eventType] || EVENT_COLORS["Other"];
              return (
                <div
                  key={evt.id}
                  onClick={(e) => handleEventClick(e, evt)}
                  className={`text-[10px] leading-tight p-1 rounded border ${color.bg} ${color.text} ${color.border} truncate ${canEdit || evt.notes ? "cursor-pointer hover:opacity-80" : ""}`}
                  title={evt.title}
                >
                  <div className="font-bold truncate">{evt.eventTime ? `${evt.eventTime} ` : ""}{evt.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>);
    days = [];
  }

  // Next Award Date & Upcoming List
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter(e => isAfter(parseISO(e.eventDate), today) || isSameDay(parseISO(e.eventDate), today));
  const nextAwardEvent = upcomingEvents.find(e => e.eventType === "Award Date");

  return (
    <div className="flex flex-col gap-6 mb-6">

      {/* Row 3: Calendar Grid & Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Calendar Grid (col-span-2) */}
        <div className="card lg:col-span-2 flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {format(currentDate, "MMMM yyyy")}
              {loading && <LoaderWave />}
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors">Today</button>
              <div className="flex bg-slate-100 rounded">
                <button onClick={prevMonth} className="p-1 text-slate-600 hover:bg-slate-200 rounded-l transition-colors"><ChevronLeft size={20} /></button>
                <button onClick={nextMonth} className="p-1 text-slate-600 hover:bg-slate-200 rounded-r transition-colors"><ChevronRight size={20} /></button>
              </div>
            </div>
          </div>
          {/* Grid */}
          <div className="flex-1 bg-slate-50 p-2 lg:p-4">
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {rows}
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 p-3 border-t border-slate-100 bg-white text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Award Date</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Bid Opening</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div> BAC Meeting</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> Delivery</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div> Other</div>
            <div className="ml-auto italic opacity-75">Click a day to view or edit events.</div>
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="card flex flex-col flex-1 border-0 shadow-none bg-slate-800 text-white relative overflow-hidden" style={{ borderRadius: '1rem' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>

          <div className="z-10 flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-black">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : format(new Date(), "MMM d, yyyy")}
            </h3>
            {canEdit && (
              <button
                onClick={() => {
                  setSelectedDate(selectedDate || new Date());
                  setSelectedEvent(null);
                  setTitle("");
                  setEventType("Award Date");
                  setEventTime("");
                  setNotes("");
                  setPrId("");
                  setShowEventModal(true);
                }}
                className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-black text-xs font-bold rounded-full transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> Event
              </button>
            )}
          </div>

          <div className="z-10 flex-1 flex flex-col gap-3">
            {events.filter(e => isSameDay(parseISO(e.eventDate), selectedDate || new Date())).length > 0 ? (
              events.filter(e => isSameDay(parseISO(e.eventDate), selectedDate || new Date())).map(evt => (
                <div key={evt.id} className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg flex flex-col gap-1 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={(e) => handleEventClick(e, evt)}>
                  <div className="text-sm font-bold text-blue-200 flex items-center justify-between">
                    <span>{evt.title}</span>
                    {evt.eventTime && <span className="text-xs text-slate-400">{evt.eventTime}</span>}
                  </div>
                  <div className="text-xs text-slate-300">{evt.eventType}</div>
                  {evt.pr && <div className="text-[10px] text-indigo-300 mt-1">PR: {evt.pr.prNumber}</div>}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 my-auto">
                No events on this day.<br /><br />
                You can add, edit and delete events.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming Events & Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming (30 Days) */}
        <div className="card lg:col-span-2 flex flex-col min-h-[300px]">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            Upcoming (next 30 days)
          </h3>
          <div className="flex-1 flex flex-col gap-3">
            {upcomingEvents.slice(0, 5).map(evt => {
              const color = EVENT_COLORS[evt.eventType] || EVENT_COLORS["Other"];
              // Use a circle indicator instead of date box
              const dotColorClass = evt.eventType === "Award Date" ? "bg-green-500" :
                evt.eventType === "Bid Opening" ? "bg-blue-500" :
                  evt.eventType === "BAC Meeting" ? "bg-purple-500" :
                    evt.eventType === "Delivery" ? "bg-amber-500" : "bg-slate-400";
              return (
                <div key={evt.id} className="flex gap-3 items-center p-2 border-b border-slate-100 last:border-0 last:pb-0" onClick={(e) => handleEventClick(e, evt)}>
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColorClass} mt-1 self-start`}></div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-800">{evt.title}</div>
                    <div className="text-xs text-slate-500">
                      {format(parseISO(evt.eventDate), "MMM d, yyyy")} - {evt.eventType}
                    </div>
                  </div>
                </div>
              );
            })}
            {upcomingEvents.length === 0 && (
              <div className="text-sm text-slate-500 py-4">No upcoming events this month.</div>
            )}
          </div>
        </div>

        {/* Action Required Node injected from DashboardClient */}
        {actionRequiredNode}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">{selectedEvent ? (canEdit ? 'Edit Event' : 'Event Details') : 'Add New Event'}</h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveEvent} className="p-5 flex flex-col gap-4">
              {(!canEdit && selectedEvent) ? (
                <div className="flex flex-col gap-3">
                  <div className="text-xs font-semibold text-blue-600 tracking-wider uppercase mb-2">{format(parseISO(selectedEvent.eventDate), "MMMM d, yyyy")}</div>
                  <div className="text-xl font-black text-slate-800">{selectedEvent.title}</div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${EVENT_COLORS[selectedEvent.eventType]?.bg} ${EVENT_COLORS[selectedEvent.eventType]?.text}`}>{selectedEvent.eventType}</span>
                  </div>
                  {selectedEvent.eventTime && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                      <Clock size={16} /> {selectedEvent.eventTime}
                    </div>
                  )}
                  {selectedEvent.notes && (
                    <div className="mt-2 text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">
                      {selectedEvent.notes}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="button" onClick={() => setShowEventModal(false)} className="btn btn-secondary w-full">Close</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-slate-500 bg-slate-50 p-2 rounded flex items-center gap-2">
                    <CalendarIcon size={14} /> {selectedDate && format(selectedDate, "MMMM d, yyyy")}
                  </div>

                  <div>
                    <label className="form-label text-xs">Event Title *</label>
                    <input required type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g., Pre-bid Conference for Laptops" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-xs">Event Type *</label>
                      <select required className="form-select" value={eventType} onChange={e => setEventType(e.target.value)}>
                        <option value="Award Date">Award Date</option>
                        <option value="Bid Opening">Bid Opening</option>
                        <option value="BAC Meeting">BAC Meeting</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs">Time</label>
                      <input type="time" className="form-input" value={eventTime} onChange={e => setEventTime(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-xs">Link to PR (Optional)</label>
                    <select className="form-select" value={prId} onChange={e => setPrId(e.target.value)}>
                      <option value="">-- No PR --</option>
                      {prs.map(p => <option key={p.id} value={p.id}>{p.prNumber} - {p.purpose.slice(0, 30)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label text-xs">Notes / Venue</label>
                    <textarea className="form-input h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Conference Room A..." />
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-4 border-t border-slate-100">
                    {selectedEvent && canEdit ? (
                      <button type="button" onClick={deleteEvent} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-semibold transition-colors">Delete</button>
                    ) : <div></div>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowEventModal(false)} className="btn btn-secondary text-sm">Cancel</button>
                      <button type="submit" className="btn btn-primary text-sm">Save Event</button>
                    </div>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
