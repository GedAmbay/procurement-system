"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { ArrowLeft, Save, Loader2, Building2, CheckCircle2, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface QuoteLineItem {
  id: string;
  rfqLineItemId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteFormValues {
  submittedAt: string;
  remarks: string;
  lineItems: QuoteLineItem[];
}

export default function SupplierEncodingPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [aoqStatus, setAoqStatus] = useState<string>("DRAFT");

  const { register, control, handleSubmit, watch, reset } = useForm<QuoteFormValues>({
    defaultValues: { submittedAt: "", remarks: "", lineItems: [] }
  });

  const { fields } = useFieldArray({ control, name: "lineItems" });
  const watchLineItems = watch("lineItems");
  const totalAmount = watchLineItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0
  );

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/rfqs/${params.supplierId}`);
        if (res.ok) {
          const data = await res.json();
          setQuoteData(data);

          const aoqRes = await fetch(`/api/abstract/${params.id}`);
          if (aoqRes.ok) {
            const aoqData = await aoqRes.json();
            setAoqStatus(aoqData.status);
          }

          const mappedLineItems = data.rfq.lineItems.map((rfqItem: any) => {
            const quoteItem = data.lineItems.find((q: any) => q.rfqLineItemId === rfqItem.id);
            return {
              id: quoteItem?.id || "",
              rfqLineItemId: rfqItem.id,
              description: rfqItem.description,
              unit: rfqItem.unit,
              quantity: rfqItem.quantity,
              unitPrice: quoteItem?.unitPrice || 0,
            };
          });

          reset({
            submittedAt: data.submittedAt ? new Date(data.submittedAt).toISOString().split("T")[0] : "",
            remarks: data.remarks || "",
            lineItems: mappedLineItems,
          });
        }
      } catch (err) {
        toast.error("Failed to load quotation data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.supplierId, params.id, reset]);

  const onSubmit = async (data: QuoteFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        lineItems: data.lineItems.map(item => ({
          id: item.id,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.quantity) * Number(item.unitPrice),
        }))
      };

      const res = await fetch(`/api/rfqs/${params.supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Bid encoded successfully");
        router.push(`/abstract/${params.id}`);
      } else {
        toast.error("Failed to save quotation");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#2563eb" }} />
    </div>
  );
  if (!quoteData) return <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Error loading data</div>;

  const { rfq, supplier } = quoteData;
  const isReadOnly = aoqStatus !== "DRAFT";
  const abc = rfq.pr?.totalAmount || 0;
  const isOverBudget = totalAmount > abc && abc > 0;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <Link
          href={`/abstract/${params.id}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "38px", height: "38px", borderRadius: "50%",
            background: "var(--color-page-bg)",
            boxShadow: "var(--shadow-neu-drop)",
            color: "#64748b", flexShrink: 0, textDecoration: "none",
          }}
        >
          <ArrowLeft size={18} />
        </Link>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Building2 size={16} style={{ color: "#fff" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                {supplier.name}
              </h1>
              <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                RFQ {rfq.rfqNumber} &nbsp;&middot;&nbsp; {rfq.pr?.office?.name}
              </div>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {submitting
              ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              : <Save size={16} />
            }
            Save Bid
          </button>
        )}
        {isReadOnly && (
          <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Read-only
          </span>
        )}
      </div>

      {/* Meta Row */}
      <div className="table-container" style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>ABC</div>
            <div style={{ fontSize: "1.125rem", fontWeight: "800", color: "#059669" }}>{formatCurrency(abc)}</div>
          </div>
          <div style={{ width: "1px", height: "36px", background: "#e2e8f0" }} />
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Total Bid</div>
            <div style={{ fontSize: "1.125rem", fontWeight: "800", color: isOverBudget ? "#dc2626" : totalAmount > 0 ? "#0f172a" : "#94a3b8" }}>
              {totalAmount > 0 ? formatCurrency(totalAmount) : "—"}
              {isOverBudget && <span style={{ fontSize: "0.75rem", marginLeft: "0.5rem", color: "#dc2626" }}>Over budget</span>}
            </div>
          </div>
          <div style={{ width: "1px", height: "36px", background: "#e2e8f0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Calendar size={12} /> Date Received
            </label>
            <input
              type="date"
              {...register("submittedAt")}
              disabled={isReadOnly}
              style={{
                border: "none", background: "transparent",
                fontSize: "0.875rem", fontWeight: "600", color: "#334155",
                outline: "none", cursor: isReadOnly ? "default" : "pointer",
              }}
            />
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="table-container" style={{ padding: "1.5rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: "700", color: "#334155", margin: "0 0 1.25rem" }}>
          Line Items &nbsp;<span style={{ fontWeight: "400", color: "#94a3b8", fontSize: "0.875rem" }}>— enter unit prices from the returned quotation</span>
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "48px", textAlign: "center" }}>#</th>
                <th style={{ textAlign: "left" }}>Item Description</th>
                <th style={{ width: "80px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "80px", textAlign: "center" }}>Unit</th>
                <th style={{ width: "160px", textAlign: "right" }}>Unit Price</th>
                <th style={{ width: "160px", textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => {
                const qty = Number(watchLineItems[idx]?.quantity || 0);
                const price = Number(watchLineItems[idx]?.unitPrice || 0);
                const lineTotal = qty * price;

                return (
                  <tr key={field.id}>
                    <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: "600" }}>{idx + 1}</td>
                    <td style={{ color: "#0f172a", fontWeight: "500" }}>{field.description}</td>
                    <td style={{ textAlign: "center", color: "#334155" }}>{field.quantity}</td>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{field.unit}</td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      {isReadOnly ? (
                        <span style={{ fontWeight: "600", color: price > 0 ? "#0f172a" : "#cbd5e1" }}>
                          {price > 0 ? formatCurrency(price) : "—"}
                        </span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                          <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${idx}.unitPrice`)}
                            placeholder="0.00"
                            style={{
                              width: "110px",
                              padding: "0.375rem 0.5rem",
                              border: "none",
                              borderRadius: "0.5rem",
                              background: "var(--color-page-bg)",
                              boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)",
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              color: "#0f172a",
                              textAlign: "right",
                              outline: "none",
                            }}
                            onFocus={e => e.target.select()}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "700", color: lineTotal > 0 ? "#059669" : "#cbd5e1" }}>
                      {lineTotal > 0 ? formatCurrency(lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: "right", fontWeight: "700", color: "#334155", padding: "1rem 0.5rem", borderTop: "2px solid #e2e8f0", fontSize: "0.9375rem" }}>
                  Grand Total
                </td>
                <td style={{ textAlign: "right", fontWeight: "800", color: isOverBudget ? "#dc2626" : "#059669", padding: "1rem 0.5rem", borderTop: "2px solid #e2e8f0", fontSize: "1rem" }}>
                  {totalAmount > 0 ? formatCurrency(totalAmount) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks */}
        <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid #e2e8f0" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
            Remarks / Notes
          </label>
          <textarea
            {...register("remarks")}
            disabled={isReadOnly}
            placeholder="Optional notes about this quotation..."
            rows={3}
            style={{
              width: "100%", padding: "0.75rem",
              border: "none", borderRadius: "0.75rem",
              background: "var(--color-page-bg)",
              boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)",
              fontSize: "0.875rem", color: "#334155",
              resize: "vertical", outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {!isReadOnly && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={submitting}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {submitting
                ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                : <Save size={16} />
              }
              Save Bid
            </button>
          </div>
        )}
      </div>
    </div>
  );
}