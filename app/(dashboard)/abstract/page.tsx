"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Send, Clock, CheckCircle2, ClipboardList } from "lucide-react";

interface AOQ {
  id: string;
  aoqNumber: string;
  rfq: {
    pr: {
      purpose: string;
      totalAmount: number;
      office: { name: string; code: string };
    };
  };
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "currentColor" }} /> },
  RECOMMENDED: { bg: "#eff6ff", color: "#2563eb", icon: <Send size={11} /> },
  APPROVED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

export default function AOQPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "aoqNumber",
      label: "AOQ Number",
      render: (row: AOQ) => (
        <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.aoqNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "office",
      label: "Requesting Office",
      render: (row: AOQ) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.rfq.pr.office.name}
        </div>
      ),
      width: "250px",
    },
    {
      key: "purpose",
      label: "Purpose",
      align: "center",
      render: (row: AOQ) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          margin: "0 auto", textAlign: "center"
        }}>
          {row.rfq.pr.purpose}
        </div>
      ),
    },
    {
      key: "abc",
      label: "Approved Budget",
      align: "right",
      render: (row: AOQ) => (
        <div style={{ fontWeight: "700", color: "#059669" }}>
          {formatCurrency(row.rfq.pr.totalAmount)}
        </div>
      ),
      width: "140px",
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (row: AOQ) => {
        const conf = STATUS_COLORS[row.status] || STATUS_COLORS.DRAFT;
        return (
          <span className="badge" style={{ background: conf.bg, color: conf.color, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            {conf.icon} {row.status.replace(/_/g, ' ')}
          </span>
        );
      },
      width: "140px",
    },
    {
      key: "createdAt",
      label: "Date",
      align: "center",
      render: (row: AOQ) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "120px",
    }
  ];

  const handleEdit = (row: AOQ) => {
    router.push(`/abstract/${row.id}`);
  };

  const handleDuplicate = (row: AOQ) => {
    router.push(`/abstract/new?duplicateFrom=${row.id}`);
  };

  const handleDelete = async (row: AOQ) => {
    if (!confirm("Are you sure you want to delete this AOQ?")) return;
    try {
      const res = await fetch(`/api/abstract/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRefreshKey(k => k + 1);
    } catch {
      alert("Failed to delete AOQ");
    }
  };

  return (
    <div>
      <DataTable<AOQ>
        key={refreshKey}
        title="Abstract of Quotation"
        description="Consolidate supplier bids and recommend the lowest calculated responsive quotation."
        apiPath="/api/abstract"
        columns={columns}
        searchPlaceholder="Search by AOQ Number..."
        onView={(row) => router.push(`/abstract/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        emptyIcon={<ClipboardList size={40} style={{ opacity: 0.3 }} />}
        emptyText="No AOQs generated yet. Close an RFQ first."
      />
    </div>
  );
}
