"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, FileText, CheckCircle2, Clock, Truck, Package } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function AcceptancesHub() {
  const params = useParams();
  const router = useRouter();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPO();
  }, [params.id]);

  const fetchPO = async () => {
    try {
      // The API route /api/purchase-orders/[id] already includes acceptances
      const res = await fetch(`/api/purchase-orders/${params.id}`);
      if (res.ok) {
        setPo(await res.json());
      }
    } catch (e) {
      toast.error("Failed to fetch Purchase Order");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAcceptance = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/acceptances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: params.id })
      });
      if (!res.ok) throw new Error();
      const acceptance = await res.json();
      router.push(`/acceptances/${acceptance.id}`);
    } catch (e) {
      toast.error("Error creating acceptance");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoaderWave variant="page" label="Loading acceptance hub..." />;
  if (!po) return <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>PO not found</div>;

  const acceptances = po.acceptances || [];
  const reqDepartment = po.aoq?.rfq?.pr?.office?.name || "N/A";
  const poDate = po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-PH') : (po.createdAt ? new Date(po.createdAt).toLocaleDateString('en-PH') : "N/A");

  // Calculate Progress
  const itemProgress = (po.lineItems || []).map((item: any) => {
    let delivered = 0;
    // Only count finalized deliveries or just all of them. Let's count all non-draft for accuracy, or all if we want real-time even if draft.
    // The previous implementation counted from acceptanceItems. We can compute it here.
    acceptances.forEach((acc: any) => {
      if (acc.status !== "DRAFT") {
        const match = acc.lineItems?.find((ali: any) => ali.poLineItemId === item.id);
        if (match) delivered += match.quantityDelivered;
      }
    });
    const percentage = item.quantity > 0 ? Math.min(100, Math.round((delivered / item.quantity) * 100)) : 0;
    return {
      ...item,
      delivered,
      percentage
    };
  });

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "0.5rem" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <Link
          href="/acceptances"
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
              Deliveries for PO: {po.poNumber}
            </h1>
            <span className="badge" style={{ background: po.status === "COMPLETED" ? "#f0fdf4" : "#eff6ff", color: po.status === "COMPLETED" ? "#16a34a" : "#2563eb" }}>
              {po.status.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.375rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <span><strong>Supplier:</strong> {po.supplier?.name || "N/A"}</span>
            <span>&middot;</span>
            <span><strong>Date:</strong> {poDate}</span>
            <span>&middot;</span>
            <span><strong>Office:</strong> {reqDepartment}</span>
          </div>
        </div>

        <div>
          <button
            onClick={handleCreateAcceptance}
            disabled={creating || po.status === "COMPLETED"}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            New Delivery (IAR)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Progress Bars */}
        <div className="lg:col-span-1 space-y-6">
          <div className="table-container" style={{ padding: "1.5rem" }}>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} className="text-slate-500" /> Item Delivery Progress
            </h2>

            <div className="space-y-5">
              {itemProgress.map((item: any) => (
                <div key={item.id}>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[12px] font-semibold text-slate-700 line-clamp-1 truncate pr-2" title={item.description}>
                      {item.description}
                    </span>
                    <span className="text-[12px] font-bold text-slate-500 whitespace-nowrap">
                      {item.delivered} / {item.quantity} {item.unit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${item.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-right mt-1 text-slate-400 font-medium">{item.percentage}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline/Grid */}
        <div className="lg:col-span-2">
          <div className="table-container" style={{ padding: "1.5rem" }}>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Truck size={16} className="text-slate-500" /> Delivery Timeline
            </h2>

            {acceptances.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <Truck size={48} className="text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No deliveries have been recorded yet.</p>
                <p className="text-sm text-slate-400 mt-1">Click "New Delivery (IAR)" to start receiving items.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 space-y-8 py-4">
                {acceptances.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((acc: any, index: number) => {
                  const isDraft = acc.status === "DRAFT";
                  return (
                    <div key={acc.id} className="relative pl-6 md:pl-8 group">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4 border-white ${isDraft ? 'bg-amber-400' : 'bg-emerald-500'} shadow-sm`} />

                      {/* Card */}
                      <div
                        onClick={() => router.push(`/acceptances/${acc.id}`)}
                        className={`block p-5 transition-all cursor-pointer rounded-xl`}
                        style={{
                          background: "var(--color-page-bg)",
                          boxShadow: "var(--shadow-neu-drop)",
                          border: isDraft ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(255,255,255,0.4)',
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-800 text-sm">{acc.iarNumber}</h3>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider ${isDraft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {acc.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <Clock size={12} /> {new Date(acc.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1 justify-end">
                              <FileText size={13} /> {acc.invoiceNumber || "No Invoice #"}
                            </div>
                            {acc.dateReceived && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Rcvd: {new Date(acc.dateReceived).toLocaleDateString('en-PH')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick summary of items in this delivery */}
                        <div style={{ background: "var(--color-page-bg)", boxShadow: "var(--shadow-neu-inset)", padding: "0.75rem", borderRadius: "0.5rem", marginTop: "1rem" }}>
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Items in this batch:</div>
                          <div className="flex flex-wrap gap-2">
                            {acc.lineItems?.filter((li: any) => li.quantityDelivered > 0).map((li: any) => {
                              const pItem = po.lineItems?.find((pi: any) => pi.id === li.poLineItemId);
                              return (
                                <span key={li.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-slate-700" style={{ background: "var(--color-page-bg)", boxShadow: "var(--shadow-neu-drop)" }}>
                                  <span className="font-bold">{li.quantityDelivered}x</span>
                                  <span className="truncate max-w-[120px]">{pItem?.description || "Item"}</span>
                                </span>
                              );
                            })}
                            {(!acc.lineItems || acc.lineItems.every((li: any) => li.quantityDelivered === 0)) && (
                              <span className="text-xs text-slate-400 italic">No quantities specified yet</span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
