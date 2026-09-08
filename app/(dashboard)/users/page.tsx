"use client";

import { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Shield } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  office?: { name: string } | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#fdf4ff", color: "#7c3aed" },
  BAC_SECRETARIAT: { bg: "#eff6ff", color: "#1d4ed8" },
  END_USER: { bg: "#f0fdf4", color: "#16a34a" },
  BUDGET_OFFICER: { bg: "#fff7ed", color: "#c2410c" },
  SUPPLY_OFFICER: { bg: "#ecfeff", color: "#0891b2" },
  APPROVING_OFFICIAL: { bg: "#fef2f2", color: "#dc2626" },
  VIEWER: { bg: "#f8fafc", color: "#475569" },
};

const columns = [
  {
    key: "name",
    label: "Name",
    render: (row: User) => (
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: "700", fontSize: "0.75rem", flexShrink: 0,
        }}>
          {row.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: "600", color: "#0f172a" }}>{row.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{row.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: "role",
    label: "Role",
    render: (row: User) => {
      const c = ROLE_COLORS[row.role] ?? { bg: "#f1f5f9", color: "#475569" };
      return (
        <span className="badge" style={{ background: c.bg, color: c.color }}>
          <Shield size={10} style={{ marginRight: "3px" }} />
          {ROLE_LABELS[row.role] ?? row.role}
        </span>
      );
    },
    width: "200px",
  },
  {
    key: "office",
    label: "Office",
    render: (row: User) => <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{row.office?.name ?? "—"}</span>,
  },
  {
    key: "isActive",
    label: "Status",
    render: (row: User) => row.isActive ? (
      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}><CheckCircle2 size={11} style={{ marginRight: "3px" }} /> Active</span>
    ) : (
      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}><XCircle size={11} style={{ marginRight: "3px" }} /> Inactive</span>
    ),
    width: "80px",
  },
  {
    key: "createdAt",
    label: "Created",
    render: (row: User) => (
      <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
        {new Date(row.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
      </span>
    ),
    width: "110px",
  },
];

export default function UsersPage() {
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/offices").then((r) => r.json()).then(setOffices).catch(() => { });
  }, []);

  const userFields = [
    { key: "name", label: "Full Name", required: true, placeholder: "e.g., Maria Santos" },
    { key: "email", label: "Email Address", type: "email" as const, required: true, placeholder: "user@pandan.gov.ph" },
    { key: "password", label: "Password", type: "password" as const, required: true, placeholder: "Minimum 8 characters" },
    {
      key: "role", label: "System Role", type: "select" as const, required: true,
      options: Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })),
    },
    {
      key: "officeId", label: "Assigned Office", type: "select" as const,
      options: offices.map((o) => ({ value: o.id, label: o.name })),
    },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to create user"); }
    toast.success("User account created successfully");
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <DataTable<User>
        key={refreshKey}
        title="User Management"
        description="Manage system user accounts and role assignments (Admin only)"
        apiPath="/api/users"
        columns={columns}
        searchPlaceholder="Search users..."
        onAdd={() => setShowModal(true)}
        emptyIcon={<Users size={40} style={{ opacity: 0.3 }} />}
        emptyText="No users found"
      />

      {showModal && (
        <FormModal
          title="Create New User Account"
          fields={userFields}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitLabel="Create Account"
        />
      )}
    </div>
  );
}
