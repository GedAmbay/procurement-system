"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { FileText, Send, Clock, CheckCircle2, PackageSearch } from "lucide-react";

interface RFQ {
  id: string;
  rfqNumber: string;
  pr: {
    purpose: string;
    totalAmount: number;
    office: { name: string; code: string };
  };
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "currentColor" }} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <Send size={11} /> },
  WAITING_FOR_SUPPLIER: { bg: "#fef9c3", color: "#854d0e", icon: <Clock size={11} /> },
  COMPLETED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

export default function RFQPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "rfqNumber",
      label: "Quotation Number",
      render: (row: RFQ) => (
        <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.rfqNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "office",
      label: "Requesting Office",
      render: (row: RFQ) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.pr.office.name}
        </div>
      ),
      width: "250px",
    },
    {
      key: "purpose",
      label: "Purpose",
      align: "center",
      render: (row: RFQ) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "500px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textAlign: "center", width: "100%", margin: "0 auto"
        }}>
          {row.pr.purpose}
        </div>
      ),
    },
    {
      key: "abc",
      label: "Approved Budget",
      align: "center",
      render: (row: RFQ) => (
        <div style={{ fontWeight: "700", color: "#059669" }}>
          {formatCurrency(row.pr.totalAmount)}
        </div>
      ),
      width: "160px",
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (row: RFQ) => {
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
      render: (row: RFQ) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "120px",
    }
  ];

  const handleEdit = (row: RFQ) => {
    router.push(`/rfqs/${row.id}`);
  };

  const handleDuplicate = (row: RFQ) => {
    router.push(`/rfqs/new?duplicateFrom=${row.id}`);
  };

  const handleDelete = async (row: RFQ) => {
    if (!confirm("Are you sure you want to delete this RFQ?")) return;
    try {
      const res = await fetch(`/api/rfqs/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRefreshKey(k => k + 1);
    } catch {
      alert("Failed to delete RFQ");
    }
  };

  return (
    <div>
      <DataTable<RFQ>
        key={refreshKey}
        title="Request for Quotations"
        description="Manage generated RFQs and Supplier Distributions"
        apiPath="/api/rfqs"
        columns={columns}
        searchPlaceholder="Search by Quotation Number..."
        onView={(row) => router.push(`/rfqs/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        emptyIcon={<PackageSearch size={40} style={{ opacity: 0.3 }} />}
        emptyText="No RFQs generated yet. Approve a PR first."
      />
    </div>
  );
}
