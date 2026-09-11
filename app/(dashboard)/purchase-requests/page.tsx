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
  DRAFT: { bg: "#f1f5f9", color: "#475569", icon: <Clock size={11} /> },
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
      label: <div style={{ fontSize: "0.9rem" }}>PR Number</div>,
      render: (row: PR) => (
        <div style={{ fontWeight: "600", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem", textAlign: "center" }}>
          {row.prNumber}
        </div>
      ),
      width: "130px",
    },
    {
      key: "office",
      label: <div style={{ fontSize: "0.9rem" }}>Requesting Office</div>,
      render: (row: PR) => (
        <div>
          <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem", textAlign: "center" }}>{row.office?.name || row.office?.code || ""}</div>
        </div>
      ),
      width: "200px",
    },
    {
      key: "purpose",
      label: <div style={{ fontSize: "0.9rem" }}>Purpose</div>,
      render: (row: PR) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "0 auto",
          textAlign: "center"
        }}>
          {row.purpose}
        </div>
      ),
    },
    {
      key: "totalAmount",
      label: <div style={{ fontSize: "0.9rem" }}>Total Amount</div>,
      render: (row: PR) => (
        <div style={{ fontWeight: "700", color: "#059669", textAlign: "center" }}>
          {formatCurrency(row.totalAmount)}
        </div>
      ),
      width: "140px",
    },
    {
      key: "status",
      label: <div style={{ fontSize: "0.9rem" }}>Status</div>,
      render: (row: PR) => {
        const conf = STATUS_COLORS[row.status] || STATUS_COLORS.DRAFT;
        return (
          <span className="badge" style={{ background: conf.bg, color: conf.color, display: "inline-flex", alignItems: "center", gap: "0.25rem", textAlign: "center" }}>
            {conf.icon} {PR_STATUS_LABELS[row.status] || row.status}
          </span>
        );
      },
      width: "120px",
    },
    {
      key: "createdAt",
      label: <div style={{ fontSize: "0.9rem" }}>Date</div>,
      render: (row: PR) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "block", textAlign: "center" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "100px",
    }
  ];

  const handleEdit = (row: PR) => {
    router.push(`/purchase-requests/${row.id}`);
  };

  const handleDuplicate = (row: PR) => {
    router.push(`/purchase-requests/new?duplicateFrom=${row.id}`);
  };

  return (
    <div>
      <DataTable<PR>
        key={refreshKey}
        title="Purchase Requests"
        description="Manage departmental purchase requests and routing"
        apiPath="/api/purchase-requests"
        columns={columns}
        searchPlaceholder="Search by PR number or purpose..."
        onAdd={() => router.push("/purchase-requests/new")}
        onView={(row) => router.push(`/purchase-requests/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        emptyIcon={<FileText size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Purchase Requests found"
      />
    </div>
  );
}
