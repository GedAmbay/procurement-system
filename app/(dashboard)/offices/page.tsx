"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";

interface Office {
  id: string;
  name: string;
  code: string;
  head: string | null;
  isActive: boolean;
}

const columns = [
  {
    key: "code",
    label: "Code",
    render: (row: Office) => (
      <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "0.875rem", color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: "4px" }}>
        {row.code}
      </span>
    ),
    width: "100px",
  },
  { key: "name", label: "Office / Department Name" },
  {
    key: "head",
    label: "Department Head",
    render: (row: Office) => <span style={{ color: "#374151" }}>{row.head ?? "—"}</span>,
  },
];

const officeFields = [
  { key: "name", label: "Office / Department Name", required: true, placeholder: "e.g., Municipal Health Office" },
  { key: "code", label: "Office Code", required: true, placeholder: "e.g., MHO" },
  { key: "head", label: "Department Head", placeholder: "e.g., Dr. Ana Lim" },
];

export default function OfficesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Office | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      await fetch(`/api/offices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      toast.success("Office updated");
    } else {
      const res = await fetch("/api/offices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to create office"); }
      toast.success("Office added");
    }
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <DataTable<Office>
        key={refreshKey}
        title="Offices & Departments"
        description="Manage the list of municipal offices and requesting departments"
        apiPath="/api/offices"
        columns={columns}
        searchPlaceholder="Search by name or code..."
        onAdd={() => { setEditTarget(null); setShowModal(true); }}
        onEdit={(row) => { setEditTarget(row); setShowModal(true); }}
        emptyIcon={<Building2 size={40} style={{ opacity: 0.3 }} />}
        emptyText="No offices configured yet"
      />

      {showModal && (
        <FormModal
          title={editTarget ? "Edit Office" : "Add Office"}
          fields={officeFields}
          initialValues={editTarget ?? {}}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Update" : "Add Office"}
        />
      )}
    </div>
  );
}
