"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { FileText, Truck, Clock, CheckCircle2, FileSignature } from "lucide-react";

interface PO {
  id: string;
  poNumber: string;
  aoq?: {
    rfq: {
      pr: { purpose: string; office: { name: string; code: string } }
    }
  };
  supplier?: { name: string };
  totalAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569", icon: <Clock size={11} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <FileSignature size={11} /> },
  COMPLETED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "poNumber",
      label: "PO Number",
      render: (row: PO) => (
        <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.poNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (row: PO) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.supplier ? row.supplier.name : <span className="text-amber-600 italic text-xs">Pending Award</span>}
        </div>
      ),
      width: "250px",
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (row: PO) => (
        <div style={{
          fontSize: "0.875rem", color: "#334155",
          maxWidth: "600px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>
          {row.aoq?.rfq?.pr?.purpose || "N/A"}
        </div>
      ),
    },
    {
      key: "totalAmount",
      label: "Amount",
      render: (row: PO) => (
        <div style={{ fontWeight: "700", color: "#059669" }}>
          {formatCurrency(row.totalAmount)}
        </div>
      ),
      width: "130px",
    },
    {
      key: "status",
      label: "Status",
      render: (row: PO) => {
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
      render: (row: PO) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "100px",
    }
  ];

  const handleEdit = (row: PO) => {
    router.push(`/purchase-orders/${row.id}`);
  };

  const handleDelete = async (row: PO) => {
    if (!confirm("Are you sure you want to delete this Purchase Order?")) return;
    try {
      const res = await fetch(`/api/purchase-orders/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRefreshKey(k => k + 1);
    } catch {
      alert("Failed to delete Purchase Order");
    }
  };

  return (
    <div>
      <DataTable<PO>
        key={refreshKey}
        title="Purchase Orders"
        description="Manage official purchase orders and supplier awards"
        apiPath="/api/purchase-orders"
        columns={columns}
        searchPlaceholder="Search..."
        onView={(row) => router.push(`/purchase-orders/${row.id}?mode=view`)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyIcon={<Truck size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Purchase Orders found."
      />
    </div>
  );
}
