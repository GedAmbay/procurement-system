"use client";

import Link from "next/link";
import {
  FileText,
  PenLine,
  Coins,
  Clock,
  Users,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import CalendarWidget from "./calendar-widget";
import AnnouncementsPanel from "./announcements-panel";

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
  user: { name?: string; nickname?: string | null; role?: string };
}

export default function DashboardClient({ data, user }: DashboardClientProps) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const getGreetingName = () => {
    if (user.nickname?.trim()) {
      return user.nickname.trim();
    }
    if (!user.name) {
      if (user.role === "BAC_SECRETARIAT") return "BAC Secretariat";
      if (user.role === "ADMIN") return "Administrator";
      if (user.role === "END_USER") return "Clerk";
      return "User";
    }
    const clean = user.name.trim();
    if (clean === "BAC" || clean.toLowerCase() === "bac secretariat") {
      return "BAC Secretariat";
    }
    return clean;
  };

  const displayName = getGreetingName();
  const needsSignatureCount = data.stats.rfqForSigning + data.stats.abstractForSigning + data.stats.poForSigning;

  const pipelineSteps = [
    {
      step: "01",
      label: "PR Logged",
      count: data.pipeline.logged,
      href: "/purchase-requests",
      desc: "Requisitions initiated",
    },
    {
      step: "02",
      label: "RFQ Canvass",
      count: data.pipeline.rfq,
      href: "/rfqs",
      desc: "Price quotations sent",
    },
    {
      step: "03",
      label: "Abstract",
      count: data.pipeline.abstract,
      href: "/abstract",
      desc: "Bids tabulated",
    },
    {
      step: "04",
      label: "Award Evaluation",
      count: data.pipeline.abstractAward,
      href: "/abstract",
      desc: "LCRB / BAC resolution",
    },
    {
      step: "05",
      label: "Purchase Order",
      count: data.pipeline.po,
      href: "/purchase-orders",
      desc: "PO issued to supplier",
    },
    {
      step: "06",
      label: "Inspection",
      count: data.pipeline.acceptance,
      href: "/acceptances",
      desc: "Goods received & verified",
    },
    {
      step: "07",
      label: "Disbursed",
      count: data.pipeline.issued,
      href: "/acceptances",
      desc: "Final issuance & archived",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Greeting & Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pb-1">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 tracking-tight leading-tight">
            {greeting()}, <span className="text-blue-700">{displayName}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-500 text-sm mt-1.5 font-medium">
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-slate-500">Municipality of Pandan Procurement Portal</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/purchase-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold shadow-xs hover:shadow-md transition-all duration-150"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Purchase Request</span>
          </Link>
          <Link
            href="/suppliers"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 border border-slate-200 text-sm font-semibold shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all duration-150"
          >
            <Users size={16} className="text-slate-500" />
            <span>Manage Suppliers</span>
          </Link>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total PRs */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-38 group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
                Total Purchase Requests
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {data.stats.totalPrs}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50/80 border border-blue-100/90 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={19} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <TrendingUp size={14} className="stroke-[2.5]" />
            <span>
              {data.stats.thisMonthPrs > 0
                ? `${data.stats.thisMonthPrs} logged this month`
                : "Active fiscal period"}
            </span>
          </div>
        </div>

        {/* Card 2: Needs Signature */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-38 group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
                Pending Signatures
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {needsSignatureCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50/80 border border-amber-100/90 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PenLine size={19} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                needsSignatureCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
            <span className={needsSignatureCount > 0 ? "text-amber-800 font-semibold" : "text-slate-500"}>
              {needsSignatureCount > 0 ? "PR, Abstract, or PO pending" : "All documents signed"}
            </span>
          </div>
        </div>

        {/* Card 3: Savings (ABC vs Award) */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-38 group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
                Procurement Savings
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {formatCurrency(data.kpis.totalSavings).replace(".00", "")}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50/80 border border-emerald-100/90 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Coins size={19} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <TrendingDown size={14} className="stroke-[2.5]" />
            <span>4.1% below approved budget (ABC)</span>
          </div>
        </div>

        {/* Card 4: Avg. Processing Time */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-38 group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
                Avg. Processing Time
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {data.kpis.avgProcessingDays > 0 ? (
                  <>
                    {data.kpis.avgProcessingDays}{" "}
                    <span className="text-lg font-bold text-slate-500">
                      {data.kpis.avgProcessingDays === 1 ? "Day" : "Days"}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-800">
                    &lt; 1 Day
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50/80 border border-indigo-100/90 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock size={19} className="stroke-[2.25]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>PR to PO turnaround • RA 9184</span>
          </div>
        </div>
      </div>

      {/* Row 2: Procurement Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 tracking-tight uppercase">
              Procurement Workflow Pipeline
            </h3>
            <span className="text-xs text-slate-400 hidden sm:inline">•</span>
            <span className="text-xs text-slate-500 hidden sm:inline font-normal">
              Sequential stage progression from requisition to final issuance
            </span>
          </div>
          <span className="inline-flex items-center text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60 self-start sm:self-auto">
            7 Active Stages
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {pipelineSteps.map((step, idx) => (
            <Link
              key={idx}
              href={step.href}
              className="group relative flex flex-col justify-between p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all duration-150 text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                  {step.step}
                </span>
                {step.count > 0 ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                  {step.count}
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-1 leading-snug line-clamp-1 group-hover:text-slate-900">
                  {step.label}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-normal line-clamp-1">
                {step.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Row 3: Main Section (Calendar ~65% + Right Column ~35%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Monthly Calendar (~65% width) */}
        <div className="xl:col-span-8 w-full">
          <CalendarWidget />
        </div>

        {/* Right Column: Announcements (~35% width) */}
        <div className="xl:col-span-4 w-full flex flex-col gap-6">
          <AnnouncementsPanel />
        </div>
      </div>
    </div>
  );
}
