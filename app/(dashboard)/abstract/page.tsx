"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Send, Clock, CheckCircle2, ClipboardList, XCircle } from "lucide-react";

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
  createdAt: string;
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
        <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.rfq?.pr?.prNumber || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>No. not yet assigned</span>}
        </div>
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
      align: "center",
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
      align: "center",
      render: (row: abstract) => {
        const conf = STATUS_COLORS[row.status] || STATUS_COLORS.DRAFT;
        return (
          <span className="badge" style={{ background: conf.bg, color: conf.color, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            {conf.icon} {row.status.replace(/_/g, ' ')}
          </span>
        );
      },
      width: "160px",
    },
    {
      key: "createdAt",
      label: "Date",
      align: "center",
      sortable: true,
      render: (row: abstract) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "120px",
    }
  ];

  const handleEdit = (row: abstract) => {
    router.push(`/abstract/${row.id}`);
  };

  const handleDuplicate = (row: abstract) => {
    router.push(`/abstract/new?duplicateFrom=${row.id}`);
  };

  const handleDelete = async (row: abstract) => {
    if (!confirm("Are you sure you want to delete this abstract?")) return;
    try {
      const res = await fetch(`/api/abstract/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRefreshKey(k => k + 1);
    } catch {
      alert("Failed to delete abstract");
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
          { label: "Signed", value: "SIGNED" },
          { label: "Completed", value: "COMPLETED" },
        ]}
        dateFilterKey="createdAt"
      />
    </div>
  );
}
