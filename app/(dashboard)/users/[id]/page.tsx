"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Shield,
  Building2,
  Mail,
  Calendar,
  Clock,
  Lock,
  Unlock,
  KeyRound,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  FileText,
  ShoppingCart,
  ClipboardCheck,
  Activity,
  History,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  IdCard,
} from "lucide-react";
import LoaderWave from "@/components/ui/loader-wave";
import StatusBadge from "@/components/ui/status-badge";
import FormModal from "@/components/ui/form-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { ROLE_LABELS, formatCurrency } from "@/lib/utils";

interface UserDetail {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  role: string;
  officeId?: string | null;
  office?: { id: string; name: string; code?: string } | null;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    purchaseRequests: number;
    rfqsCreated: number;
    abstractsCreated: number;
    purchaseOrdersCreated: number;
    acceptancesCreated: number;
    auditLogs: number;
  };
  purchaseRequests: {
    id: string;
    prNumber?: string | null;
    purpose: string;
    totalAmount: number;
    createdAt: string;
  }[];
  rfqsCreated: {
    id: string;
    rfqNumber?: string | null;
    remarks?: string | null;
    status: string;
    createdAt: string;
  }[];
  purchaseOrdersCreated: {
    id: string;
    poNumber?: string | null;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
  accountEvents: {
    id: string;
    documentType: string;
    action: string;
    notes?: string | null;
    createdAt: string;
    user: { id: string; name: string; username: string };
  }[];
  userActions: {
    id: string;
    documentType: string;
    documentId: string;
    action: string;
    notes?: string | null;
    createdAt: string;
  }[];
}

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  ADMIN: { bg: "#fdf4ff", color: "#7c3aed", border: "#e9d5ff" },
  BAC_SECRETARIAT: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  END_USER: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
};

const ROLE_PERMISSIONS: Record<string, { summary: string; capabilities: string[] }> = {
  ADMIN: {
    summary: "Full system administration, user governance, and procurement oversight.",
    capabilities: [
      "Manage user accounts, roles, password resets, and lockouts",
      "Configure offices, signatories, suppliers, items, and fund sources",
      "Access all procurement documents, audit logs, and system settings",
    ],
  },
  BAC_SECRETARIAT: {
    summary: "Manages Bids and Awards Committee workflows and procurement documentation.",
    capabilities: [
      "Create and manage RFQs, Abstracts of Canvass, and Purchase Orders",
      "Coordinate BAC attendance, calendar events, and supplier quotations",
      "Track procurement folders and acceptance records",
    ],
  },
  END_USER: {
    summary: "Office-level requester for submitting and tracking purchase requests.",
    capabilities: [
      "Create and submit Purchase Requests for assigned office",
      "Monitor status of requested procurement items",
      "View office procurement schedules and notifications",
    ],
  },
};

function formatDateTime(value?: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const userId = params?.id;
  const currentUserId = session?.user?.id;
  const currentUsername = session?.user?.username;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"records" | "security-log" | "activity-log">("records");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load user details");
      }
      const data = await res.json();
      setUser(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    fetch(`/api/users/${userId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load user details");
        }
        return res.json();
      })
      .then((data) => {
        if (active) {
          setUser(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load user");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch("/api/offices")
      .then((r) => r.json())
      .then((data) => {
        if (active) setOffices(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoaderWave />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900">Unable to Open User Account</h2>
        <p className="mt-1 text-sm text-slate-500">{error || "User not found."}</p>
        <Link
          href="/users"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ArrowLeft size={16} /> Back to User Management
        </Link>
      </div>
    );
  }

  const isSelf = user.id === currentUserId || user.username === currentUsername;
  const isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
  const roleStyle = ROLE_COLORS[user.role] ?? { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
  const roleInfo = ROLE_PERMISSIONS[user.role] ?? {
    summary: "Standard system user access.",
    capabilities: ["Access assigned procurement modules."],
  };

  const handleEditSubmit = async (data: Record<string, string>) => {
    const payload: Record<string, string | null> = {
      name: data.name,
      username: data.username,
      email: data.email || null,
      role: data.role,
      officeId: data.officeId || null,
    };
    if (data.password && data.password.trim().length > 0) {
      payload.password = data.password.trim();
    }

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error ?? "Failed to update user");
    }

    toast.success(
      payload.password
        ? "User updated and temporary password issued"
        : "User account updated successfully"
    );
    await fetchUser();
  };

  const handleResetPasswordSubmit = async (data: Record<string, string>) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: data.password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error ?? "Failed to reset password");
    }
    toast.success(`Temporary password issued for ${user.username}. They must change it on next login.`);
    await fetchUser();
  };

  const handleUnlock = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlockAccount: true }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to unlock account");
      }
      toast.success(`Account ${user.username} unlocked`);
      await fetchUser();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (isSelf) {
      toast.error("You cannot deactivate your own account");
      setShowToggleModal(false);
      return;
    }
    setActionLoading(true);
    try {
      const targetActive = !user.isActive;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: targetActive }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to update account status");
      }
      toast.success(
        targetActive
          ? `Account for ${user.name} has been activated`
          : `Account for ${user.name} has been made inactive`
      );
      setShowToggleModal(false);
      await fetchUser();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isSelf) {
      toast.error("You cannot delete your own account");
      setShowDeleteModal(false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}?permanent=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to delete user account");
      }
      const resData = await res.json();
      toast.success(resData.message || "User account removed");
      setShowDeleteModal(false);
      router.push("/users");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
      setActionLoading(false);
    }
  };

  const editFields = [
    { key: "username", label: "Employee ID / Username", required: true, placeholder: "e.g., BAC-001" },
    { key: "name", label: "Full Name", required: true, placeholder: "e.g., Maria Santos" },
    {
      key: "email",
      label: "Notification Email (Optional)",
      type: "email" as const,
      required: false,
      placeholder: "Optional — for alerts only",
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

  const resetPasswordFields = [
    {
      key: "password",
      label: "New Temporary Password",
      type: "password" as const,
      required: true,
      placeholder: "Min 10 chars (upper, lower, number/symbol)",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to User Management
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {isLocked && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleUnlock}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Unlock size={15} />
              Unlock Account
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowResetPwModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <KeyRound size={15} />
            Reset Password
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Pencil size={15} />
            Edit Account
          </button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: "1.5rem",
                flexShrink: 0,
                boxShadow: "0 6px 14px rgba(37, 99, 235, 0.25)",
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
                {isSelf && (
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                    YOU
                  </span>
                )}
                <StatusBadge status={user.isActive} />
                {isLocked && (
                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    <Lock size={11} /> LOCKED
                  </span>
                )}
                {user.mustChangePassword && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    <KeyRound size={11} /> TEMP PASSWORD
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <IdCard size={14} className="text-slate-400" />
                  ID: {user.username}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: roleStyle.bg,
                    color: roleStyle.color,
                    border: `1px solid ${roleStyle.border}`,
                  }}
                >
                  <Shield size={12} />
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  {user.office?.name ?? "No Office Assigned"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 text-xs text-slate-500 sm:items-end">
            <span>Last Login: <strong className="text-slate-700">{formatDateTime(user.lastLoginAt)}</strong></span>
            <span>Created: <strong className="text-slate-700">{formatDateTime(user.createdAt)}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Account & Security Details */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800 uppercase">
                <IdCard size={16} className="text-blue-600" />
                Account Profile
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Employee ID</dt>
                  <dd className="font-semibold text-slate-900">{user.username}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Full Name</dt>
                  <dd className="text-right font-medium text-slate-900">{user.name}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="flex items-center gap-1 text-slate-500">
                    <Mail size={13} /> Notification Email
                  </dt>
                  <dd className="text-right font-medium text-slate-800">
                    {user.email || <span className="text-slate-400">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Assigned Office</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.office ? (
                      <span>
                        {user.office.name}
                        {user.office.code ? (
                          <span className="ml-1 text-xs text-slate-400">({user.office.code})</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1 text-slate-500">
                    <Calendar size={13} /> Last Updated
                  </dt>
                  <dd className="text-right text-slate-700">{formatDateTime(user.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800 uppercase">
                <Lock size={16} className="text-violet-600" />
                Security Posture
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Account State</dt>
                  <dd><StatusBadge status={user.isActive} /></dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="flex items-center gap-1 text-slate-500">
                    <Clock size={13} /> Last Sign-In
                  </dt>
                  <dd className="text-right font-medium text-slate-900">
                    {formatDateTime(user.lastLoginAt)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Password Policy</dt>
                  <dd className="text-right">
                    {user.mustChangePassword ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Must change on next login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={12} /> Active password set
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500">Password Changed</dt>
                  <dd className="text-right text-slate-700">
                    {formatDateTime(user.passwordChangedAt)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500">Failed Logins / Lock</dt>
                  <dd className="text-right">
                    {isLocked ? (
                      <span className="font-semibold text-red-600">
                        Locked until {formatDateTime(user.lockedUntil)}
                      </span>
                    ) : (
                      <span className="text-slate-700">
                        {user.failedLoginAttempts} failed attempt{user.failedLoginAttempts === 1 ? "" : "s"}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Procurement Activity & Audit Logs */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("records")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "records"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileText size={14} />
                  Procurement Activity
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("security-log")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "security-log"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <History size={14} />
                  Account Security Log ({user.accountEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("activity-log")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "activity-log"
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Activity size={14} />
                  Recent User Actions ({user.userActions.length})
                </button>
              </div>
            </div>

            <div className="p-5">
              {activeTab === "records" && (
                <div className="space-y-6">
                  {/* Stat Tiles */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      { label: "Purchase Requests", count: user._count.purchaseRequests, icon: FileText },
                      { label: "RFQs Created", count: user._count.rfqsCreated, icon: ClipboardCheck },
                      { label: "Abstracts", count: user._count.abstractsCreated, icon: FileText },
                      { label: "Purchase Orders", count: user._count.purchaseOrdersCreated, icon: ShoppingCart },
                      { label: "Acceptances", count: user._count.acceptancesCreated, icon: CheckCircle2 },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                        >
                          <div className="flex items-center justify-between text-slate-400">
                            <Icon size={15} />
                          </div>
                          <div className="mt-2 text-xl font-bold text-slate-900">{stat.count}</div>
                          <div className="text-[11px] font-medium text-slate-500">{stat.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recent PRs */}
                  <div>
                    <h3 className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      Recent Purchase Requests
                    </h3>
                    {user.purchaseRequests.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No purchase requests created by this user.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {user.purchaseRequests.map((pr) => (
                          <Link
                            key={pr.id}
                            href={`/purchase-requests/${pr.id}`}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-blue-600">
                                {pr.prNumber || "Draft PR"}
                              </div>
                              <div className="truncate text-xs text-slate-500">{pr.purpose}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(pr.totalAmount)}
                              </span>
                              <ExternalLink size={13} className="text-slate-400" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent RFQs & POs */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                        Recent RFQs
                      </h3>
                      {user.rfqsCreated.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                          No RFQs created.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {user.rfqsCreated.map((rfq) => (
                            <Link
                              key={rfq.id}
                              href={`/rfqs/${rfq.id}`}
                              className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs transition hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-blue-600">
                                  {rfq.rfqNumber || "Draft RFQ"}
                                </div>
                                <div className="truncate text-slate-500">
                                  {rfq.remarks || "No remarks"}
                                </div>
                              </div>
                              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {rfq.status}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                        Recent Purchase Orders
                      </h3>
                      {user.purchaseOrdersCreated.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                          No Purchase Orders created.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {user.purchaseOrdersCreated.map((po) => (
                            <Link
                              key={po.id}
                              href={`/purchase-orders/${po.id}`}
                              className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs transition hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-blue-600">
                                  {po.poNumber || "Draft PO"}
                                </div>
                                <div className="text-slate-500">{formatCurrency(po.totalAmount)}</div>
                              </div>
                              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {po.status}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "security-log" && (
                <div>
                  {user.accountEvents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">
                      No account security events recorded yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {user.accountEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {ev.action}
                              </span>
                              <span className="text-xs text-slate-500">
                                by {ev.user.name} ({ev.user.username})
                              </span>
                            </div>
                            {ev.notes && <p className="mt-1 text-slate-700">{ev.notes}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatDateTime(ev.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity-log" && (
                <div>
                  {user.userActions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">
                      No system actions recorded for this user yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {user.userActions.map((act) => (
                        <div key={act.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                                {act.documentType}
                              </span>
                              <span className="text-xs font-semibold text-slate-700">{act.action}</span>
                            </div>
                            {act.notes && <p className="mt-1 text-slate-600">{act.notes}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatDateTime(act.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Role Permissions Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800 uppercase">
              <Shield size={16} className="text-blue-600" />
              Role & Access Scope
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">{roleInfo.summary}</p>
            <ul className="mt-3 space-y-2">
              {roleInfo.capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Account Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-800 uppercase">
              Account Controls
            </h2>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <Pencil size={15} className="text-blue-600" />
                  Edit Profile & Role
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetPwModal(true)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <KeyRound size={15} className="text-amber-600" />
                  Issue Temporary Password
                </span>
              </button>

              {isLocked && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleUnlock}
                  className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  <span className="flex items-center gap-2">
                    <Unlock size={15} />
                    Unlock Locked Account
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={isSelf}
                onClick={() => setShowToggleModal(true)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  {user.isActive ? (
                    <>
                      <UserX size={15} className="text-amber-600" />
                      Make Account Inactive
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} className="text-emerald-600" />
                      Activate Account
                    </>
                  )}
                </span>
              </button>

              <button
                type="button"
                disabled={isSelf}
                onClick={() => setShowDeleteModal(true)}
                className="flex w-full items-center justify-between rounded-xl border border-red-200 px-3.5 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={15} />
                  Delete Account
                </span>
              </button>
            </div>
            {isSelf && (
              <p className="mt-3 text-[11px] text-slate-400">
                Deactivation and deletion are disabled for your currently signed-in account.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <FormModal
          title={`Edit User Account: ${user.name}`}
          fields={editFields}
          initialValues={{
            username: user.username,
            name: user.name,
            email: user.email || "",
            role: user.role,
            officeId: user.officeId || user.office?.id || "",
          }}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Reset Password Modal */}
      {showResetPwModal && (
        <FormModal
          title={`Issue Temporary Password: ${user.name}`}
          fields={resetPasswordFields}
          initialValues={{ password: "" }}
          onClose={() => setShowResetPwModal(false)}
          onSubmit={handleResetPasswordSubmit}
          submitLabel="Issue Temporary Password"
        />
      )}

      {/* Toggle Status Confirm Modal */}
      <ConfirmModal
        isOpen={showToggleModal}
        onClose={() => setShowToggleModal(false)}
        onConfirm={handleToggleStatus}
        isLoading={actionLoading}
        title={user.isActive ? "Make Account Inactive" : "Activate User Account"}
        message={
          user.isActive
            ? `Are you sure you want to deactivate ${user.name}'s account? They will be blocked from logging in until reactivated.`
            : `Are you sure you want to activate ${user.name}'s account? They will be able to log in and access system functions.`
        }
        confirmText={user.isActive ? "Make Inactive" : "Activate Account"}
        isDestructive={user.isActive}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isLoading={actionLoading}
        title="Delete User Account"
        message={`Are you sure you want to delete ${user.name}'s account? If this user has created purchase requests or procurement documents, their account will be deactivated instead to preserve procurement audit records.`}
        confirmText="Delete Account"
        isDestructive={true}
      />
    </div>
  );
}
