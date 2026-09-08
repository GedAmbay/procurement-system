"use client";

import React, { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";

interface Signatory {
  id: string;
  name: string;
  position: string;
  role: string;
  isActive: boolean;
  office?: { name: string } | null;
}

const SIGNATORY_ROLES = [
  { value: "HOPE", label: "HOPE / Local Chief Executive" },
  { value: "BAC_CHAIRMAN", label: "BAC Chairperson" },
  { value: "BUDGET_OFFICER", label: "Budget Officer" },
  { value: "SUPPLY_OFFICER", label: "Supply / Property Officer" },
  { value: "END_USER", label: "End User / Dept. Head" },
  { value: "APPROVING_OFFICIAL", label: "Approving Official" },
];

const ROLE_LABELS: Record<string, string> = {
  HOPE: "HOPE / LCE",
  BAC_CHAIRMAN: "BAC Chairperson",
  BUDGET_OFFICER: "Budget Officer",
  SUPPLY_OFFICER: "Supply Officer",
  END_USER: "End User",
  APPROVING_OFFICIAL: "Approving Official",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  HOPE: { bg: "#fdf4ff", color: "#7c3aed" },
  BAC_CHAIRMAN: { bg: "#eff6ff", color: "#1d4ed8" },
  BUDGET_OFFICER: { bg: "#fff7ed", color: "#c2410c" },
  SUPPLY_OFFICER: { bg: "#f0fdf4", color: "#16a34a" },
  END_USER: { bg: "#f8fafc", color: "#475569" },
  APPROVING_OFFICIAL: { bg: "#fef2f2", color: "#dc2626" },
};

const columns = [
  {
    key: "name",
    label: "Name",
    render: (row: Signatory) => <span style={{ fontWeight: "600", color: "#0f172a" }}>{row.name}</span>,
  },
  { key: "position", label: "Position / Designation" },
  {
    key: "role",
    label: "Signatory Role",
    render: (row: Signatory) => {
      const c = ROLE_COLORS[row.role] ?? { bg: "#f1f5f9", color: "#475569" };
      return <span className="badge" style={{ background: c.bg, color: c.color }}>{ROLE_LABELS[row.role] ?? row.role}</span>;
    },
    width: "150px",
  },
  {
    key: "office",
    label: "Office",
    render: (row: Signatory) => <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{row.office?.name ?? "—"}</span>,
  },
  {
    key: "isActive",
    label: "Status",
    render: (row: Signatory) => row.isActive ? (
      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}><CheckCircle2 size={11} style={{ marginRight: "3px" }} /> Active</span>
    ) : (
      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}><XCircle size={11} style={{ marginRight: "3px" }} /> Inactive</span>
    ),
    width: "80px",
  },
];

export default function SignatoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Signatory | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/offices")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => setOffices(data))
      .catch(() => {});
  }, []);

  const signatoryFields = [
    { key: "name", label: "Full Name", required: true, placeholder: "e.g., Hon. Ricardo Dela Cruz" },
    { key: "position", label: "Position / Designation", required: true, placeholder: "e.g., Municipal Mayor" },
    {
      key: "role", label: "Signatory Role", type: "select" as const, required: true,
      options: SIGNATORY_ROLES,
    },
    {
      key: "officeId", label: "Office / Department", type: "select" as const,
      options: offices.map((o) => ({ value: o.id, label: o.name })),
    },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      const res = await fetch(`/api/signatories/${editTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update signatory");
      toast.success("Signatory updated");
    } else {
      const res = await fetch("/api/signatories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add signatory");
      toast.success("Signatory added");
    }
    setShowModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (row: Signatory) => {
    const res = await fetch(`/api/signatories/${row.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to deactivate signatory");
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <DataTable<Signatory>
        key={refreshKey}
        title="Signatories Master List"
        description="Manage authorized signatories for PR, RFQ, AOQ, and PO documents"
        apiPath="/api/signatories"
        columns={columns}
        searchPlaceholder="Search by name, position, role..."
        onAdd={() => { setEditTarget(null); setShowModal(true); }}
        onEdit={(row) => { setEditTarget(row); setShowModal(true); }}
        onDelete={handleDelete}
        emptyIcon={<Users size={40} style={{ opacity: 0.3 }} />}
        emptyText="No signatories configured yet"
      />

      {showModal && (
        <FormModal
          title={editTarget ? "Edit Signatory" : "Add Signatory"}
          fields={signatoryFields}
          initialValues={editTarget ? { id: editTarget.id, name: editTarget.name, position: editTarget.position, role: editTarget.role, isActive: editTarget.isActive, officeId: editTarget.office?.name ?? "" } : {}}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Update" : "Add Signatory"}
        />
      )}
    </div>
  );
}
