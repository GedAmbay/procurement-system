"use client";

import { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Shield, Building2, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import FormModal from "@/components/ui/form-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  officeId?: string | null;
  office?: { id?: string; name: string } | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#fdf4ff", color: "#7c3aed" },
  BAC_SECRETARIAT: { bg: "#eff6ff", color: "#1d4ed8" },
  END_USER: { bg: "#f0fdf4", color: "#16a34a" },
};

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;
  const currentUserEmail = session?.user?.email;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);

  // Confirmation Modals State
  const [toggleTarget, setToggleTarget] = useState<{ user: User; targetActive: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch("/api/offices")
      .then((r) => r.json())
      .then(setOffices)
      .catch(() => {});
  }, []);

  const handleToggleStatus = async () => {
    if (!toggleTarget) return;
    const { user, targetActive } = toggleTarget;

    if (user.id === currentUserId || user.email === currentUserEmail) {
      toast.error("You cannot deactivate your own account");
      setToggleTarget(null);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: targetActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update account status");
      }

      toast.success(
        targetActive
          ? `Account for ${user.name} has been activated`
          : `Account for ${user.name} has been made inactive`
      );
      setToggleTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.id === currentUserId || deleteTarget.email === currentUserEmail) {
      toast.error("You cannot delete your own account");
      setDeleteTarget(null);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}?permanent=true`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user account");
      }

      const resData = await res.json();
      toast.success(resData.message || "User account removed");
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, string>) => {
    if (editTarget) {
      const payload: Record<string, any> = {
        name: data.name,
        email: data.email,
        role: data.role,
        officeId: data.officeId || null,
      };
      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password.trim();
      }

      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed to update user");
      }
      toast.success("User account updated successfully");
    } else {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed to create user");
      }
      toast.success("User account created successfully");
    }

    setRefreshKey((k) => k + 1);
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "28%",
      render: (row: User) => {
        const isSelf = row.id === currentUserId || row.email === currentUserEmail;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "700",
                fontSize: "0.8125rem",
                flexShrink: 0,
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
              }}
            >
              {row.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span
                  style={{
                    fontWeight: "600",
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.name}
                </span>
                {isSelf && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: "#e0e7ff",
                      color: "#3730a3",
                      lineHeight: "1.2",
                    }}
                  >
                    YOU
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      label: "Role",
      width: "20%",
      render: (row: User) => {
        const c = ROLE_COLORS[row.role] ?? { bg: "#f1f5f9", color: "#475569" };
        return (
          <span
            className="badge"
            style={{
              background: c.bg,
              color: c.color,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "0.3rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            <Shield size={12} style={{ flexShrink: 0 }} />
            {ROLE_LABELS[row.role] ?? row.role}
          </span>
        );
      },
    },
    {
      key: "office",
      label: "Office",
      width: "20%",
      render: (row: User) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Building2 size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <span
            style={{
              fontSize: "0.875rem",
              color: row.office?.name ? "#334155" : "#94a3b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.office?.name ?? "No Office Assigned"}
          </span>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      align: "center",
      width: "11%",
      render: (row: User) =>
        row.isActive ? (
          <span
            className="badge"
            style={{
              background: "#f0fdf4",
              color: "#16a34a",
              border: "1px solid #bbf7d0",
              padding: "0.25rem 0.625rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={12} /> Active
          </span>
        ) : (
          <span
            className="badge"
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              padding: "0.25rem 0.625rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            <XCircle size={12} /> Inactive
          </span>
        ),
    },
    {
      key: "createdAt",
      label: "Account Created",
      align: "center",
      width: "11%",
      render: (row: User) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      width: "10%",
      render: (row: User) => {
        const isSelf = row.id === currentUserId || row.email === currentUserEmail;
        return (
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setEditTarget(row);
                setShowModal(true);
              }}
              title="Edit Account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#475569",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#2563eb";
                e.currentTarget.style.borderColor = "#93c5fd";
                e.currentTarget.style.background = "#eff6ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              <Pencil size={13} />
            </button>

            <button
              type="button"
              disabled={isSelf}
              onClick={() => setToggleTarget({ user: row, targetActive: !row.isActive })}
              title={
                isSelf
                  ? "Cannot deactivate your own account"
                  : row.isActive
                  ? "Make Account Inactive"
                  : "Activate Account"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: isSelf ? "#cbd5e1" : row.isActive ? "#d97706" : "#16a34a",
                cursor: isSelf ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isSelf) {
                  e.currentTarget.style.background = row.isActive ? "#fef3c7" : "#f0fdf4";
                  e.currentTarget.style.borderColor = row.isActive ? "#fde68a" : "#bbf7d0";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelf) {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }
              }}
            >
              {row.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
            </button>

            <button
              type="button"
              disabled={isSelf}
              onClick={() => setDeleteTarget(row)}
              title={isSelf ? "Cannot delete your own account" : "Delete Account"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: isSelf ? "#cbd5e1" : "#ef4444",
                cursor: isSelf ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isSelf) {
                  e.currentTarget.style.color = "#dc2626";
                  e.currentTarget.style.borderColor = "#fca5a5";
                  e.currentTarget.style.background = "#fef2f2";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelf) {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#ffffff";
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      },
    },
  ];

  const userFields = [
    { key: "name", label: "Full Name", required: true, placeholder: "e.g., Maria Santos" },
    { key: "email", label: "Email Address", type: "email" as const, required: true, placeholder: "user@pandan.gov.ph" },
    {
      key: "password",
      label: editTarget ? "New Password (optional)" : "Password",
      type: "password" as const,
      required: !editTarget,
      placeholder: editTarget ? "Leave blank to keep existing password" : "Minimum 6 characters",
    },
    {
      key: "role",
      label: "System Role",
      type: "select" as const,
      required: true,
      options: Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })),
    },
    {
      key: "officeId",
      label: "Assigned Office",
      type: "select" as const,
      options: offices.map((o) => ({ value: o.id, label: o.name })),
    },
  ];

  return (
    <div>
      <DataTable<User>
        key={refreshKey}
        title="User Management"
        description="Manage system user accounts and role assignments (Admin only)"
        apiPath="/api/users"
        columns={columns}
        searchPlaceholder="Search users by name, email, or role..."
        onAdd={() => {
          setEditTarget(null);
          setShowModal(true);
        }}
        onEdit={(row) => {
          setEditTarget(row);
          setShowModal(true);
        }}
        customActions={[
          {
            label: (row: User) => (row.isActive ? "Make Inactive" : "Make Active"),
            icon: (row: User) =>
              row.isActive ? <UserX size={16} /> : <CheckCircle2 size={16} />,
            color: (row: User) => (row.isActive ? "#d97706" : "#16a34a"),
            onClick: (row: User) => {
              if (row.id === currentUserId || row.email === currentUserEmail) {
                toast.error("You cannot change the active status of your own account");
                return;
              }
              setToggleTarget({ user: row, targetActive: !row.isActive });
            },
          },
        ]}
        onDelete={async (row: User) => {
          if (row.id === currentUserId || row.email === currentUserEmail) {
            toast.error("You cannot delete your own account");
            return;
          }
          setDeleteTarget(row);
        }}
        emptyIcon={<Users size={40} style={{ opacity: 0.3 }} />}
        emptyText="No users found"
      />

      {/* Create / Edit User Modal */}
      {showModal && (
        <FormModal
          title={editTarget ? `Edit User Account: ${editTarget.name}` : "Create New User Account"}
          fields={userFields}
          initialValues={
            editTarget
              ? {
                  name: editTarget.name,
                  email: editTarget.email,
                  role: editTarget.role,
                  officeId: editTarget.officeId || (editTarget.office as any)?.id || "",
                  password: "",
                }
              : {}
          }
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
          onSubmit={handleSubmit}
          submitLabel={editTarget ? "Save Changes" : "Create Account"}
        />
      )}

      {/* Confirmation Modal for Active/Inactive toggle */}
      <ConfirmModal
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleStatus}
        isLoading={actionLoading}
        title={toggleTarget?.targetActive ? "Activate User Account" : "Make Account Inactive"}
        message={
          toggleTarget?.targetActive
            ? `Are you sure you want to activate the account for ${toggleTarget?.user.name}? They will be able to log in and access system functions.`
            : `Are you sure you want to deactivate the account for ${toggleTarget?.user.name}? They will be blocked from logging in until reactivated.`
        }
        confirmText={toggleTarget?.targetActive ? "Activate Account" : "Make Inactive"}
        isDestructive={!toggleTarget?.targetActive}
      />

      {/* Confirmation Modal for Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        isLoading={actionLoading}
        title="Delete User Account"
        message={`Are you sure you want to delete ${deleteTarget?.name}'s account? If this user has created purchase requests or procurement documents, their account will be deactivated instead to preserve procurement audit records.`}
        confirmText="Delete Account"
        isDestructive={true}
      />
    </div>
  );
}
