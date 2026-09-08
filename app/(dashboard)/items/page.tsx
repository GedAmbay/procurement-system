"use client";

import { useState } from "react";
import { Tag, CheckCircle2, XCircle } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface Item {
  id: string;
  code: string | null;
  description: string;
  unit: string;
  standardCost: number;
  category: string | null;
  isActive: boolean;
}

const CATEGORIES = [
  "Medicine",
  "Medical Supplies",
  "Office Supplies",
  "Fuel & Lubricants",
  "Construction Materials",
  "Equipment",
  "Information Technology",
  "Food & Catering",
  "Janitorial Supplies",
  "Other",
];

const columns = [
  {
    key: "code",
    label: "Item Code",
    render: (row: Item) => (
      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#475569" }}>
        {row.code ?? "—"}
      </span>
    ),
    width: "100px",
  },
  {
    key: "description",
    label: "Description",
    render: (row: Item) => <span style={{ fontWeight: "500", color: "#0f172a" }}>{row.description}</span>,
  },
  { key: "unit", label: "Unit of Measure", width: "120px" },
  {
    key: "standardCost",
    label: "Standard Unit Cost",
    render: (row: Item) => <span style={{ fontWeight: "600", color: "#059669" }}>{formatCurrency(row.standardCost)}</span>,
    width: "140px",
  },
  {
    key: "category",
    label: "Category",
    render: (row: Item) => row.category ? (
      <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8" }}>{row.category}</span>
    ) : <span style={{ color: "#94a3b8" }}>—</span>,
  },
  {
    key: "isActive",
    label: "Status",
    render: (row: Item) => row.isActive ? (
      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}><CheckCircle2 size={11} style={{ marginRight: "3px" }} /> Active</span>
    ) : (
      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}><XCircle size={11} style={{ marginRight: "3px" }} /> Inactive</span>
    ),
    width: "80px",
  },
];

const itemFields = [
  { key: "code", label: "Item Code", placeholder: "e.g., MED-001" },
  { key: "description", label: "Item Description", required: true, placeholder: "Full item description" },
  { key: "unit", label: "Unit of Measure", required: true, placeholder: "e.g., Piece, Box, Ream, Liter" },
  { key: "standardCost", label: "Standard Unit Cost (₱)", type: "number" as const, required: true, placeholder: "0.00" },
  {
    key: "category", label: "Category", type: "select" as const,
    options: CATEGORIES.map((c) => ({ value: c, label: c })),
  },
];

export default function ItemsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      const res = await fetch(`/api/items/${editTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      toast.success("Item updated successfully");
    } else {
      const res = await fetch("/api/items", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create item");
      }
      toast.success("Item added to catalog");
    }
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (row: Item) => {
    const res = await fetch(`/api/items/${row.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to deactivate item");
  };

  return (
    <div>
      <DataTable<Item>
        key={refreshKey}
        title="Items & Catalog"
        description="Manage the standard items catalog with unit costs for procurement"
        apiPath="/api/items"
        columns={columns}
        searchPlaceholder="Search by description, code, unit..."
        onAdd={() => { setEditTarget(null); setShowModal(true); }}
        onEdit={(row) => { setEditTarget(row); setShowModal(true); }}
        onDelete={handleDelete}
        emptyIcon={<Tag size={40} style={{ opacity: 0.3 }} />}
        emptyText="No items in catalog yet"
      />

      {showModal && (
        <FormModal
          title={editTarget ? "Edit Item" : "Add Item to Catalog"}
          fields={itemFields}
          initialValues={editTarget ?? {}}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Update Item" : "Add Item"}
        />
      )}
    </div>
  );
}
