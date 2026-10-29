"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { FileText, Truck, Clock, CheckCircle2, FileSignature } from "lucide-react";

interface PO {
  id: string;
  poNumber?: string | null;
  orderType?: string;
  pr?: { prNumber?: string | null; purpose: string; office: { name: string; code: string }; isDirectAcquisition: boolean; requestType?: string };
  abstract?: {
    rfq: {
      pr: { prNumber?: string | null; purpose: string; office: { name: string; code: string }; isDirectAcquisition: boolean; requestType?: string };
      quotations?: { supplier?: { name: string }; totalAmount: number }[];
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
      label: "PO / JO Number",
      render: (row: PO) => {
        const isDirect = row.pr?.isDirectAcquisition || row.abstract?.rfq?.pr?.isDirectAcquisition;
        const isJob = row.orderType === "JOB" || row.pr?.requestType === "JOB" || row.abstract?.rfq?.pr?.requestType === "JOB";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
              {row.poNumber || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>No. not yet assigned</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {isJob && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 w-max">
                  Job Order
                </span>
              )}
              {isDirect && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium bg-teal-100 text-teal-800 border border-teal-200 w-max">
                  Direct
                </span>
              )}
            </div>
          </div>
        );
      },
      width: "160px",
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (row: PO) => {
        let supplierName = row.supplier?.name;
        if (!supplierName) {
          const quotes = row.abstract?.rfq?.quotations?.filter((q: any) => (q.totalAmount || 0) > 0) || [];
          if (quotes.length > 0) {
            const lowest = quotes.reduce((prev: any, curr: any) => (prev.totalAmount < curr.totalAmount ? prev : curr));
            supplierName = lowest?.supplier?.name;
          }
        }
        return (
          <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
            {supplierName ? supplierName : <span className="text-amber-600 italic text-xs">Pending Award</span>}
          </div>
        );
      },
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
          {row.pr?.purpose || row.abstract?.rfq?.pr?.purpose || "N/A"}
        </div>
      ),
    },
    {
      key: "totalAmount",
      label: "Amount",
      sortable: true,
      render: (row: PO) => {
        let amount = row.totalAmount;
        if ((!amount || amount === 0) && row.abstract?.rfq?.quotations) {
          const quotes = row.abstract.rfq.quotations.filter((q: any) => (q.totalAmount || 0) > 0);
          if (quotes.length > 0) {
            const lowest = quotes.reduce((prev: any, curr: any) => (prev.totalAmount < curr.totalAmount ? prev : curr));
            if (lowest?.totalAmount > 0) amount = lowest.totalAmount;
          }
        }
        return (
          <div style={{ fontWeight: "700", color: "#059669" }}>
            {formatCurrency(amount)}
          </div>
        );
      },
      width: "130px",
    },
    {
      key: "status",
      label: "Status",
      align: "center",
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
      align: "center",
      sortable: true,
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
        onRowDoubleClick={handleEdit}
        onDelete={handleDelete}
        emptyIcon={<Truck size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Purchase Orders found."
        filterKey="status"
        filterTabs={[
          { label: "All", value: null },
          { label: "Draft", value: "DRAFT" },
          { label: "Issued", value: "ISSUED" },
          { label: "Partially Delivered", value: "PARTIALLY_DELIVERED" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Cancelled", value: "CANCELLED" },
        ]}
        dateFilterKey="createdAt"
        customFilters={[
          { label: "Direct Acquisition", filterFn: (row: PO) => !!row.pr?.isDirectAcquisition || !!row.abstract?.rfq?.pr?.isDirectAcquisition, colorClass: "bg-teal-100 text-teal-800" }
        ]}
      />
    </div>
  );
}
