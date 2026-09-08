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

interface DashboardClientProps {
  data: {
    stats: {
      prPending: number;
      rfqActive: number;
      poForSig: number;
      poReleased: number;
      prDraft: number;
      prForRfq: number;
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
    fundSources: { name: string; total: number; used: number; available: number }[];
  };
  user: { name?: string; role?: string };
}

const statCards = (stats: DashboardClientProps["data"]["stats"]) => [
  {
    label: "PRs Awaiting Action",
    value: stats.prPending,
    icon: ShoppingCart,
    color: "#2563eb",
    bg: "#eff6ff",
    subtext: `${stats.prDraft} draft • ${stats.prPending} submitted/approved`,
    href: "/dashboard/purchase-requests",
  },
  {
    label: "Active RFQs",
    value: stats.rfqActive,
    icon: FileText,
    color: "#0891b2",
    bg: "#ecfeff",
    subtext: "Awaiting supplier quotations",
    href: "/dashboard/rfqs",
  },
  {
    label: "POs for Signature",
    value: stats.poForSig,
    icon: Package,
    color: "#d97706",
    bg: "#fffbeb",
    subtext: "Pending release to suppliers",
    href: "/dashboard/purchase-orders",
  },
  {
    label: "PRs Ready for RFQ",
    value: stats.prForRfq,
    icon: ClipboardList,
    color: "#059669",
    bg: "#f0fdf4",
    subtext: "Approved, awaiting canvass",
    href: "/dashboard/purchase-requests",
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
      {/* Greeting */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
          {greeting()}, {user.name?.split(" ")[0] ?? "User"} 👋
        </h2>
        <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.9375rem" }}>
          Here's an overview of procurement activities for FY 2026
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/dashboard/purchase-requests/new" className="btn btn-primary">
          <Plus size={16} /> New Purchase Request
        </Link>
        <Link href="/dashboard/purchase-requests" className="btn btn-secondary">
          <Clock size={16} /> View All PRs
        </Link>
        <Link href="/dashboard/suppliers" className="btn btn-secondary">
          <BarChart2 size={16} /> Manage Suppliers
        </Link>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} style={{ textDecoration: "none" }}>
              <div className="stat-card" style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "10px",
                    background: card.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} color={card.color} />
                  </div>
                  <ArrowRight size={14} color="#cbd5e1" />
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "800", color: "#0f172a", lineHeight: "1", marginBottom: "0.25rem" }}>
                  {card.value}
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
                  {card.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {card.subtext}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1rem", marginBottom: "1rem" }}>
        {/* Monthly Volume Chart */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Monthly Procurement Volume
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.125rem 0 0" }}>FY 2026 — Purchase Requests</p>
            </div>
            <TrendingUp size={18} color="#2563eb" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthlyChart} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.8125rem" }}
                formatter={(value: any) => [formatCurrency(value), "Amount"]}
              />
              <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} fill="url(#colorAmount)" dot={{ fill: "#2563eb", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fund Source Utilization */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Budget Utilization
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.125rem 0 0" }}>By fund source</p>
            </div>
            <Wallet size={18} color="#059669" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {data.fundSources.map((fs, i) => {
              const pct = fs.total > 0 ? (fs.used / fs.total) * 100 : 0;
              const color = CHART_COLORS[i % CHART_COLORS.length];
              return (
                <div key={fs.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#374151", maxWidth: "65%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fs.name.replace("General Fund - ", "").replace(" - ", " ")}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(pct, 100)}%`,
                      background: color,
                      borderRadius: "3px",
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>Used: {formatCurrency(fs.used)}</span>
                    <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>Budget: {formatCurrency(fs.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent PRs */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
            Recent Purchase Requests
          </h3>
          <Link href="/dashboard/purchase-requests" style={{
            fontSize: "0.8125rem", color: "#2563eb", fontWeight: "500",
            display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none",
          }}>
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {data.recentPRs.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart className="empty-state-icon" />
            <p style={{ fontWeight: "600" }}>No purchase requests yet</p>
            <Link href="/dashboard/purchase-requests/new" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }}>
              <Plus size={14} /> Create First PR
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>PR Number</th>
                  <th>Office</th>
                  <th>Purpose</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link href={`/dashboard/purchase-requests/${pr.id}`} style={{ color: "#2563eb", fontWeight: "600", textDecoration: "none", fontSize: "0.875rem" }}>
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
                      <span className={`badge ${PR_STATUS_COLORS[pr.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {PR_STATUS_LABELS[pr.status] ?? pr.status}
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
