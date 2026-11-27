"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckSquare, Eye, Printer, Clock, CheckCircle2, User } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import StatusBadge from "@/components/ui/status-badge";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <Clock size={11} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <CheckCircle2 size={11} /> },
  PARTIAL: { bg: "#fffbeb", color: "#b45309", icon: <Clock size={11} /> },
  COMPLETED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

interface Acceptance {
  id: string;
  poId: string;
  airNumber?: string | null;
  AIRNumber?: string | null;
  po: { poNumber: string; supplier: { name: string } };
  status: string;
  lastModifiedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export default function AcceptancesPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [pos, setPos] = useState<any[]>([]);

  const openAddModal = async () => {
    try {
      const res = await fetch("/api/purchase-orders");
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Only show POs that can be delivered against
      setPos(data.filter((po: any) => po.status === "ISSUED" || po.status === "PARTIALLY_DELIVERED"));
      setShowModal(true);
    } catch {
      toast.error("Failed to fetch Purchase Orders");
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch("/api/acceptances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: data.poId, airNumber: data.airNumber })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create acceptance");
      }
      const acc = await res.json();
      toast.success("Acceptance created successfully");
      setShowModal(false);
      router.push(`/acceptances/${acc.id}`);
    } catch (err: any) {
      toast.error(err.message || "Error creating acceptance");
    }
  };

  const columns = [
    {
      key: "airNumber",
      label: "AIR Number",
      width: "20%",
      render: (row: Acceptance) => (
        <Link
          href={`/acceptances/${row.id}`}
          className="inline-flex items-center font-bold font-mono text-sm text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
        >
          <span className="whitespace-nowrap">{row.airNumber || row.AIRNumber || "Draft (No Number)"}</span>
        </Link>
      ),
    },
    {
      key: "poNumber",
      label: "PO Number",
      width: "16%",
      render: (row: Acceptance) => (
        row.po?.poNumber && row.poId ? (
          <Link
            href={`/purchase-orders/${row.poId}`}
            className="inline-flex items-center font-medium font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
          >
            <span className="whitespace-nowrap">{row.po.poNumber}</span>
          </Link>
        ) : (
          <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }} className="whitespace-nowrap">
            {row.po?.poNumber || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>No. not yet assigned</span>}
          </div>
        )
      ),
    },
    {
      key: "supplier",
      label: "Supplier",
      width: "22%",
      align: "left",
      render: (row: Acceptance) => (
        <div style={{ fontSize: "0.875rem", color: "#334155", fontWeight: 500 }}>
          {row.po?.supplier?.name || "N/A"}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      align: "left",
      render: (row: Acceptance) => <StatusBadge status={row.status} />,
    },
    {
      key: "lastModifiedBy",
      label: "Modified By",
      width: "16%",
      align: "left",
      render: (row: Acceptance) => (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <User size={13} className="text-slate-400 shrink-0" />
          <span>{row.lastModifiedBy || "—"}</span>
        </div>
      ),
    },
    {
      key: "updatedAt",
      label: "Date Modified",
      width: "12%",
      align: "left",
      sortable: true,
      render: (row: Acceptance) => (
        <span className="text-slate-600 text-xs whitespace-nowrap">
          {new Date(row.updatedAt || row.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    }
  ];

  return (
    <div>
      <DataTable<Acceptance>
        key={refreshKey}
        title="Acceptance & Inspection"
        description="Manage Acceptance & Inspection Reports (AIR) for deliveries"
        apiPath="/api/acceptances"
        columns={columns}
        searchPlaceholder="Search ..."
        onAdd={openAddModal}
        onView={(row) => router.push(`/acceptances/hub/${row.poId}`)}
        onEdit={(row) => router.push(`/acceptances/hub/${row.poId}`)}
        emptyIcon={<CheckSquare size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Acceptance & Inspection Reports found"
        filterKey="status"
        filterTabs={[
          { label: "All", value: null },
          { label: "Draft", value: "DRAFT" },
          { label: "Partial", value: "PARTIAL" },
          { label: "Completed", value: "COMPLETED" },
        ]}
        dateFilterKey="updatedAt"
        departmentFilterKey={(row: any) => row.po?.pr?.office?.name || row.po?.abstract?.rfq?.pr?.office?.name || ""}
      />
      {showModal && (
        <FormModal
          title="Create New Acceptance & Inspection (AIR)"
          submitLabel="Create"
          fields={[
            {
              key: "airNumber",
              label: "AIR Number (Optional)",
              type: "text",
              placeholder: "Leave blank if not yet assigned",
              required: false
            },
            {
              key: "poId",
              label: "Purchase Order",
              type: "select",
              required: true,
              options: pos.map(po => ({
                value: po.id,
                label: `${po.poNumber || 'No PO # yet'} (${po.supplier?.name || 'No Supplier'})`
              }))
            }
          ]}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
