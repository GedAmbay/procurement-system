"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  key: string;
  label: string;
  type?: "text" | "email" | "number" | "select" | "textarea" | "password";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
}

interface FormModalProps {
  title: string;
  fields: FormField[];
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  initialValues?: Record<string, string | number | boolean | null | undefined>;
  submitLabel?: string;
}

export default function FormModal({
  title,
  fields,
  onClose,
  onSubmit,
  initialValues = {},
  submitLabel = "Save",
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: "520px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "1.0625rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {fields.map((field) => (
              <div key={field.key}>
                <label className="form-label">
                  {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    className="form-select"
                    value={values[field.key]}
                    onChange={(e) => { setValues({ ...values, [field.key]: e.target.value }); setErrors({ ...errors, [field.key]: "" }); }}
                  >
                    <option value="">— Select —</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    className="form-input"
                    value={values[field.key]}
                    onChange={(e) => { setValues({ ...values, [field.key]: e.target.value }); setErrors({ ...errors, [field.key]: "" }); }}
                    placeholder={field.placeholder}
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                ) : (
                  <input
                    type={field.type ?? "text"}
                    className="form-input"
                    value={values[field.key]}
                    onChange={(e) => { setValues({ ...values, [field.key]: e.target.value }); setErrors({ ...errors, [field.key]: "" }); }}
                    placeholder={field.placeholder}
                  />
                )}
                {errors[field.key] && <div className="form-error">{errors[field.key]}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving...</> : submitLabel}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
