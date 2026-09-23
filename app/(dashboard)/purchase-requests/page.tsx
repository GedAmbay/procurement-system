"use client";

import { useState } from "react";
import { FileText, Printer, Eye, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency, PR_STATUS_LABELS } from "@/lib/utils";

interface PR {
  id: string;
  prNumber: string;
  purpose: string;
  office: { name: string; code: string };
  requestedBy: { name: string };
  fundSource: { name: string; code: string } | null;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "currentColor" }} /> },
  SUBMITTED: { bg: "#eff6ff", color: "#2563eb", icon: <Send size={11} /> },
  APPROVED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
  REJECTED: { bg: "#fef2f2", color: "#dc2626", icon: <XCircle size={11} /> },
  FOR_RFQ: { bg: "#fff7ed", color: "#c2410c", icon: <FileText size={11} /> },
  CLOSED: { bg: "#f8fafc", color: "#64748b", icon: <CheckCircle2 size={11} /> },
};

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "prNumber",
      label: "PR Number",
      render: (row: PR) => (
        <div style={{ fontWeight: "600", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.prNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "office",
      label: "Requesting Office",
      render: (row: PR) => (
        <div>
          <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>{row.office?.name || row.office?.code || ""}</div>
        </div>
      ),
      width: "250px",
    },
    {
      key: "purpose",
      label: "Purpose",
      align: "left",
      render: (row: PR) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "600px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>
          {row.purpose}
        </div>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      align: "center",
      render: (row: PR) => (
        <div style={{ fontWeight: "700", color: "#059669" }}>
          {formatCurrency(row.totalAmount)}
        </div>
      ),
      width: "140px",
    },

    {
      key: "createdAt",
      label: "Date",
      align: "center",
      render: (row: PR) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "block" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "120px",
    }
  ];

  const handleEdit = (row: PR) => {
    router.push(`/purchase-requests/${row.id}`);
  };

  const handleDuplicate = (row: PR) => {
    router.push(`/purchase-requests/new?duplicateFrom=${row.id}`);
  };

  const handleDelete = async (row: PR) => {
    if (!confirm("Are you sure you want to delete this PR?")) return;
    try {
      const res = await fetch(`/api/purchase-requests/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      // Optional toast.success here if toast is imported, but let's assume it works without or just use window.alert
      setRefreshKey(k => k + 1);
    } catch {
      alert("Failed to delete PR");
    }
  };

  return (
    <div>
      <DataTable<PR>
        key={refreshKey}
        title="Purchase Requests"
        description="Manage departmental purchase requests and routing"
        apiPath="/api/purchase-requests"
        columns={columns}
        searchPlaceholder="Search..."
        onAdd={() => router.push("/purchase-requests/new")}
        onView={(row) => router.push(`/purchase-requests/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        emptyIcon={<FileText size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Purchase Requests found"
      />
    </div>
  );
}
