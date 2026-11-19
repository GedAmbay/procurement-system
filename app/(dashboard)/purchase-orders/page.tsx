"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DataTable from "@/components/ui/data-table";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { FileText, Truck, Clock, CheckCircle2, FileSignature, ExternalLink, User } from "lucide-react";

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
  lastModifiedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <Clock size={11} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <FileSignature size={11} /> },
  SIGNED: { bg: "#eef2ff", color: "#4f46e5", icon: <CheckCircle2 size={11} /> },
  PARTIALLY_DELIVERED: { bg: "#eff6ff", color: "#2563eb", icon: <Truck size={11} /> },
  COMPLETED: { bg: "#dcfce7", color: "#15803d", icon: <CheckCircle2 size={11} /> },
  CANCELLED: { bg: "#fef2f2", color: "#dc2626", icon: <Clock size={11} /> },
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
            <Link
              href={`/purchase-orders/${row.id}`}
              className="inline-flex items-center gap-1.5 font-bold font-mono text-sm text-blue-600 hover:text-blue-700 hover:underline group"
            >
              <span>{row.poNumber || "Draft (No Number)"}</span>
              <ExternalLink size={13} className="text-blue-500 opacity-70 group-hover:opacity-100" />
            </Link>
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
      align: "right",
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
          <div className="font-bold text-[#059669] font-mono text-sm text-right">
            {formatCurrency(amount)}
          </div>
        );
      },
      width: "140px",
    },
    {
      key: "status",
      label: "Status",
      align: "left",
      render: (row: PO) => <StatusBadge status={row.status} />,
      width: "140px",
    },
    {
      key: "lastModifiedBy",
      label: "Modified By",
      align: "left",
      render: (row: PO) => (
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
      render: (row: PO) => (
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
          { label: "Signed", value: "SIGNED" },
          { label: "Partially Delivered", value: "PARTIALLY_DELIVERED" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Cancelled", value: "CANCELLED" },
        ]}
        dateFilterKey="updatedAt"
        departmentFilterKey={(row) => row.pr?.office?.name || row.abstract?.rfq?.pr?.office?.name || ""}
        customFilters={[
          { label: "Direct Acquisition", filterFn: (row: PO) => !!row.pr?.isDirectAcquisition || !!row.abstract?.rfq?.pr?.isDirectAcquisition, colorClass: "bg-teal-100 text-teal-800" }
        ]}
      />
    </div>
  );
}
