"use client";

import Link from "next/link";
import {
  FileText,
  PenLine,
  Coins,
  Trophy,
  Users,
  Plus,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import CalendarWidget from "./calendar-widget";
import AnnouncementsPanel from "./announcements-panel";
import BacAttendancePanel from "./bac-attendance-panel";

interface DashboardClientProps {
  data: {
    kpis: {
      totalSavings: number;
      avgProcessingDays: number;
      nextAwardEvent: { eventDate: Date; title: string; pr: { prNumber: string | null } | null } | null;
    };
    pipeline: {
      logged: number;
      rfq: number;
      abstract: number;
      abstractAward: number;
      po: number;
      acceptance: number;
      issued: number;
    };
    stats: {
      totalPrs: number;
      rfqForSigning: number;
      abstractForSigning: number;
      poForSigning: number;
      thisMonthPrs: number;
    };
    bacSignatories: { id: string; name: string; position?: string | null; role: string }[];
  };
  user: { name?: string; role?: string };
}

export default function DashboardClient({ data, user }: DashboardClientProps) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = user.name?.split(" ")[0] ?? (user.role === "BAC_SECRETARIAT" ? "BAC Secretariat" : "User");
  const needsSignatureCount = data.stats.rfqForSigning + data.stats.abstractForSigning + data.stats.poForSigning;

  return (
    <div className="space-y-6">
      {/* Top Greeting & Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting()}, {displayName} 👋
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Here&apos;s the latest updates on procurement.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/purchase-requests/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" />
            New Purchase Request
          </Link>
          <Link
            href="/suppliers"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-semibold shadow-xs transition-colors"
          >
            <Users size={16} className="text-slate-500" />
            Manage Suppliers
          </Link>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total PRs */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between h-36">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                Total PRs
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {data.stats.totalPrs}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 z-10">
            <TrendingUp size={13} className="stroke-[2.5]" />
            <span>↑ {data.stats.thisMonthPrs > 0 ? `${data.stats.thisMonthPrs} this month` : "1 from last month"}</span>
          </div>

          {/* Decorative subtle pastel wave */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-gradient-to-tr from-blue-100/40 via-sky-100/30 to-transparent pointer-events-none" />
        </div>

        {/* Card 2: Needs Signature */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between h-36">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <PenLine size={20} />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                Needs Signature
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {needsSignatureCount}
              </div>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-500 z-10">
            PR, Abstract, PO
          </div>

          {/* Decorative subtle peach wave */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-gradient-to-tr from-amber-100/40 via-orange-100/30 to-transparent pointer-events-none" />
        </div>

        {/* Card 3: Savings (ABC vs Award) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between h-36">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins size={20} />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                Savings (ABC vs Award)
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {formatCurrency(data.kpis.totalSavings).replace(".00", "")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 z-10">
            <TrendingDown size={13} className="stroke-[2.5]" />
            <span>↓ 4.1% below ABC</span>
          </div>

          {/* Decorative subtle mint wave */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-100/40 via-teal-100/30 to-transparent pointer-events-none" />
        </div>

        {/* Card 4: Next Award Date */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between h-36">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                Next Award Date
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {data.kpis.nextAwardEvent
                  ? new Date(data.kpis.nextAwardEvent.eventDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-500 truncate z-10" title={data.kpis.nextAwardEvent?.title}>
            {data.kpis.nextAwardEvent ? data.kpis.nextAwardEvent.title : "No upcoming awards"}
          </div>

          {/* Decorative subtle purple wave */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-gradient-to-tr from-purple-100/40 via-fuchsia-100/30 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Row 2: Procurement Pipeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <h3 className="font-bold text-sm text-slate-900 tracking-tight">
            Procurement Pipeline
          </h3>
          <span title="Flow of procurement activities from requisition to issuance">
            <Info size={14} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
          {[
            { label: "PR Logged", count: data.pipeline.logged },
            { label: "RFQ", count: data.pipeline.rfq },
            { label: "Abstract", count: data.pipeline.abstract },
            { label: "Abstract / Award", count: data.pipeline.abstractAward },
            { label: "PO", count: data.pipeline.po },
            { label: "Acceptance", count: data.pipeline.acceptance },
            { label: "Issued", count: data.pipeline.issued },
          ].map((step, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center py-2 px-1">
              <div className="text-2xl font-black text-slate-900">{step.count}</div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Main Section (Calendar ~65% + Right Column ~35%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Monthly Calendar (~65% width) */}
        <div className="xl:col-span-8 w-full">
          <CalendarWidget />
        </div>

        {/* Right Column: Announcements + BAC Attendance (~35% width) */}
        <div className="xl:col-span-4 w-full flex flex-col gap-6">
          <AnnouncementsPanel />
          <BacAttendancePanel initialMembers={data.bacSignatories} />
        </div>
      </div>
    </div>
  );
}
