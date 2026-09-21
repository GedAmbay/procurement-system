"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Building2, FileCheck2, Loader2, Send,
  CheckCircle2, Clock, AlertCircle, Printer, ChevronRight, X, Calendar
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function AoqSupplierHub() {
  const params = useParams();
  const router = useRouter();
  const [aoq, setAoq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [selectedNewSupplier, setSelectedNewSupplier] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/abstract/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setAoq(data);
      }
      const supRes = await fetch("/api/suppliers");
      if (supRes.ok) setAllSuppliers(await supRes.json());
    } catch (e) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async () => {
    if (!selectedNewSupplier || !aoq?.rfq) return;
    if (quotations.length >= 3) {
      toast.error("Maximum of 3 suppliers allowed");
      return;
    }
    setAddingSupplier(true);
    try {
      const res = await fetch(`/api/rfqs/${aoq.rfq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: selectedNewSupplier })
      });
      if (res.ok) {
        toast.success("Supplier added");
        setSelectedNewSupplier("");
        setShowAddSupplier(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add supplier");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setAddingSupplier(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/abstract/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success("Status updated");
        fetchData();
      }
    } catch (e) {
      toast.error("Update failed");
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#2563eb" }} />
    </div>
  );
  if (!aoq || !aoq.rfq) return <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Abstract not found</div>;

  const rfq = aoq.rfq;
  const quotations = rfq.quotations || [];
  const completedCount = quotations.filter((q: any) => q.totalAmount > 0).length;
  const totalItems = rfq.lineItems?.length || 0;

  const availableSuppliers = allSuppliers.filter(
    s => !quotations.some((q: any) => q.supplierId === s.id)
  );

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT: { bg: "#fef3c7", color: "#b45309", label: "Draft" },
    RECOMMENDED: { bg: "#eff6ff", color: "#2563eb", label: "Recommended" },
    APPROVED: { bg: "#f0fdf4", color: "#16a34a", label: "Approved" },
  };
  const statusStyle = statusConfig[aoq.status] ?? { bg: "#f1f5f9", color: "#475569", label: aoq.status };

  const validBids = quotations.filter((q: any) => q.totalAmount > 0);
  const lowestBid = validBids.length > 0 ? Math.min(...validBids.map((q: any) => q.totalAmount)) : null;

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "2rem" }}>

      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <Link
          href="/abstract"
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.375rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              {aoq.aoqNumber}
            </h1>
            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {statusStyle.label}
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
            {rfq.pr?.office?.name} &nbsp;&middot;&nbsp; {totalItems} item{totalItems !== 1 ? "s" : ""}
            &nbsp;&middot;&nbsp; ABC: <strong style={{ color: "#059669" }}>{formatCurrency(rfq.pr?.totalAmount)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }} onClick={() => router.push(`/abstract/${params.id}/print`)}>
            <Printer size={14} /> Open Abstract
          </button>
          {aoq.status === "DRAFT" && quotations.length > 0 && completedCount > 0 && (
            <button onClick={() => updateStatus("RECOMMENDED")} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Send size={15} /> Recommend
            </button>
          )}
          {aoq.status === "RECOMMENDED" && (
            <button onClick={() => updateStatus("APPROVED")} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#16a34a" }}>
              <FileCheck2 size={15} /> Approve
            </button>
          )}
        </div>
      </div>

      {/* Progress Summary Bar */}
      <div className="table-container" style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Suppliers</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0f172a" }}>{quotations.length}</div>
          </div>
          <div style={{ width: "1px", height: "36px", background: "#e2e8f0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Returned</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "800", color: completedCount === 3 ? "#16a34a" : "#0f172a" }}>
              {completedCount}<span style={{ fontSize: "1rem", color: "#94a3b8" }}>/3</span>
            </div>
          </div>
          <div style={{ width: "1px", height: "36px", background: "#e2e8f0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Lowest Bid</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#059669" }}>
              {lowestBid !== null ? formatCurrency(lowestBid) : <span style={{ color: "#cbd5e1", fontSize: "1rem" }}>No bids yet</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Suppliers Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#334155", margin: 0 }}>
          Supplier Quotations {quotations.length >= 3 && <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "400", marginLeft: "0.5rem" }}>(Max 3 reached)</span>}
        </h2>
        {aoq.status === "DRAFT" && quotations.length < 3 && (
          <button
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
            onClick={() => setShowAddSupplier(v => !v)}
          >
            {showAddSupplier ? <X size={14} /> : <Plus size={14} />}
            {showAddSupplier ? "Cancel" : "Add Supplier"}
          </button>
        )}
      </div>

      {/* Add Supplier Inline Panel */}
      {showAddSupplier && (
        <div className="table-container" style={{ marginBottom: "1rem", padding: "1.125rem 1.25rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Building2 size={18} style={{ color: "#94a3b8", flexShrink: 0 }} />
            <select
              value={selectedNewSupplier}
              onChange={e => setSelectedNewSupplier(e.target.value)}
              className="form-select"
              style={{ flex: 1 }}
            >
              <option value="">— Select a supplier to add —</option>
              {availableSuppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={addSupplier}
              disabled={!selectedNewSupplier || addingSupplier}
              className="btn btn-primary"
            >
              {addingSupplier ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Supplier Cards */}
      {quotations.length === 0 ? (
        <div className="table-container" style={{ padding: "3rem", textAlign: "center" }}>
          <Building2 size={40} style={{ color: "#cbd5e1", margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: "600", color: "#64748b", margin: "0 0 0.25rem" }}>No suppliers added yet</p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>Click "Add Supplier" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quotations.map((q: any) => {
            const isEncoded = q.totalAmount > 0;
            const isLowest = lowestBid !== null && q.totalAmount === lowestBid && isEncoded;

            return (
              <div
                key={q.id}
                onClick={() => router.push(`/abstract/${aoq.id}/supplier/${q.id}`)}
                className={`bg-white rounded-xl border-2 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col ${isLowest ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2.5 rounded-lg shrink-0 ${isLowest ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight">{q.supplier.name}</h3>
                    <div className="text-xs text-slate-500 mt-1">{q.supplier.contactPerson || "No contact info"}</div>
                    {isLowest && (
                      <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        ★ Lowest Bid
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-auto space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-1"><Calendar size={14} /> Received</span>
                    <span className="font-medium text-slate-700">
                      {q.submittedAt ? new Date(q.submittedAt).toLocaleDateString('en-PH') : <span className="text-amber-600 flex items-center gap-1"><Clock size={12} /> Pending</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-1"><FileCheck2 size={14} /> Bid Amount</span>
                    <span className={`font-bold ${isEncoded ? "text-emerald-600" : "text-slate-400"}`}>
                      {isEncoded ? formatCurrency(q.totalAmount) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}