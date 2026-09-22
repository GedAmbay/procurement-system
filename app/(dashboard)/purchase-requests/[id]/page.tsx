"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { Printer, Save, Send, CheckCircle2, XCircle, Plus, Trash2, ArrowLeft, Loader2, ZoomIn, ZoomOut, Lock, Unlock } from "lucide-react";
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
  requestedBySignatoryId: string;
  lineItems: PrLineItem[];
}

export default function PurchaseRequestEditor() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isNew = params.id === "new";
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prData, setPrData] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Options
  const [offices, setOffices] = useState<any[]>([]);
  const [fundSources, setFundSources] = useState<any[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<PRFormValues>({
    defaultValues: {
      officeId: user?.officeId || "",
      fundSourceId: "",
      purpose: "",
      chargeToAccount: "",
      requestedBySignatoryId: "",
      lineItems: [],
    }
  });

  const watchAllFields = watch();
  const watchLineItems = watch("lineItems");
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "lineItems",
  });

  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState<PrLineItem>({
    itemId: "",
    description: "",
    unit: "Piece",
    quantity: 1,
    unitCost: 0,
  });

  const totalAmount = watchLineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost) || 0), 0);

  useEffect(() => {
    async function loadData() {
      try {
        const [officesRes, fundsRes, itemsRes, signatoriesRes] = await Promise.all([
          fetch("/api/offices").then(r => r.json()),
          fetch("/api/fund-sources").then(r => r.json()),
          fetch("/api/items").then(r => r.json()),
          fetch("/api/signatories").then(r => r.json())
        ]);

        setOffices(Array.isArray(officesRes) ? officesRes : []);
        setFundSources(Array.isArray(fundsRes) ? fundsRes : []);
        setItems(Array.isArray(itemsRes) ? itemsRes : []);
        setSignatories(Array.isArray(signatoriesRes) ? signatoriesRes : []);

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
              requestedBySignatoryId: pr.requestedBySignatoryId || "",
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
        } else if (searchParams.get("duplicateFrom")) {
          const duplicateId = searchParams.get("duplicateFrom");
          const prRes = await fetch(`/api/purchase-requests/${duplicateId}`);
          if (prRes.ok) {
            const pr = await prRes.json();
            reset({
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: `[COPY] ${pr.purpose || ""}`,
              chargeToAccount: pr.chargeToAccount || "",
              requestedBySignatoryId: pr.requestedBySignatoryId || "",
              lineItems: pr.lineItems.map((li: any) => ({
                itemId: li.itemId,
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitCost: li.unitCost
              }))
            });
            toast.success("Loaded PR data for duplication");
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

  const handleItemSelect = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setDraftItem({ ...draftItem, itemId, description: item.description, unit: item.unit, unitCost: item.standardCost });
    } else {
      setDraftItem({ ...draftItem, itemId: "" });
    }
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    setActiveItemIndex(index);
    setDraftItem(watchLineItems[index]);
  };

  const handleAddOrUpdate = () => {
    if (!draftItem.description) {
      toast.error("Description is required");
      return;
    }
    if (draftItem.quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    if (activeItemIndex !== null) {
      update(activeItemIndex, draftItem);
      toast.success("Item updated");
    } else {
      append(draftItem);
      toast.success("Item added");
    }
    handleClearDraft();
  };

  const handleClearDraft = () => {
    setActiveItemIndex(null);
    setDraftItem({ itemId: "", description: "", unit: "Piece", quantity: 1, unitCost: 0 });
  };

  const handleDeleteItem = () => {
    if (activeItemIndex !== null) {
      remove(activeItemIndex);
      handleClearDraft();
      toast.success("Item deleted");
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

  const isReadOnly = isViewMode || (!isNew && !isUnlocked);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col overflow-hidden print:block print:!h-auto print:!overflow-visible" style={{ height: 'calc(var(--full-vh) - 128px)' }}>
      {/* Header (No Print) */}
      <div className="no-print flex items-center justify-between p-4 border-b border-slate-300 shadow-sm z-10" style={{ background: 'var(--color-page-bg)' }}>
        <div className="flex items-center gap-3">
          <Link href="/purchase-requests" className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {isNew ? "New Purchase Request" : `PR: ${prData?.prNumber}`}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handlePrint} className="btn btn-secondary">
              <Printer size={16} /> Print
            </button>
          )}
          {!isViewMode && !isNew && (
            <button type="button" onClick={() => setIsUnlocked(!isUnlocked)} className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`}>
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}
          {!isReadOnly && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary">
              <Save size={16} /> Save
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative print:block print:!h-auto print:!overflow-visible">
        {/* Zoom Controls */}
        <div className="no-print absolute bottom-6 left-6 flex items-center gap-1 bg-white p-1 rounded-full shadow-md border border-slate-200 z-10 text-slate-600">
          <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
          <button type="button" onClick={() => setZoom(1)} className="px-3 hover:bg-slate-100 rounded-full font-bold text-xs h-full transition-colors" title="Reset Zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
        </div>

        {/* Left Side: Live Print Preview */}
        <div className="flex-1 overflow-auto bg-slate-200 print:p-0 print:bg-white print:block print:!overflow-visible print:!h-auto">

          <div className="p-8 print:p-0 w-max mx-auto min-w-full flex justify-center origin-top print:block print:w-full print:min-w-0 print:!transform-none print:!mb-0" style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 1056}px` }}>
            <div className="print-area w-[816px] bg-white shadow-xl min-h-[1056px] p-10 print:shadow-none print:w-full print:max-w-none print:p-8 print:m-0 print:min-h-0">
              {/* PR Standard Form Layout */}
              <div className="text-right font-bold text-lg mb-2">Annex 30</div>

              <div className="border-2 border-black">
                {/* Title Block */}
                <div className="text-center p-4 border-b-4 border-double border-black">
                  <h2 className="font-extrabold text-3xl uppercase tracking-wide mb-1">Purchase Request</h2>
                  <div className="text-sm font-semibold underline decoration-black">
                    Municipality of Pandan, Antique
                  </div>
                  <div className="text-sm italic font-medium">
                    LGU
                  </div>
                </div>

                {/* Grid Block */}
                <div className="grid grid-cols-2 text-sm border-b-4 border-double border-black">
                  <div className="border-r-2 border-black p-2 flex flex-col justify-center">
                    <div className="flex mb-2"><span className="w-24 whitespace-nowrap">Department :</span> <span className="border-b border-black flex-1 text-center">{offices.find(o => o.id === watchAllFields.officeId)?.name || "Office of the Mayor"}</span></div>
                    <div className="flex"><span className="w-24 whitespace-nowrap">Section :</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                  </div>
                  <div className="p-2 flex flex-col justify-between">
                    <div className="flex mb-2"><span className="w-20">PR No.:</span> <span className="border-b border-black flex-1 text-center font-bold"></span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
                    <div className="flex mb-2"><span className="w-20">SAI No.:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                    <div className="flex"><span className="w-20">ALOBS No.:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                  </div>
                </div>

                {/* Table Block */}
                <table className="w-full table-fixed border-collapse text-sm border-b-4 border-double border-black">
                  <thead>
                    <tr className="bg-white">
                      <th className="border border-black border-t-0 border-l-0 p-1 font-bold text-center w-[7%]">Item<br />No.</th>
                      <th className="border border-black border-t-0 p-1 font-bold text-center w-[11%]">Quantity</th>
                      <th className="border border-black border-t-0 p-1 font-bold text-center w-[12%]">Unit Of<br />Issue</th>
                      <th className="border border-black border-t-0 p-1 font-bold text-center w-[40%]">Item Description</th>
                      <th className="border border-black border-t-0 p-1 font-bold text-center w-[15%]">Estimated<br />Unit Cost</th>
                      <th className="border border-black border-t-0 border-r-0 p-1 font-bold text-center w-[15%]">Estimated<br />Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {watchLineItems.length > 0 ? watchLineItems.map((item, idx) => (
                      <tr key={idx} onClick={() => handleRowClick(idx)} className={`h-6 ${!isReadOnly ? `cursor-pointer transition-colors ${activeItemIndex === idx ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-blue-50"}` : ""}`}>
                        <td className="border border-black border-l-0 p-0 leading-tight text-center align-top">{idx + 1}</td>
                        <td className="border border-black p-0 leading-tight text-center align-top">{item.quantity}</td>
                        <td className="border border-black p-0 leading-tight text-center align-top">{item.unit}</td>
                        <td className="border border-black p-0 pl-1 leading-tight whitespace-normal break-words align-top">{item.description}</td>
                        <td className="border border-black p-0 leading-tight text-right align-top pr-1">{item.unitCost ? formatCurrency(item.unitCost).replace('₱', '') : '0.00'}</td>
                        <td className="border border-black border-r-0 p-0 leading-tight text-right align-top pr-1">{(item.quantity && item.unitCost) ? formatCurrency(item.quantity * item.unitCost).replace('₱', '') : '0.00'}</td>
                      </tr>
                    )) : null}
                    {Array.from({ length: Math.max(0, 15 - watchLineItems.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="h-6">
                        <td className="border border-black border-l-0 p-0"></td>
                        <td className="border border-black p-0"></td>
                        <td className="border border-black p-0"></td>
                        <td className="border border-black p-0"></td>
                        <td className="border border-black p-0"></td>
                        <td className="border border-black border-r-0 p-0"></td>
                      </tr>
                    ))}
                    <tr className="h-6">
                      <td colSpan={5} className="border border-black border-l-0 border-b-0 p-0"></td>
                      <td className="border border-black border-r-0 border-b-0 p-0 text-right pr-1">-</td>
                    </tr>
                  </tbody>
                </table>

                {/* Purpose Block */}
                <div className="p-3 text-sm flex gap-2 border-b-4 border-double border-black">
                  <span className="shrink-0 italic">Purpose: </span>
                  <div className="flex-1 flex flex-col gap-1 mt-1">
                    <div className="border-b border-black text-left min-h-[1.5rem] relative">
                      <span className="absolute left-0 right-0 -top-1 whitespace-nowrap overflow-hidden text-ellipsis px-2">{watchAllFields.purpose || "\u00A0"}</span>
                    </div>
                    <div className="border-b border-black text-center min-h-[1.5rem]"></div>
                    <div className="border-b border-black text-center min-h-[1.5rem]"></div>
                  </div>
                </div>

                {/* Signatures Block */}
                <table className="w-full border-collapse text-xs text-center border-t-0 table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[27.33%]" />
                    <col className="w-[24%]" />
                    <col className="w-[27.33%]" />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="border border-black border-l-0 border-t-0 py-0 px-1"></td>
                      <td className="border border-black border-t-0 py-0 px-1 leading-tight font-bold sign-text">Requested by:</td>
                      <td className="border border-black border-t-0 py-0 px-1 leading-tight font-bold sign-text">Cash availability:</td>
                      <td className="border border-black border-t-0 border-r-0 py-0 px-1 leading-tight font-bold sign-text">Approved by:</td>
                    </tr>
                    <tr className="border-none">
                      <td className="border border-black border-l-0 border-b-0 py-0 px-1 pl-2 italic text-left align-top h-[10px] text-[13px]">Signature:</td>
                      <td className="border border-black py-0 px-1"></td>
                      <td className="border border-black py-0 px-1"></td>
                      <td className="border border-black border-r-0 py-0 px-1"></td>
                    </tr>
                    <tr className="border-none">
                      <td className="border border-black border-l-0 border-y-0 py-0 px-1 pl-2 italic text-left text-[13px] leading-tight">Printed Name:</td>
                      <td className="border border-black py-0 px-1 font-bold uppercase text-[12px] leading-tight">
                        {signatories.find(s => s.id === watchAllFields.requestedBySignatoryId)?.name || ""}
                      </td>
                      <td className="border border-black py-0 px-1 font-bold uppercase text-[12px] leading-tight">EDSEL J. AMBUBUYOG</td>
                      <td className="border border-black border-r-0 py-0 px-1 font-bold uppercase text-[12px] leading-tight">HON. TOMAS U. ESTOPEREZ JR.</td>
                    </tr>
                    <tr className="border-none">
                      <td className="border border-black border-l-0 border-t-0 border-b-0 py-0 px-1 pl-2 italic text-left h-[30px] text-[13px] leading-tight">Designation:</td>
                      <td className="border border-black py-0 px-1 text-[13px] leading-tight">
                        {signatories.find(s => s.id === watchAllFields.requestedBySignatoryId)?.position || ""}
                      </td>
                      <td className="border border-black py-0 px-1 text-[13px] leading-tight">Acting Municipal Treasurer</td>
                      <td className="border border-black border-r-0 py-0 px-1 text-[13px] leading-tight">Municipal Mayor</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Data Entry Form (No Print) */}
        <div className="no-print" style={{ width: "420px", flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "var(--color-page-bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", flex: 1 }}>
            <h3 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1.25rem", fontSize: "1rem" }}>PR Details</h3>

            <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="form-label">Requesting Office</label>
                <select
                  {...register("officeId")}
                  className="form-select"
                  disabled={isReadOnly}
                >
                  <option value="">Select Office...</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Fund Source</label>
                <select
                  {...register("fundSourceId")}
                  className="form-select"
                  disabled={isReadOnly}
                >
                  <option value="">Select Fund Source...</option>
                  {fundSources.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Requested By (Signatory)</label>
                <select
                  {...register("requestedBySignatoryId")}
                  className="form-select"
                  disabled={isReadOnly}
                >
                  <option value="">Select Signatory...</option>
                  {signatories.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Purpose</label>
                <textarea
                  {...register("purpose")}
                  className="form-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Enter purpose of procurement..."
                  disabled={isReadOnly}
                />
              </div>

              <div style={{ paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h3 style={{ fontWeight: "700", color: "#334155", fontSize: "0.9375rem" }}>
                    {activeItemIndex !== null ? "Edit Item" : "Add New Item"}
                  </h3>
                  {activeItemIndex !== null && !isReadOnly && (
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {!isReadOnly && (
                  <div style={{ borderRadius: "1rem", background: "var(--color-page-bg)", boxShadow: "inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.9)", padding: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div>
                        <label className="form-label">Catalog Item <span style={{ fontWeight: "400", color: "#94a3b8" }}>(optional)</span></label>
                        <select
                          value={draftItem.itemId || ""}
                          onChange={(e) => handleItemSelect(e.target.value)}
                          className="form-select"
                        >
                          <option value="">-- Custom Item --</option>
                          {items.map(item => (
                            <option key={item.id} value={item.id}>{item.description}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Description</label>
                        <input
                          value={draftItem.description}
                          onChange={(e) => setDraftItem({ ...draftItem, description: e.target.value })}
                          className="form-input"
                          placeholder="Enter description..."
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                        <div>
                          <label className="form-label">Unit</label>
                          <input
                            value={draftItem.unit}
                            onChange={(e) => setDraftItem({ ...draftItem, unit: e.target.value })}
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="form-label">Qty</label>
                          <input
                            type="number"
                            step="1"
                            value={draftItem.quantity}
                            onChange={(e) => setDraftItem({ ...draftItem, quantity: Number(e.target.value) })}
                            className="form-input"
                            style={{ textAlign: "right" }}
                          />
                        </div>

                        <div>
                          <label className="form-label">Cost</label>
                          <input
                            type="number"
                            step="0.25"
                            value={draftItem.unitCost}
                            onChange={(e) => setDraftItem({ ...draftItem, unitCost: Number(e.target.value) })}
                            className="form-input"
                            style={{ textAlign: "right" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "#059669" }}>
                        Est: {formatCurrency(draftItem.quantity * draftItem.unitCost)}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {activeItemIndex !== null && (
                          <button
                            type="button"
                            onClick={handleDeleteItem}
                            className="btn btn-danger btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddOrUpdate}
                          className="btn btn-primary btn-sm"
                        >
                          {activeItemIndex !== null ? "Update" : "Add Item"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isReadOnly && watchLineItems.length === 0 && (
                  <div style={{ textAlign: "center", padding: "1.5rem", border: "2px dashed #e2e8f0", borderRadius: "0.75rem", color: "#94a3b8", fontSize: "0.875rem" }}>
                    No line items added.
                  </div>
                )}
              </div>
            </form>
          </div>

          <div style={{ padding: "1rem", background: "var(--color-page-bg)", borderTop: "1px solid #e2e8f0", position: "sticky", bottom: 0, boxShadow: "0 -2px 8px rgba(163,177,198,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "800", fontSize: "1rem", color: "#0f172a" }}>
              <span>Grand Total:</span>
              <span style={{ color: "#059669" }}>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
