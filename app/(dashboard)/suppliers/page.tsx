"use client";

import { useState } from "react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  philgepsNo: string | null;
  tin: string | null;
  address: string | null;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  isActive: boolean;
}

const columns = [
  {
    key: "name",
    label: "Supplier Name",
    render: (row: Supplier) => (
      <div>
        <div style={{ fontWeight: "600", color: "#0f172a" }}>{row.name}</div>
        {row.philgepsNo && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>PhilGEPS: {row.philgepsNo}</div>}
      </div>
    ),
  },
  {
    key: "tin",
    label: "TIN",
    render: (row: Supplier) => <span style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{row.tin ?? "—"}</span>,
  },
  {
    key: "contactPerson",
    label: "Contact Person",
    render: (row: Supplier) => (
      <div>
        <div style={{ fontSize: "0.875rem" }}>{row.contactPerson ?? "—"}</div>
        {row.contactNumber && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{row.contactNumber}</div>}
        {row.email && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{row.email}</div>}
      </div>
    ),
  },
  {
    key: "address",
    label: "Address",
    render: (row: Supplier) => <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{row.address ?? "—"}</span>,
    width: "200px",
  },
  {
    key: "isActive",
    label: "Status",
    render: (row: Supplier) => row.isActive ? (
      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}>
        <CheckCircle2 size={11} style={{ marginRight: "3px" }} /> Active
      </span>
    ) : (
      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}>
        <XCircle size={11} style={{ marginRight: "3px" }} /> Inactive
      </span>
    ),
    width: "90px",
  },
];

const supplierFields = [
  { key: "name", label: "Supplier / Company Name", required: true, placeholder: "e.g., ABC Medical Supplies Corp." },
  { key: "philgepsNo", label: "PhilGEPS Registration No.", placeholder: "e.g., PH-2024-001" },
  { key: "tin", label: "TIN (Tax Identification No.)", placeholder: "e.g., 123-456-789-000" },
  { key: "address", label: "Business Address", type: "textarea" as const, placeholder: "Street, City, Province" },
  { key: "contactPerson", label: "Contact Person", placeholder: "Full name" },
  { key: "contactNumber", label: "Contact Number", placeholder: "e.g., 09171234567" },
  { key: "email", label: "Email Address", type: "email" as const, placeholder: "supplier@example.com" },
];

export default function SuppliersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAdd = () => { setEditTarget(null); setShowModal(true); };
  const handleEdit = (row: Supplier) => { setEditTarget(row); setShowModal(true); };

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      const res = await fetch(`/api/suppliers/${editTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      toast.success("Supplier updated successfully");
    } else {
      const res = await fetch("/api/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      toast.success("Supplier added successfully");
    }
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (row: Supplier) => {
    const res = await fetch(`/api/suppliers/${row.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to deactivate supplier");
  };

  return (
    <div>
      <DataTable<Supplier>
        key={refreshKey}
        title="Suppliers Registry"
        description="Manage accredited suppliers and vendors for procurement canvassing"
        apiPath="/api/suppliers"
        columns={columns}
        searchPlaceholder="Search by name, PhilGEPS no., TIN..."
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyIcon={<Building2 size={40} style={{ opacity: 0.3 }} />}
        emptyText="No suppliers registered yet"
      />

      {showModal && (
        <FormModal
          title={editTarget ? "Edit Supplier" : "Add New Supplier"}
          fields={supplierFields}
          initialValues={editTarget ?? {}}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Update Supplier" : "Add Supplier"}
        />
      )}
    </div>
  );
}
