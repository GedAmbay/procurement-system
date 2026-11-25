"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const mustChange = Boolean((session?.user as any)?.mustChangePassword);
  const username = (session?.user as any)?.username || session?.user?.name || "";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checks = [
    { label: "At least 10 characters", ok: newPassword.length >= 10 },
    { label: "Uppercase & lowercase letters", ok: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) },
    { label: "At least one number or symbol", ok: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword) },
    { label: "Matches confirmation", ok: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update password.");
        setLoading(false);
        return;
      }

      await update();
      toast.success("Password updated successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "var(--full-vh)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ECF0F3",
        padding: "1.5rem",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "1.25rem",
          padding: "2rem",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: mustChange ? "#fef3c7" : "#eff6ff",
              color: mustChange ? "#d97706" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {mustChange ? "Password Change Required" : "Change Password"}
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.15rem 0 0" }}>
              Account: <strong>{username}</strong>
            </p>
          </div>
        </div>

        {mustChange && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              fontSize: "0.8125rem",
              color: "#92400e",
              marginBottom: "1.25rem",
              lineHeight: 1.45,
            }}
          >
            Your account is using a temporary or reset password. Set a personal password before continuing.
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#dc2626",
              fontSize: "0.8125rem",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="form-label">Current / Temporary Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Minimum 10 characters"
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Confirm New Password</label>
            <input
              type={showNew ? "text" : "password"}
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
            />
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {checks.map((c) => (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.75rem",
                  color: c.ok ? "#16a34a" : "#64748b",
                  fontWeight: c.ok ? 600 : 400,
                }}
              >
                <CheckCircle2 size={13} style={{ color: c.ok ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                <span>{c.label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "0.75rem",
              fontWeight: 700,
              marginTop: "0.25rem",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Updating Password...
              </>
            ) : (
              <>
                <Lock size={16} /> Save New Password
              </>
            )}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          {!mustChange ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: "0.8125rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ← Back to Dashboard
            </button>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Need help? Contact System Admin
            </span>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "none",
              border: "none",
              color: "#ef4444",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
