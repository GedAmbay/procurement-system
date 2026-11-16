"use client";

import { useState, useEffect } from "react";
import {
  Megaphone,
  Pin,
  Calendar,
  MapPin,
  ArrowRight,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Archive,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  eventDate?: string | null;
  eventTime?: string | null;
  venue?: string | null;
  isPinned: boolean;
  priority: string;
  targetAudience: string;
  isArchived: boolean;
  createdAt: string;
}

export default function AnnouncementsPanel() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "VIEWER";
  const canEdit = userRole === "ADMIN" || userRole === "BAC_SECRETARIAT";

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showViewAllModal, setShowViewAllModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [venue, setVenue] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [priority, setPriority] = useState("NORMAL");
  const [targetAudience, setTargetAudience] = useState("ALL");

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const current = announcements[activeIndex] || announcements[0];

  const handleNext = () => {
    if (announcements.length > 0) {
      setActiveIndex((prev) => (prev + 1) % announcements.length);
    }
  };

  const handlePrev = () => {
    if (announcements.length > 0) {
      setActiveIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please enter both a title and description");
      return;
    }

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          eventDate: eventDate || null,
          eventTime: eventTime || null,
          venue: venue || null,
          isPinned,
          priority,
          targetAudience,
        }),
      });

      if (!res.ok) throw new Error("Failed to create announcement");
      toast.success("Announcement published successfully");
      setShowCreateModal(false);
      setTitle("");
      setContent("");
      setEventDate("");
      setEventTime("");
      setVenue("");
      setIsPinned(false);
      fetchAnnouncements();
    } catch {
      toast.error("Error creating announcement");
    }
  };

  // Toggle Pin
  const togglePin = async (id: string, currentPinned: boolean) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      if (res.ok) {
        toast.success(currentPinned ? "Notice unpinned" : "Notice pinned to top");
        fetchAnnouncements();
      }
    } catch {
      toast.error("Failed to update pin status");
    }
  };

  // Archive notice
  const handleArchive = async (id: string) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      if (res.ok) {
        toast.success("Announcement archived");
        fetchAnnouncements();
      }
    } catch {
      toast.error("Failed to archive");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Megaphone size={18} />
          </div>
          Announcements
        </h3>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs mr-1"
              title="Publish new announcement"
            >
              <Plus size={12} className="stroke-[2.5]" />
              New
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowViewAllModal(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Featured / Active Announcement Card */}
      {current ? (
        <div className="relative rounded-xl border border-blue-100/80 bg-gradient-to-br from-blue-50/60 via-slate-50/40 to-indigo-50/40 p-4 transition-all">
          {/* Pin Button / Indicator */}
          <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
            {current.isPinned && (
              <button
                type="button"
                onClick={() => togglePin(current.id, true)}
                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                title={canEdit ? "Click to unpin" : "Pinned Notice"}
              >
                <Pin size={16} className="fill-blue-500/30 rotate-45" />
              </button>
            )}
          </div>

          <div className="pr-7">
            <h4 className="font-bold text-sm text-slate-800 leading-snug">
              {current.title}
            </h4>
          </div>

          {/* Metadata row */}
          {(current.eventDate || current.venue) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
              {current.eventDate && (
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <Calendar size={13} className="text-blue-500 shrink-0" />
                  <span>
                    {current.eventDate}
                    {current.eventTime ? ` • ${current.eventTime}` : ""}
                  </span>
                </div>
              )}
              {current.venue && (
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <MapPin size={13} className="text-blue-500 shrink-0" />
                  <span>{current.venue}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            {current.content}
          </p>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No announcements published.
        </div>
      )}

      {/* Carousel Pagination & Arrows */}
      {announcements.length > 1 && (
        <div className="flex items-center justify-between mt-3.5 pt-1">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Previous announcement"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5">
            {announcements.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-5 bg-blue-600"
                    : "w-1.5 bg-slate-200 hover:bg-slate-300"
                }`}
                aria-label={`Go to announcement ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Next announcement"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* View All Announcements Modal */}
      {showViewAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Megaphone size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    BAC Announcements
                  </h3>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Official notices, meetings, and directives
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewAllModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-3.5">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col gap-2 relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {ann.isPinned && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 flex items-center gap-1">
                          <Pin size={10} className="rotate-45" /> Pinned
                        </span>
                      )}
                      {ann.priority === "HIGH" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Priority
                        </span>
                      )}
                      {ann.priority === "URGENT" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Urgent
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-medium">
                        Audience: {ann.targetAudience.replace("_", " ")}
                      </span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePin(ann.id, ann.isPinned)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title={ann.isPinned ? "Unpin notice" : "Pin notice"}
                        >
                          <Pin size={13} className={ann.isPinned ? "fill-blue-500" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(ann.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Archive notice"
                        >
                          <Archive size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 leading-snug">
                    {ann.title}
                  </h4>

                  {(ann.eventDate || ann.venue) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {ann.eventDate && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar size={12} className="text-blue-500" />
                          <span>
                            {ann.eventDate}
                            {ann.eventTime ? ` • ${ann.eventTime}` : ""}
                          </span>
                        </div>
                      )}
                      {ann.venue && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <MapPin size={12} className="text-blue-500" />
                          <span>{ann.venue}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ann.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowViewAllModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish New Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Megaphone size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  Publish Announcement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  Notice Title *
                </label>
                <input
                  required
                  type="text"
                  className="form-input text-xs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., BAC Meeting – November 27, 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    Date (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="e.g. Nov 27, 2026"
                  />
                </div>
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    Time (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    placeholder="e.g. 9:00 AM"
                  />
                </div>
              </div>

              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  Venue (Optional)
                </label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="E.g., BAC Conference Room"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    Target Audience
                  </label>
                  <select
                    className="form-select text-xs"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  >
                    <option value="ALL">All Users</option>
                    <option value="BAC_MEMBERS">BAC Members Only</option>
                    <option value="END_USERS">End-User Departments</option>
                    <option value="SECRETARIAT">Secretariat</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                    Priority
                  </label>
                  <select
                    className="form-select text-xs"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
                  Notice Body / Details *
                </label>
                <textarea
                  required
                  className="form-input text-xs h-20 resize-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Regular BAC Meeting for the opening and evaluation of bids..."
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
                <input
                  id="pinNotice"
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="pinNotice"
                  className="text-xs font-bold text-blue-800 cursor-pointer"
                >
                  Pin this notice to top of dashboard
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
