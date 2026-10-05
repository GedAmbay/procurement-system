"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Eye, Printer, Clock, CheckCircle2 } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "#fef3c7", color: "#b45309", icon: <Clock size={11} /> },
  ISSUED: { bg: "#eff6ff", color: "#2563eb", icon: <CheckCircle2 size={11} /> },
  COMPLETED: { bg: "#f0fdf4", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

interface Acceptance {
  id: string;
  poId: string;
  iarNumber: string;
  po: { poNumber: string; supplier: { name: string } };
  status: string;
  createdAt: string;
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
        body: JSON.stringify({ poId: data.poId })
      });
      if (!res.ok) throw new Error("Failed to create acceptance");
      const acc = await res.json();
      toast.success("Acceptance created successfully");
      setShowModal(false);
      router.push(`/acceptances/${acc.id}`);
    } catch {
      toast.error("Error creating acceptance");
    }
  };

  const columns = [
    {
      key: "iarNumber",
      label: "IAR Number",
      render: (row: Acceptance) => (
        <div style={{ fontWeight: "600", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.iarNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "poNumber",
      label: "PO Number",
      render: (row: Acceptance) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.po?.poNumber || "N/A"}
        </div>
      ),
      width: "200px",
    },
    {
      key: "supplier",
      label: "Supplier",
      align: "left",
      render: (row: Acceptance) => (
        <div style={{ fontSize: "0.875rem", color: "#334155" }}>
          {row.po?.supplier?.name || "N/A"}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (row: Acceptance) => {
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
      label: "Date Created",
      align: "center",
      render: (row: Acceptance) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "block" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "140px",
    }
  ];

  return (
    <div>
      <DataTable<Acceptance>
        key={refreshKey}
        title="Acceptance and Inspection"
        description="Manage Inspection and Acceptance Reports (IAR) for deliveries"
        apiPath="/api/acceptances"
        columns={columns}
        searchPlaceholder="Search ..."
        onAdd={openAddModal}
        onView={(row) => router.push(`/acceptances/hub/${row.poId}`)}
        onEdit={(row) => router.push(`/acceptances/hub/${row.poId}`)}
        emptyIcon={<CheckSquare size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Acceptance Reports found"
        filterKey="status"
        filterTabs={[
          { label: "All", value: null },
          { label: "Draft", value: "DRAFT" },
          { label: "Issued", value: "ISSUED" },
          { label: "Completed", value: "COMPLETED" },
        ]}
      />
      {showModal && (
        <FormModal
          title="Create New Acceptance (IAR)"
          submitLabel="Create"
          fields={[
            {
              key: "poId",
              label: "Purchase Order",
              type: "select",
              required: true,
              options: pos.map(po => ({ value: po.id, label: `${po.poNumber} (${po.supplier?.name || 'No Supplier'})` }))
            }
          ]}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
