"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Building2, Calendar, FileCheck2, Loader2, Send, Clock } from "lucide-react";
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

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/aoq/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setAoq(data);
      }

      const supRes = await fetch("/api/suppliers");
      if (supRes.ok) {
        setAllSuppliers(await supRes.json());
      }
    } catch (e) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async () => {
    if (!selectedNewSupplier || !aoq?.rfq) return;
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
      const res = await fetch(`/api/aoq/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
        fetchData();
      }
    } catch (e) {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!aoq || !aoq.rfq) return <div className="p-8 text-center text-slate-500">AOQ not found</div>;

  const rfq = aoq.rfq;
  const quotations = rfq.quotations || [];

  // Filter out suppliers that are already added to show in the dropdown
  const availableSuppliers = allSuppliers.filter(
    s => !quotations.some((q: any) => q.supplierId === s.id)
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/aoq" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Abstract of Quotation</h1>
          <div className="text-sm text-slate-500 font-mono mt-1">{aoq.aoqNumber} • Status: <strong className="text-slate-700">{aoq.status.replace(/_/g, ' ')}</strong></div>
        </div>

        <div className="ml-auto flex gap-2">
          {aoq.status === "DRAFT" && quotations.length > 0 && (
            <button onClick={() => updateStatus("RECOMMENDED")} className="btn-primary flex items-center gap-2">
              <Send size={16} /> Mark as Recommended
            </button>
          )}
          {aoq.status === "RECOMMENDED" && (
            <button onClick={() => updateStatus("APPROVED")} className="btn-success flex items-center gap-2">
              <FileCheck2 size={16} /> Mark Approved
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-700">Purchase Request Details</h2>
        </div>
        <div className="p-6 grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Requesting Office</div>
            <div className="font-medium text-slate-800">{rfq.pr?.office?.name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Approved Budget (ABC)</div>
            <div className="font-bold text-emerald-600 text-lg">{formatCurrency(rfq.pr?.totalAmount)}</div>
          </div>
          <div className="col-span-3">
            <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Purpose</div>
            <div className="text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100">{rfq.pr?.purpose}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Supplier Quotations ({quotations.length})</h2>
        {aoq.status === "DRAFT" && (
          <div className="flex gap-2">
            <select
              value={selectedNewSupplier}
              onChange={(e) => setSelectedNewSupplier(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white min-w-[200px]"
            >
              <option value="">-- Select Supplier to Add --</option>
              {availableSuppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={addSupplier}
              disabled={!selectedNewSupplier || addingSupplier}
              className="btn-primary flex items-center gap-1 px-3 py-2"
            >
              {addingSupplier ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
            </button>
          </div>
        )}
      </div>

      {quotations.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500">
          <Building2 size={48} className="mb-4 opacity-20" />
          <p className="font-medium">No suppliers added yet.</p>
          <p className="text-sm mt-1">Select a supplier from the dropdown above to add their quotation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quotations.map((q: any) => (
            <div
              key={q.id}
              onClick={() => router.push(`/aoq/${aoq.id}/supplier/${q.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight">{q.supplier.name}</h3>
                  <div className="text-xs text-slate-500 mt-1">{q.supplier.contactPerson || "No contact info"}</div>
                </div>
              </div>

              <div className="mt-auto space-y-3 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-1"><Calendar size={14} /> Received</span>
                  <span className="font-medium text-slate-700">
                    {q.submittedAt ? new Date(q.submittedAt).toLocaleDateString('en-PH') : <span className="text-amber-600 italic">Pending</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-1"><FileCheck2 size={14} /> Bid Amount</span>
                  <span className={`font-bold ${q.totalAmount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {q.totalAmount > 0 ? formatCurrency(q.totalAmount) : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
