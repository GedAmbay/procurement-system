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
  requirePassword = false,
  isLoading = false,
}: ConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);

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

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[1.25rem] border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.15)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {isDestructive ? <AlertTriangle size={24} /> : requirePassword ? <Lock size={24} /> : <CheckCircle2 size={24} />}
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-600 mb-6">{message}</p>

          {requirePassword && (
            <div className="mb-6" style={{ position: "relative" }}>
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
                  height: "54px",
                  padding: "1.25rem 0.875rem 0.4rem",
                  border: passwordFocused ? "2px solid #0f172a" : "2px solid transparent",
                  borderRadius: "0.625rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "#0f172a",
                  background: passwordFocused ? "#ffffff" : "#ECF0F3",
                  outline: "none",
                  boxSizing: "border-box",
                  boxShadow: passwordFocused
                    ? "none"
                    : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                  transition: "all 0.16s ease-in-out",
                }}
              />
              <label
                htmlFor="confirm-modal-password"
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: passwordFocused || password.length > 0 ? "0.45rem" : "50%",
                  transform: passwordFocused || password.length > 0 ? "translateY(0)" : "translateY(-50%)",
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

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || (requirePassword && !password)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : null}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
