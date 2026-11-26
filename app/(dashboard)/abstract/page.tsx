"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DataTable from "@/components/ui/data-table";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { Send, Clock, CheckCircle2, ClipboardList, XCircle, ExternalLink, User } from "lucide-react";

interface abstract {
  id: string;
  abstractNumber: string;
  rfq: {
    pr: {
      prNumber: string;
      purpose: string;
      totalAmount: number;
      office: { name: string; code: string };
    };
    quotations?: {
      totalAmount: number;
      supplier: { name: string };
    }[];
  };
  purchaseOrders?: {
    supplier: { name: string };
  }[];
  status: string;
  lastModifiedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "currentColor" }} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <Send size={11} /> },
  SIGNED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
  COMPLETED: { bg: "#dcfce7", color: "#15803d", icon: <CheckCircle2 size={11} /> },
};

export default function abstractPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "prNumber",
      label: "PR Number",
      render: (row: abstract) => (
        <Link
          href={`/abstract/${row.id}`}
          className="inline-flex items-center gap-1.5 font-bold font-mono text-sm text-blue-600 hover:text-blue-700 hover:underline group"
        >
          <span>{row.rfq?.pr?.prNumber || row.abstractNumber || "Draft (No Number)"}</span>
          <ExternalLink size={13} className="text-blue-500 opacity-70 group-hover:opacity-100" />
        </Link>
      ),
      width: "160px",
    },
    {
      key: "office",
      label: "Requesting Office",
      render: (row: abstract) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.rfq.pr.office.name}
        </div>
      ),
      width: "250px",
    },
    {
      key: "purpose",
      label: "Purpose",
      align: "left",
      render: (row: abstract) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "600px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textAlign: "left"
        }}>
          {row.rfq.pr.purpose}
        </div>
      ),
    },
    {
      key: "awardedSupplier",
      label: "Awarded Supplier",
      align: "left",
      render: (row: abstract) => {
        const winningSupplier =
          row.purchaseOrders?.[0]?.supplier?.name ||
          (row.rfq?.quotations?.filter((q: any) => q.totalAmount > 0).length
            ? row.rfq.quotations
              .filter((q: any) => q.totalAmount > 0)
              .reduce((min: any, q: any) => (q.totalAmount < min.totalAmount ? q : min))?.supplier?.name
            : null);

        return (
          <div style={{ fontWeight: winningSupplier ? "600" : "600", color: winningSupplier ? "#0f172a" : "#D97706", fontSize: "0.875rem", fontStyle: winningSupplier ? "normal" : "italic" }}>
            {winningSupplier || "Pending Award"}
          </div>
        );
      },
      width: "200px",
    },
    {
      key: "status",
      label: "Status",
      align: "left",
      render: (row: abstract) => <StatusBadge status={row.status} />,
      width: "140px",
    },
    {
      key: "lastModifiedBy",
      label: "Modified By",
      align: "left",
      render: (row: abstract) => (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <User size={13} className="text-slate-400 shrink-0" />
          <span>{row.lastModifiedBy || "—"}</span>
        </div>
      ),
      width: "160px",
    },
    {
      key: "updatedAt",
      label: "Date Modified",
      align: "left",
      sortable: true,
      render: (row: abstract) => (
        <span className="text-slate-600 text-xs whitespace-nowrap">
          {new Date(row.updatedAt || row.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
      width: "130px",
    }
  ];

  const handleEdit = (row: abstract) => {
    router.push(`/abstract/${row.id}`);
  };

  const handleDuplicate = (row: abstract) => {
    router.push(`/abstract/new?duplicateFrom=${row.id}`);
  };

  const handleDelete = async (row: abstract) => {
    const res = await fetch(`/api/abstract/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete abstract");
    }
  };

  return (
    <div>
      <DataTable<abstract>
        key={refreshKey}
        title="Abstract of Canvass"
        description="Consolidate supplier bids and recommend the lowest calculated responsive quotation."
        apiPath="/api/abstract"
        columns={columns}
        searchPlaceholder="Search..."
        onView={(row) => router.push(`/abstract/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onRowDoubleClick={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        emptyIcon={<ClipboardList size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Abstracts of Canvass generated yet."
        filterKey="status"
        filterTabs={[
          { label: "All", value: null },
          { label: "Draft", value: "DRAFT" },
          { label: "Issued", value: "ISSUED" },
          { label: "Completed", value: "COMPLETED" },
        ]}
        dateFilterKey="updatedAt"
        departmentFilterKey={(row) => row.rfq?.pr?.office?.name || ""}
      />
    </div>
  );
}
