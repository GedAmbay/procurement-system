"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { Printer, Save, Send, CheckCircle2, XCircle, Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface PrLineItem {
  itemId: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

interface PRFormValues {
  officeId: string;
  fundSourceId: string;
  purpose: string;
  chargeToAccount: string;
  lineItems: PrLineItem[];
}

export default function PurchaseRequestEditor() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isNew = params.id === "new";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prData, setPrData] = useState<any>(null);

  // Options
  const [offices, setOffices] = useState<any[]>([]);
  const [fundSources, setFundSources] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<PRFormValues>({
    defaultValues: {
      officeId: user?.officeId || "",
      fundSourceId: "",
      purpose: "",
      chargeToAccount: "",
      lineItems: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchAllFields = watch();
  const watchLineItems = watch("lineItems");

  const totalAmount = watchLineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost) || 0), 0);

  useEffect(() => {
    async function loadData() {
      try {
        const [officesRes, fundsRes, itemsRes] = await Promise.all([
          fetch("/api/offices").then(r => r.json()),
          fetch("/api/fund-sources").then(r => r.json()),
          fetch("/api/items").then(r => r.json())
        ]);

        setOffices(Array.isArray(officesRes) ? officesRes : []);
        setFundSources(Array.isArray(fundsRes) ? fundsRes : []);
        setItems(Array.isArray(itemsRes) ? itemsRes : []);

        if (!isNew) {
          const prRes = await fetch(`/api/purchase-requests/${params.id}`);
          if (prRes.ok) {
            const pr = await prRes.json();
            setPrData(pr);
            reset({
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: pr.purpose || "",
              chargeToAccount: pr.chargeToAccount || "",
              lineItems: pr.lineItems.map((li: any) => ({
                itemId: li.itemId,
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitCost: li.unitCost
              }))
            });
          } else {
            toast.error("Failed to load PR");
            router.push("/purchase-requests");
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load reference data");
      } finally {
        setLoading(false);
      }
    }

    if (session) loadData();
  }, [isNew, params.id, reset, router, session]);

  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setValue(`lineItems.${index}.description`, item.description);
      setValue(`lineItems.${index}.unit`, item.unit);
      setValue(`lineItems.${index}.unitCost`, item.standardCost);
    }
  };

  const onSubmit = async (data: PRFormValues) => {
    if (data.lineItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    setSubmitting(true);
    try {
      const url = isNew ? "/api/purchase-requests" : `/api/purchase-requests/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to save");

      const result = await res.json();
      toast.success(isNew ? "PR created successfully" : "PR updated successfully");

      if (isNew) {
        router.push(`/purchase-requests/${result.id}`);
      } else {
        setPrData(result);
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/purchase-requests/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      const result = await res.json();
      setPrData(result);
      toast.success(`Status updated to ${status}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handlePrint = async () => {
    if (!isNew) {
      await fetch(`/api/purchase-requests/${params.id}/print`, { method: "POST" });
    }
    window.print();
  };

  const isReadOnly = prData && prData.status !== "DRAFT" && prData.status !== "REJECTED";

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header (No Print) */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/purchase-requests" className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {isNew ? "New Purchase Request" : `PR: ${prData?.prNumber}`}
            </h1>
            <p className="text-xs text-slate-500 font-medium">{prData?.status || "DRAFT"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handlePrint} className="btn-secondary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Printer size={16} /> Print
            </button>
          )}
          {!isReadOnly && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Save size={16} /> Save
            </button>
          )}
          {!isNew && prData?.status === "DRAFT" && (
            <button onClick={() => updateStatus("SUBMITTED")} className="btn-primary bg-blue-600 hover:bg-blue-700 text-white" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>
              <Send size={16} /> Submit
            </button>
          )}
          {!isNew && prData?.status === "SUBMITTED" && user?.role === "APPROVING_OFFICIAL" && (
            <>
              <button onClick={() => updateStatus("REJECTED")} className="btn-danger bg-red-600 hover:bg-red-700 text-white" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>
                <XCircle size={16} /> Reject
              </button>
              <button onClick={() => updateStatus("APPROVED")} className="btn-success bg-green-600 hover:bg-green-700 text-white" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>
                <CheckCircle2 size={16} /> Approve
              </button>
            </>
          )}
          {!isNew && prData?.status === "APPROVED" && (user?.role === "BAC_SECRETARIAT" || user?.role === "ADMIN") && (
            <button onClick={() => updateStatus("FOR_RFQ")} className="btn-primary bg-orange-600 hover:bg-orange-700 text-white" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>
              Create RFQ
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Live Print Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-8 print:p-0 print:bg-white print:overflow-visible">
          <div className="print-area max-w-[800px] mx-auto bg-white shadow-xl min-h-[1056px] p-10 print:shadow-none print:max-w-none print:m-0">
            {/* PR Standard Form Layout */}
            <div className="text-center mb-6">
              <h2 className="font-bold text-xl uppercase">Purchase Request</h2>
              <div className="text-sm font-semibold mt-1">
                {LGU_INFO.name}, {LGU_INFO.province}
              </div>
            </div>

            <div className="grid grid-cols-2 border-2 border-black mb-4 text-sm">
              <div className="border-r-2 border-black p-2">
                <div className="flex mb-1"><span className="w-24 font-bold">Department:</span> <span className="border-b border-black flex-1 text-center">{offices.find(o => o.id === watchAllFields.officeId)?.name || "\u00A0"}</span></div>
                <div className="flex mb-1"><span className="w-24 font-bold">Section:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
              </div>
              <div className="p-2">
                <div className="flex mb-1"><span className="w-16 font-bold">PR No.:</span> <span className="border-b border-black flex-1 text-center font-mono font-bold text-red-600">{prData?.prNumber || "PENDING"}</span></div>
                <div className="flex mb-1"><span className="w-16 font-bold">Date:</span> <span className="border-b border-black flex-1 text-center">{new Date().toLocaleDateString("en-PH")}</span></div>
                <div className="flex mb-1"><span className="w-16 font-bold">SAI No.:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
              </div>
            </div>

            <table className="w-full border-collapse border-2 border-black text-sm mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1">Item No.</th>
                  <th className="border border-black p-1">Unit</th>
                  <th className="border border-black p-1 w-1/3">Item Description</th>
                  <th className="border border-black p-1">Qty</th>
                  <th className="border border-black p-1">Unit Cost</th>
                  <th className="border border-black p-1">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {watchLineItems.length > 0 ? watchLineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                    <td className="border border-black p-1 text-center">{item.unit}</td>
                    <td className="border border-black p-1">{item.description}</td>
                    <td className="border border-black p-1 text-center">{item.quantity}</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(item.unitCost || 0).replace('₱', '')}</td>
                    <td className="border border-black p-1 text-right font-semibold">{formatCurrency((item.quantity || 0) * (item.unitCost || 0)).replace('₱', '')}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="border border-black p-4 text-center text-gray-400 italic">No items added yet.</td></tr>
                )}
                {/* Empty rows to fill space */}
                {Array.from({ length: Math.max(0, 10 - watchLineItems.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border border-black p-3"></td>
                    <td className="border border-black p-3"></td>
                    <td className="border border-black p-3"></td>
                    <td className="border border-black p-3"></td>
                    <td className="border border-black p-3"></td>
                    <td className="border border-black p-3"></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="border border-black p-1 font-bold text-right pr-4">GRAND TOTAL</td>
                  <td className="border border-black p-1 font-bold text-right">{formatCurrency(totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="border-2 border-black p-2 mb-6 text-sm">
              <span className="font-bold">Purpose: </span>
              <span className="border-b border-black inline-block min-w-[80%] px-2">
                {watchAllFields.purpose || "\u00A0"}
              </span>
            </div>

            <div className="grid grid-cols-3 border-2 border-black text-sm text-center">
              <div className="p-2 border-r border-black">
                <div className="text-left font-bold mb-8">Requested by:</div>
                <div className="border-b border-black mx-4 mb-1 font-bold uppercase">{prData?.requestedBy?.name || user?.name || "____________________"}</div>
                <div className="text-xs">End User</div>
              </div>
              <div className="p-2 border-r border-black">
                <div className="text-left font-bold mb-8">Funds Available:</div>
                <div className="border-b border-black mx-4 mb-1 font-bold uppercase">____________________</div>
                <div className="text-xs">Municipal Budget Officer</div>
              </div>
              <div className="p-2">
                <div className="text-left font-bold mb-8">Approved by:</div>
                <div className="border-b border-black mx-4 mb-1 font-bold uppercase">____________________</div>
                <div className="text-xs">{LGU_INFO.mayorRole}</div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Data Entry Form (No Print) */}
        <div className="no-print w-[500px] border-l border-slate-200 bg-white overflow-y-auto flex flex-col">
          <div className="p-6 flex-1">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">PR Details</h3>

            <form className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Requesting Office</label>
                <select
                  {...register("officeId")}
                  className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-sm"
                  disabled={isReadOnly}
                >
                  <option value="">Select Office...</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Fund Source</label>
                <select
                  {...register("fundSourceId")}
                  className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-sm"
                  disabled={isReadOnly}
                >
                  <option value="">Select Fund Source...</option>
                  {fundSources.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose</label>
                <textarea
                  {...register("purpose")}
                  className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-sm min-h-[80px]"
                  placeholder="Enter purpose of procurement..."
                  disabled={isReadOnly}
                />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">Line Items</h3>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => append({ itemId: "", description: "", unit: "pcs", quantity: 1, unitCost: 0 })}
                      className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md font-semibold flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative group">
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      <div className="grid grid-cols-12 gap-3 mb-3">
                        <div className="col-span-12">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Catalog Item (Optional)</label>
                          <select
                            {...register(`lineItems.${index}.itemId`)}
                            onChange={(e) => handleItemSelect(index, e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
                            disabled={isReadOnly}
                          >
                            <option value="">-- Custom Item --</option>
                            {items.map(item => (
                              <option key={item.id} value={item.id}>{item.description}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-12">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                          <input
                            {...register(`lineItems.${index}.description`)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
                          <input
                            {...register(`lineItems.${index}.unit`)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Qty</label>
                          <input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.quantity`)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white text-right"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            {...register(`lineItems.${index}.unitCost`)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white text-right"
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>
                      <div className="text-right text-sm font-bold text-emerald-600 border-t border-slate-200 pt-2">
                        Total: {formatCurrency((watch(`lineItems.${index}.quantity`) || 0) * (watch(`lineItems.${index}.unitCost`) || 0))}
                      </div>
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm">
                      No line items added.<br />Click "Add Item" to start.
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 sticky bottom-0">
            <div className="flex justify-between items-center text-lg font-bold text-slate-800">
              <span>Grand Total:</span>
              <span className="text-emerald-600">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
