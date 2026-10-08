"use client";

import Link from "next/link";
import {
  ShoppingCart, FileText, Package, ClipboardList,
  TrendingUp, Plus, Clock, ArrowRight, Wallet,
  CheckCircle2, AlertCircle, BarChart2
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import { formatCurrency, PR_STATUS_COLORS, PR_STATUS_LABELS } from "@/lib/utils";
import CalendarWidget from "./calendar-widget";

interface DashboardClientProps {
  data: {
    kpis: {
      totalSavings: number;
      avgProcessingDays: number;
      nextAwardEvent: { eventDate: Date, title: string, pr: { prNumber: string } | null } | null;
    };
    pipeline: {
      logged: number;
      forRfq: number;
      forAoq: number;
      forPo: number;
      issued: number;
    };
    stats: {
      totalPrs: number;
      rfqForSigning: number;
      aoqForSigning: number;
      poForSigning: number;
      overdueDeliveries: number;
    };
    recentPRs: {
      id: string;
      prNumber: string;
      office: string;
      purpose: string;
      totalAmount: number;
      status: string;
      createdAt: string;
    }[];
    monthlyChart: { month: string; count: number; amount: number }[];
  };
  user: { name?: string; role?: string };
}

const statCards = (stats: DashboardClientProps["data"]["stats"]) => [
  {
    label: "Total PRs Encoded",
    value: stats.totalPrs,
    icon: ShoppingCart,
    color: "#64748b",
    bg: "#eff6ff",
    subtext: "Purchase Requests logged in the system",
    href: "/purchase-requests",
  },
  {
    label: "RFQs For Signing",
    value: stats.rfqForSigning,
    icon: FileText,
    color: "#64748b",
    bg: "#ecfeff",
    subtext: "Routing for physical signatures",
    href: "/rfqs",
  },
  {
    label: "AOQs For Signing",
    value: stats.aoqForSigning,
    icon: ClipboardList,
    color: "#64748b",
    bg: "#f0fdf4",
    subtext: "Routing for physical signatures",
    href: "/abstract",
  },
  {
    label: "POs For Signing",
    value: stats.poForSigning,
    icon: Package,
    color: "#64748b",
    bg: "#fffbeb",
    subtext: "Routing for physical signatures",
    href: "/purchase-orders",
  },
];

const CHART_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#7c3aed"];

export default function DashboardClient({ data, user }: DashboardClientProps) {
  const cards = statCards(data.stats);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      {/* Greeting & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
            {greeting()}, {user.name?.split(" ")[0] ?? "User"} 👋
          </h2>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.9375rem" }}>
            Procurement overview - FY 2026
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <Link href="/purchase-requests/new" className="btn btn-primary text-sm font-semibold">
            <Plus size={16} /> New Purchase Request
          </Link>
          <Link href="/suppliers" className="btn btn-secondary text-sm font-semibold">
            Manage Suppliers
          </Link>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="card flex flex-col justify-between py-4 px-5">
          <div className="text-sm font-semibold text-slate-500">Total PRs</div>
          <div className="text-3xl font-black text-slate-800 my-1">{data.stats.totalPrs}</div>
          <div className="text-xs font-semibold text-green-600 flex items-center gap-1">
            <TrendingUp size={12} /> 1 Direct Acquisition
          </div>
        </div>

        <div className="card flex flex-col justify-between py-4 px-5">
          <div className="text-sm font-semibold text-slate-500">Needs Signature</div>
          <div className="text-3xl font-black text-slate-800 my-1">
            {data.stats.rfqForSigning + data.stats.aoqForSigning + data.stats.poForSigning}
          </div>
          <div className="text-xs font-medium text-slate-500">
            RFQ - AOQ - PO (excl. Direct)
          </div>
        </div>

        <div className="card flex flex-col justify-between py-4 px-5">
          <div className="text-sm font-semibold text-slate-500">Savings (ABC vs Award)</div>
          <div className="text-3xl font-black text-slate-800 my-1">{formatCurrency(data.kpis.totalSavings).replace('.00', '')}</div>
          <div className="text-xs font-semibold text-green-600 flex items-center gap-1">
            <TrendingUp size={12} className="rotate-180" /> 4.1% below ABC
          </div>
        </div>

        <div className="card flex flex-col justify-between py-4 px-5">
          <div className="text-sm font-semibold text-slate-500">Next Award Date</div>
          <div className="text-3xl font-black text-slate-800 my-1">
            {data.kpis.nextAwardEvent ? new Date(data.kpis.nextAwardEvent.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
          </div>
          <div className="text-xs font-medium text-slate-500">
            {data.kpis.nextAwardEvent ? `Award - ${data.kpis.nextAwardEvent.pr?.prNumber || 'N/A'}` : "No upcoming awards"}
          </div>
        </div>
      </div>

      {/* Row 2: Pipeline Strip */}
      <div className="card mb-6 py-4 px-5">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
            Procurement pipeline
          </h3>
          <span className="text-xs text-slate-500 font-medium">Direct Acquisition skips RFQ → AOQ</span>
        </div>
        <div className="flex items-center justify-between text-center">
          {[
            { label: "PR Logged", count: data.pipeline.logged },
            { label: "RFQ", count: data.pipeline.forRfq },
            { label: "Abstract", count: 0 },
            { label: "AOQ / Award", count: data.pipeline.forAoq },
            { label: "PO", count: data.pipeline.forPo },
            { label: "Acceptance", count: 0 },
            { label: "Issued", count: data.pipeline.issued },
          ].map((step, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div className="text-2xl font-black text-slate-800 mb-1">{step.count}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{step.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar & Action Required Rows */}
      <CalendarWidget actionRequiredNode={
        <div className="card flex flex-col h-full border border-slate-100 shadow-sm bg-slate-800/5 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

          <h3 className="text-[0.9375rem] font-bold text-slate-800 mb-4 z-10 flex items-center gap-2">
            Action required
          </h3>
          <div className="flex flex-col gap-3 z-10">
            {data.stats.rfqForSigning > 0 && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-bold text-slate-800">Sign RFQs</div>
                  <div className="text-[10px] text-slate-500">Awaiting signature</div>
                </div>
                <Link href="/rfqs" className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full hover:bg-blue-600 transition-colors shadow-sm">
                  Open
                </Link>
              </div>
            )}
            {data.stats.aoqForSigning > 0 && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-bold text-slate-800">Sign AOQs</div>
                  <div className="text-[10px] text-slate-500">Awaiting signature</div>
                </div>
                <Link href="/abstract" className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full hover:bg-indigo-600 transition-colors shadow-sm">
                  Open
                </Link>
              </div>
            )}
            {data.stats.poForSigning > 0 && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    Sign POs <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[9px] uppercase font-bold tracking-wider">Direct</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Ready for PO signing</div>
                </div>
                <Link href="/purchase-orders" className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full hover:bg-blue-600 transition-colors shadow-sm">
                  Open
                </Link>
              </div>
            )}
            {data.stats.overdueDeliveries > 0 && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-bold text-slate-800">Overdue Deliveries</div>
                  <div className="text-[10px] text-slate-500">Delivery overdue</div>
                </div>
                <Link href="/purchase-orders" className="px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-700 transition-colors shadow-sm">
                  View
                </Link>
              </div>
            )}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-200/50">
              <div>
                <div className="text-sm font-bold text-slate-800">Avg. PR → PO time</div>
                <div className="text-[10px] text-slate-500">Last 30 days</div>
              </div>
              <div className="text-sm font-black text-slate-800">{data.kpis.avgProcessingDays} days</div>
            </div>
          </div>
        </div>
      } />

      {/* Recent PRs */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
            Recent purchase requests
          </h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">All</button>
            <button className="px-3 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold rounded-full transition-colors">Direct Acquisition</button>
          </div>
        </div>

        {data.recentPRs.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart className="empty-state-icon" />
            <p style={{ fontWeight: "600" }}>No purchase requests yet</p>
            <Link href="/purchase-requests/new" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }}>
              <Plus size={14} /> Create First PR
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto bg-slate-50/50 rounded-xl p-4 border border-slate-100 shadow-inner">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>PR Number</th>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>Office</th>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>Purpose</th>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>Amount</th>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>Status</th>
                  <th style={{ fontFamily: "inherit", fontWeight: "700", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", color: "#64748b" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link href={`/procurement-folders/${pr.id}`} style={{ color: "#2563eb", fontWeight: "600", textDecoration: "none", fontSize: "0.875rem" }}>
                        {pr.prNumber}
                      </Link>
                    </td>
                    <td style={{ color: "#374151", fontSize: "0.875rem" }}>{pr.office}</td>
                    <td style={{ maxWidth: "280px" }}>
                      <span style={{ fontSize: "0.875rem", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {pr.purpose}
                      </span>
                    </td>
                    <td style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.875rem" }}>
                      {formatCurrency(pr.totalAmount)}
                    </td>
                    <td>
                      <span className="badge" style={{ background: "#f8fafc", color: "#64748b" }}>
                        Logged
                      </span>
                    </td>
                    <td style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>
                      {new Date(pr.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
