"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Lock, CheckCircle2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  variant?: "default" | "destructive" | "warning";
  requirePassword?: boolean;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  variant,
  requirePassword = false,
  isLoading = false,
}: ConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);

  const resolvedVariant = variant ?? (isDestructive ? "destructive" : "default");

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const pwd = password;
    setPassword("");
    onConfirm(requirePassword ? pwd : undefined);
  };

  const stylesByVariant = {
    destructive: {
      accentBar: "from-red-500 via-rose-500 to-red-600",
      iconWrap: "bg-red-50 text-red-600 ring-4 ring-red-50/70 border border-red-100",
      confirmBtn:
        "bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-sm shadow-red-600/20 focus-visible:ring-red-500",
    },
    warning: {
      accentBar: "from-amber-400 via-orange-500 to-amber-500",
      iconWrap: "bg-amber-50 text-amber-600 ring-4 ring-amber-50/70 border border-amber-100",
      confirmBtn:
        "bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-sm shadow-amber-600/20 focus-visible:ring-amber-500",
    },
    default: {
      accentBar: "from-blue-500 via-indigo-500 to-blue-600",
      iconWrap: "bg-blue-50 text-blue-600 ring-4 ring-blue-50/70 border border-blue-100",
      confirmBtn:
        "bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-sm shadow-blue-600/20 focus-visible:ring-blue-500",
    },
  }[resolvedVariant];

  const renderIcon = () => {
    if (resolvedVariant === "destructive" || resolvedVariant === "warning") {
      return <AlertTriangle size={22} strokeWidth={2.2} />;
    }
    if (requirePassword) {
      return <Lock size={22} strokeWidth={2.2} />;
    }
    return <CheckCircle2 size={22} strokeWidth={2.2} />;
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !isLoading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${stylesByVariant.accentBar}`} />

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${stylesByVariant.iconWrap}`}
            >
              {renderIcon()}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3
                  id="confirm-modal-title"
                  className="text-lg font-bold text-slate-900 tracking-tight leading-snug"
                >
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  aria-label="Close modal"
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 -mt-1 -mr-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</p>
            </div>
          </div>

          {requirePassword && (
            <div className="mt-5" style={{ position: "relative" }}>
              <input
                id="confirm-modal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading && password) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder=" "
                autoFocus
                style={{
                  width: "100%",
                  height: "52px",
                  padding: "1.2rem 0.875rem 0.35rem",
                  border: passwordFocused ? "2px solid #0f172a" : "1.5px solid #cbd5e1",
                  borderRadius: "0.75rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "#0f172a",
                  background: passwordFocused ? "#ffffff" : "#f8fafc",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "all 0.16s ease-in-out",
                }}
              />
              <label
                htmlFor="confirm-modal-password"
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: passwordFocused || password.length > 0 ? "0.4rem" : "50%",
                  transform:
                    passwordFocused || password.length > 0 ? "translateY(0)" : "translateY(-50%)",
                  fontSize: passwordFocused || password.length > 0 ? "0.625rem" : "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: passwordFocused ? "#0f172a" : "#64748b",
                  pointerEvents: "none",
                  transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                Enter your password to continue
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || (requirePassword && !password)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 cursor-pointer ${stylesByVariant.confirmBtn}`}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
