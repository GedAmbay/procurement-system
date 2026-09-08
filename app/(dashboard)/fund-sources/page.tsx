"use client";

import { useState } from "react";
import { Wallet, CheckCircle2, XCircle } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface FundSource {
  id: string;
  name: string;
  code: string;
  description: string | null;
  fiscalYear: number;
  totalBudget: number;
  usedBudget: number;
  isActive: boolean;
}

const columns = [
  {
    key: "code",
    label: "Code",
    render: (row: FundSource) => (
      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", color: "#475569", fontWeight: "600" }}>
        {row.code}
      </span>
    ),
    width: "140px",
  },
  {
    key: "name",
    label: "Fund Source Name",
    render: (row: FundSource) => (
      <div>
        <div style={{ fontWeight: "600", color: "#0f172a" }}>{row.name}</div>
        {row.description && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{row.description}</div>}
      </div>
    ),
  },
  {
    key: "fiscalYear",
    label: "FY",
    render: (row: FundSource) => <span style={{ fontWeight: "600", color: "#475569" }}>{row.fiscalYear}</span>,
    width: "70px",
  },
  {
    key: "totalBudget",
    label: "Total Budget",
    render: (row: FundSource) => <span style={{ fontWeight: "600", color: "#0f172a" }}>{formatCurrency(row.totalBudget)}</span>,
    width: "140px",
  },
  {
    key: "usedBudget",
    label: "Utilization",
    render: (row: FundSource) => {
      const pct = row.totalBudget > 0 ? (row.usedBudget / row.totalBudget) * 100 : 0;
      const color = pct > 90 ? "#dc2626" : pct > 70 ? "#d97706" : "#059669";
      return (
        <div style={{ minWidth: "120px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ fontSize: "0.75rem", color: "#374151" }}>{formatCurrency(row.usedBudget)}</span>
            <span style={{ fontSize: "0.75rem", color, fontWeight: "700" }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "3px" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: "3px" }} />
          </div>
        </div>
      );
    },
    width: "160px",
  },
  {
    key: "isActive",
    label: "Status",
    render: (row: FundSource) => row.isActive ? (
      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}><CheckCircle2 size={11} style={{ marginRight: "3px" }} /> Active</span>
    ) : (
      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}><XCircle size={11} style={{ marginRight: "3px" }} /> Inactive</span>
    ),
    width: "80px",
  },
];

const fundSourceFields = [
  { key: "name", label: "Fund Source Name", required: true, placeholder: "e.g., General Fund - MOOE" },
  { key: "code", label: "Fund Code", required: true, placeholder: "e.g., GF-MOOE-2026" },
  { key: "description", label: "Description", type: "textarea" as const, placeholder: "Brief description of this fund source" },
  { key: "fiscalYear", label: "Fiscal Year", type: "number" as const, required: true, defaultValue: new Date().getFullYear() },
  { key: "totalBudget", label: "Total Budget (₱)", type: "number" as const, required: true, placeholder: "0.00" },
];

export default function FundSourcesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FundSource | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      const res = await fetch(`/api/fund-sources/${editTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update fund source");
      toast.success("Fund source updated");
    } else {
      const res = await fetch("/api/fund-sources", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create fund source");
      }
      toast.success("Fund source created");
    }
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (row: FundSource) => {
    const res = await fetch(`/api/fund-sources/${row.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to deactivate fund source");
  };

  return (
    <div>
      <DataTable<FundSource>
        key={refreshKey}
        title="Fund Sources & Appropriations"
        description="Manage budget appropriations and fund sources for procurement transactions"
        apiPath="/api/fund-sources"
        columns={columns}
        searchPlaceholder="Search by name or code..."
        onAdd={() => { setEditTarget(null); setShowModal(true); }}
        onEdit={(row) => { setEditTarget(row); setShowModal(true); }}
        onDelete={handleDelete}
        emptyIcon={<Wallet size={40} style={{ opacity: 0.3 }} />}
        emptyText="No fund sources configured yet"
      />

      {showModal && (
        <FormModal
          title={editTarget ? "Edit Fund Source" : "Add Fund Source"}
          fields={fundSourceFields}
          initialValues={editTarget ?? {}}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Update" : "Add Fund Source"}
        />
      )}
    </div>
  );
}
