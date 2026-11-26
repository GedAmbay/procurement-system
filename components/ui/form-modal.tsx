"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CustomSelect from "@/components/ui/custom-select";

interface FormField {
  key: string;
  label: string;
  type?: "text" | "email" | "number" | "select" | "textarea" | "password";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
  halfWidth?: boolean;
  rows?: number;
}

interface FormModalProps {
  title: string;
  fields: FormField[];
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  initialValues?: any;
  submitLabel?: string;
  showCancel?: boolean;
  maxWidth?: string;
}

export default function FormModal({
  title,
  fields,
  onClose,
  onSubmit,
  initialValues = {},
  submitLabel = "Save",
  showCancel = false,
  maxWidth,
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of fields) {
      init[field.key] = String(initialValues[field.key] ?? field.defaultValue ?? "");
    }
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        errs[field.key] = `${field.label} is required`;
      }
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const hasHalfWidth = fields.some((f) => f.halfWidth);

  const modalContent = (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal-box" style={{ maxWidth: maxWidth ?? (hasHalfWidth ? "580px" : "460px") }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexShrink: 0 }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              display: "flex",
              padding: "0.25rem",
              borderRadius: "9999px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: hasHalfWidth ? "repeat(2, minmax(0, 1fr))" : "1fr",
              gap: "0.875rem 1rem",
              overflowY: "auto",
              paddingRight: "0.125rem",
            }}
          >
            {fields.map((field) => {
              const value = values[field.key] ?? "";
              const isFocused = focusedKey === field.key;
              const isFloating = isFocused || value.length > 0;
              const hasError = Boolean(errors[field.key]);
              const inputId = `modal-field-${field.key}`;

              const baseFieldStyle: React.CSSProperties = {
                width: "100%",
                border: hasError
                  ? "2px solid #ef4444"
                  : isFocused
                  ? "2px solid #0f172a"
                  : "2px solid transparent",
                borderRadius: "0.625rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#0f172a",
                background: isFocused ? "#ffffff" : "#ECF0F3",
                outline: "none",
                boxSizing: "border-box",
                boxShadow: isFocused
                  ? "none"
                  : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                transition: "all 0.16s ease-in-out",
              };

              const labelStyle: React.CSSProperties = {
                position: "absolute",
                left: "0.875rem",
                top: isFloating ? "0.45rem" : field.type === "textarea" ? "1rem" : "50%",
                transform: isFloating || field.type === "textarea" ? "translateY(0)" : "translateY(-50%)",
                fontSize: isFloating ? "0.625rem" : "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: hasError ? "#ef4444" : isFocused ? "#0f172a" : "#64748b",
                pointerEvents: "none",
                transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
              };

              return (
                <div key={field.key} style={{ gridColumn: hasHalfWidth && !field.halfWidth ? "1 / -1" : undefined }}>
                  {field.type === "select" ? (
                    <CustomSelect
                      id={inputId}
                      value={value}
                      onChange={(val) => {
                        setValues({ ...values, [field.key]: val });
                        setErrors({ ...errors, [field.key]: "" });
                      }}
                      options={field.options ?? []}
                      placeholder={field.placeholder || "Select an option..."}
                      floatingLabel={field.label}
                      required={field.required}
                      hasError={hasError}
                    />
                  ) : (
                    <div style={{ position: "relative" }}>
                      {field.type === "textarea" ? (
                        <textarea
                          id={inputId}
                          value={value}
                          onFocus={() => setFocusedKey(field.key)}
                          onBlur={() => setFocusedKey((prev) => (prev === field.key ? null : prev))}
                          onChange={(e) => { setValues({ ...values, [field.key]: e.target.value }); setErrors({ ...errors, [field.key]: "" }); }}
                          placeholder={isFocused ? field.placeholder : " "}
                          rows={field.rows ?? 2}
                          style={{
                            ...baseFieldStyle,
                            minHeight: "84px",
                            padding: "1.4rem 0.875rem 0.5rem",
                            resize: "vertical",
                          }}
                        />
                      ) : (
                        <input
                          id={inputId}
                          type={field.type ?? "text"}
                          value={value}
                          onFocus={() => setFocusedKey(field.key)}
                          onBlur={() => setFocusedKey((prev) => (prev === field.key ? null : prev))}
                          onChange={(e) => { setValues({ ...values, [field.key]: e.target.value }); setErrors({ ...errors, [field.key]: "" }); }}
                          placeholder={isFocused ? field.placeholder : " "}
                          style={{
                            ...baseFieldStyle,
                            height: "54px",
                            padding: "1.25rem 0.875rem 0.4rem",
                          }}
                        />
                      )}
                      <label htmlFor={inputId} style={labelStyle}>
                        {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                      </label>
                    </div>
                  )}
                  {errors[field.key] && <div className="form-error">{errors[field.key]}</div>}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
            {showCancel && (
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.75rem",
                fontWeight: 700,
              }}
            >
              {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving...</> : submitLabel}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
