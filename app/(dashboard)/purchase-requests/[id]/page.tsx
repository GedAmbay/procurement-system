"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { formatCurrency, normalizePrNumber, fiscalYearFromPrNumber } from "@/lib/utils";
import { Printer, Save, CheckCircle2, Plus, Minus, Trash2, ArrowLeft, Loader2, ZoomIn, ZoomOut, Lock, Unlock, FolderOpen, Calendar } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface PrLineItem {
  itemId: string | null;
  description: string;
  unit: string;
  quantity: number | "";
  unitCost: number | "";
}

interface PRFormValues {
  prNumber: string;
  fiscalYear?: number | "";
  officeId: string;
  fundSourceId: string;
  purpose: string;
  chargeToAccount: string;
  requestedBySignatoryId: string;
  isDirectAcquisition?: boolean;
  requestType?: string;
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [targetRows, setTargetRows] = useState(21);
  const [showPrNo, setShowPrNo] = useState(false);

  // Options
  const [offices, setOffices] = useState<any[]>([]);
  const [fundSources, setFundSources] = useState<any[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<PRFormValues>({
    defaultValues: {
      prNumber: "",
      fiscalYear: new Date().getFullYear(),
      officeId: user?.officeId || "",
      fundSourceId: "",
      purpose: "",
      chargeToAccount: "",
      requestedBySignatoryId: "",
      requestType: "PURCHASE",
      lineItems: [],
    }
  });

  const watchAllFields = watch();
  const watchLineItems = watch("lineItems");
  const watchRequestType = watch("requestType") || prData?.requestType || "PURCHASE";
  const isJob = watchRequestType === "JOB";
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "lineItems",
  });

  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState<PrLineItem>({
    itemId: "",
    description: "",
    unit: "",
    quantity: "",
    unitCost: "",
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
            if (pr.updatedAt) {
              setLastSaved(new Date(pr.updatedAt));
            }
            reset({
              prNumber: pr.prNumber || "",
              fiscalYear: pr.fiscalYear || new Date().getFullYear(),
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: pr.purpose || "",
              chargeToAccount: pr.chargeToAccount || "",
              isDirectAcquisition: pr.isDirectAcquisition || false,
              requestType: pr.requestType || "PURCHASE",
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
              prNumber: "",
              fiscalYear: pr.fiscalYear || new Date().getFullYear(),
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: `[COPY] ${pr.purpose || ""}`,
              chargeToAccount: pr.chargeToAccount || "",
              isDirectAcquisition: pr.isDirectAcquisition || false,
              requestType: pr.requestType || "PURCHASE",
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
      setDraftItem({
        ...draftItem,
        itemId,
        description: item.description,
        unit: item.unit,
        unitCost: item.standardCost,
        quantity: draftItem.quantity === "" ? 1 : draftItem.quantity
      });
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
    if (Number(draftItem.quantity) < 0) {
      toast.error("Quantity cannot be negative");
      return;
    }

    const itemToAdd = {
      ...draftItem,
      quantity: Number(draftItem.quantity) || 0,
      unitCost: Number(draftItem.unitCost) || 0,
    };

    if (activeItemIndex !== null) {
      update(activeItemIndex, itemToAdd);
      toast.success("Item updated");
    } else {
      append(itemToAdd);
      toast.success("Item added");
    }
    handleClearDraft();
  };

  const handleClearDraft = () => {
    setActiveItemIndex(null);
    setDraftItem({ itemId: "", description: "", unit: "", quantity: "", unitCost: "" });
  };

  const handleDeleteItem = () => {
    if (activeItemIndex !== null) {
      remove(activeItemIndex);
      handleClearDraft();
      toast.success("Item deleted");
    }
  };

  const onSubmit = async (data: PRFormValues) => {
    if (!data.officeId) {
      toast.error("Please select a Requesting Office");
      return;
    }
    if (!data.purpose?.trim()) {
      toast.error("Purpose is required");
      return;
    }
    if (!data.lineItems || data.lineItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const rawPrNumber = data.prNumber?.trim();
    const normalizedPrNumber = rawPrNumber ? normalizePrNumber(rawPrNumber) : null;
    const payload = {
      ...data,
      prNumber: normalizedPrNumber,
      fiscalYear: Number(data.fiscalYear) || (normalizedPrNumber ? fiscalYearFromPrNumber(normalizedPrNumber) : null) || new Date().getFullYear(),
      officeId: data.officeId,
      purpose: data.purpose.trim(),
      fundSourceId: data.fundSourceId || null,
      requestedBySignatoryId: data.requestedBySignatoryId || null,
      chargeToAccount: data.chargeToAccount || null,
    };

    setSubmitting(true);
    try {
      const url = isNew ? "/api/purchase-requests" : `/api/purchase-requests/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errMsg = errorData.error || "Failed to save";
        if (errorData.details) {
          const fieldErrors: string[] = [];
          for (const [key, val] of Object.entries(errorData.details)) {
            if (key !== "_errors" && (val as any)?._errors?.length) {
              fieldErrors.push(`${key}: ${(val as any)._errors.join(", ")}`);
            }
          }
          if (fieldErrors.length > 0) {
            errMsg = fieldErrors.join(" | ");
          }
        }
        throw new Error(errMsg);
      }

      const result = await res.json();
      toast.success(isNew ? "PR created successfully" : "PR updated successfully");

      if (isNew) {
        router.push(`/purchase-requests/${result.id}`);
      } else {
        setPrData(result);
        setLastSaved(new Date());
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
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

  const getSavedTimeText = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - lastSaved.getTime()) / 1000));
    if (diffSec < 45) return "Saved just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return "Saved 1 min ago";
    if (diffMin < 60) return `Saved ${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return "Saved 1 hr ago";
    if (diffHours < 24) return `Saved ${diffHours} hr ago`;
    return `Saved on ${lastSaved.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
  };

  if (loading) return <LoaderWave variant="page" label="Loading purchase request..." />;

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href="/purchase-requests"
              aria-label="Back to Purchase Requests"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Purchase Requests
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {isNew
                ? (isJob ? "New Job Request" : "New Purchase Request")
                : (prData?.prNumber?.trim()
                  ? prData.prNumber.trim()
                  : (isJob ? "Untitled JR" : "Untitled PR"))}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  LOCKED
                </span>
                {getSavedTimeText() && (
                  <span className="text-xs text-slate-500 font-medium">{getSavedTimeText()}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {isNew ? "NEW" : "DRAFT"}
                </span>
                {getSavedTimeText() && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {getSavedTimeText()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Link
                href={`/procurement-folders/${params.id}`}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FolderOpen size={17} className="text-slate-600" />
                <span>Folder</span>
              </Link>
              <div className="h-5 w-px bg-slate-200 mx-1" />
            </>
          )}

          {!isViewMode && !isNew && (
            <button
              type="button"
              onClick={() => setIsUnlocked(!isUnlocked)}
              className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center"
            title="Print"
          >
            <Printer size={16} />
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={submitting}
              className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          )}
        </div>
      </div>

      {prData?.isDirectAcquisition && (
        <div className="no-print bg-[#f0fdfa] border border-[#99f6e4] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#115e59] shadow-sm font-medium shrink-0">
          <CheckCircle2 size={15} className="text-[#0d9488] shrink-0" />
          <span>
            <strong className="font-bold">Direct Acquisition:</strong> This Purchase Request is marked as a direct acquisition. It will bypass the RFQ and abstract steps and proceed directly to Purchase Order generation.
          </span>
        </div>
      )}

      {prData?.calendarEvents?.find((e: any) => e.eventType === "Award Date") && (
        <div className="no-print bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#166534] shadow-sm font-medium shrink-0">
          <Calendar size={15} className="text-[#16a34a] shrink-0" />
          <span>
            <strong className="font-bold">Award Scheduled:</strong> The Award Date for this procurement is scheduled for <strong>{new Date(prData.calendarEvents.find((e: any) => e.eventType === "Award Date").eventDate).toLocaleDateString("en-PH", { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
          </span>
        </div>
      )}

      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This Purchase Request is locked.</strong> Unlock it to make changes.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-w-0 max-w-full w-full gap-4 overflow-hidden relative print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!w-full">
        {/* Left Side: Live Print Preview */}
        <div className="flex-1 w-0 min-w-0 max-w-full rounded-2xl bg-[#d8e1eb] overflow-hidden relative flex flex-col shadow-inner print:rounded-none print:!bg-white print:!overflow-visible print:!shadow-none print:!block print:!w-full print:!m-0 print:!p-0">
          {/* View Controls */}
          <div className="no-print absolute bottom-6 left-6 flex items-center gap-1 bg-white p-1 rounded-full shadow-md border border-slate-200 z-10 text-slate-600">
            <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
            <button type="button" onClick={() => setZoom(1)} className="px-3 hover:bg-slate-100 rounded-full font-bold text-xs h-full transition-colors" title="Reset Zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
            <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
            <button type="button" onClick={() => setTargetRows(r => Math.max(r - 1, 0))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Remove Row"><Minus size={18} /></button>
            <div className="px-2 font-bold text-xs flex flex-col items-center justify-center h-full" title="Target Table Rows"><span className="leading-none">{targetRows}</span><span className="text-[9px] leading-none text-slate-400">Rows</span></div>
            <button type="button" onClick={() => setTargetRows(r => r + 1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="shrink-0 print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(794 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "794px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area text-black w-[794px] bg-white shadow-xl min-h-[1123px] p-10 print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0 print:min-h-0">
              {/* PR Standard Form Layout */}
              <div className="text-right font-bold text-lg mb-2">Annex 30</div>

              <div className="border-2 border-black">
                {/* Title Block */}
                <div className="text-center p-4 border-b-4 border-double border-black">
                  <h2 className="font-extrabold text-3xl uppercase tracking-wide mb-1">{isJob ? "Job Request" : "Purchase Request"}</h2>
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
                    <div className="flex mb-2"><span className="w-20">{isJob ? "JR No.:" : "PR No.:"}</span> <span className="border-b border-black flex-1 text-center">{showPrNo ? (watchAllFields.prNumber || prData?.prNumber || "") : ""}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
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
                    {watchLineItems.length > 0 ? watchLineItems.map((item, idx) => {
                      const isSpec = !item.quantity || item.quantity === 0;
                      let displayNo = "";
                      if (!isSpec) {
                        let count = 0;
                        for (let i = 0; i <= idx; i++) {
                          if (Number(watchLineItems[i].quantity) > 0) count++;
                        }
                        displayNo = count.toString();
                      }

                      const hasSpecs = !isSpec && idx + 1 < watchLineItems.length && (!watchLineItems[idx + 1].quantity || watchLineItems[idx + 1].quantity === 0);

                      return (
                        <tr key={idx} onClick={() => handleRowClick(idx)} className={`h-6 ${!isReadOnly ? `cursor-pointer transition-colors ${activeItemIndex === idx ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-blue-50"}` : ""}`}>
                          <td className="border border-black border-l-0 p-0 leading-tight text-center align-top">{displayNo}</td>
                          <td className="border border-black p-0 leading-tight text-center align-top">{isSpec ? "" : item.quantity}</td>
                          <td className="border border-black p-0 leading-tight text-center align-top">{isSpec ? "" : item.unit}</td>
                          <td className={`border border-black p-0 px-1 leading-tight whitespace-normal break-words align-top ${isSpec ? "pl-4 text-sm" : (hasSpecs ? "font-bold" : "")}`}>{item.description}</td>
                          <td className="border border-black p-0 leading-tight text-right align-top pr-1">{isSpec ? "" : (item.unitCost ? formatCurrency(item.unitCost).replace('₱', '') : '0.00')}</td>
                          <td className="border border-black border-r-0 p-0 leading-tight text-right align-top pr-1">{isSpec ? "" : ((item.quantity && item.unitCost) ? formatCurrency(item.quantity * item.unitCost).replace('₱', '') : '0.00')}</td>
                        </tr>
                      );
                    }) : null}
                    {/* Empty rows filler */}
                    {Array.from({ length: Math.max(0, targetRows - watchLineItems.length) }).map((_, i) => (
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
                      <td colSpan={5} className="border border-black border-l-0 border-b-0 p-0 font-bold text-right pr-2">TOTAL</td>
                      <td className="border border-black border-r-0 border-b-0 p-0 text-right pr-1 font-bold">{totalAmount > 0 ? formatCurrency(totalAmount).replace('₱', '') : '-'}</td>
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
                      <td className="border border-black border-l-0 border-b-0 py-0 px-1 pl-2 italic text-left align-top h-[30px] text-[13px]">Signature:</td>
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
            </div>

            {/* Guaranteed scroll spacer that accounts for zoom scale and floating controls */}
            <div
              style={{
                height: "80px",
                minHeight: "80px",
                width: "100%",
                flexShrink: 0
              }}
              className="no-print pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

    {/* Right Side: Data Entry Form */}
    <div className="no-print w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col overflow-y-auto">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">
          {isJob ? "Job Request Details" : "Purchase Request Details"}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isReadOnly
            ? "Read-only while the document is locked."
            : "Update the details for the purchase request."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5 flex-1">
              {/* Type Toggle: Purchase Request vs Job Request */}
              <div>
                <label className="form-label">Request Type</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setValue("requestType", "PURCHASE")}
                    disabled={isReadOnly}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${!isJob
                      ? "bg-white text-blue-600 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <span>Purchase Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setValue("requestType", "JOB")}
                    disabled={isReadOnly}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${isJob
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <span>Job Request</span>
                  </button>
                </div>
              </div>

              {/* Document Numbering */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      {isJob ? "JR Number" : "PR Number"}
                    </label>
                  </div>
                  <input
                    type="text"
                    {...register("prNumber")}
                    disabled={isReadOnly}
                    onBlur={(e) => {
                      const val = e.target.value?.trim();
                      if (val) {
                        const normalized = normalizePrNumber(val);
                        setValue("prNumber", normalized);
                        const derivedYear = fiscalYearFromPrNumber(normalized);
                        if (derivedYear) {
                          setValue("fiscalYear", derivedYear);
                        }
                      }
                    }}
                    placeholder="e.g. 26-01-001"
                    className="form-input font-mono font-bold text-sm bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Leave blank if not yet assigned by custodian. Can be updated at any time.
                  </p>
                </div>

                {/* Show/Hide Document Number on Document Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <label
                    className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                    onClick={() => setShowPrNo(!showPrNo)}
                  >
                    Print {isJob ? "JR Number" : "PR Number"} on document
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPrNo(!showPrNo)}
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      background: showPrNo ? "#10b981" : "#cbd5e1",
                      position: "relative",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.3s",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                    }}
                    title={showPrNo ? "Hide from document" : "Show on document"}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: "2px",
                        left: showPrNo ? "22px" : "2px",
                        transition: "left 0.3s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  </button>
                </div>
              </div>

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

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="isDirectAcquisition"
                  {...register("isDirectAcquisition")}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDirectAcquisition" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Direct Acquisition <span className="text-xs text-slate-500 font-normal">(Skips RFQ and abstract phases)</span>
                </label>
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
                          <label className="form-label">Unit of Issue</label>
                          <input
                            value={draftItem.unit}
                            onChange={(e) => setDraftItem({ ...draftItem, unit: e.target.value })}
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="form-label">Quantity</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={draftItem.quantity}
                            onChange={(e) => setDraftItem({ ...draftItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                            className="form-input"
                            style={{ textAlign: "right" }}
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="form-label">Cost</label>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={draftItem.unitCost}
                            onChange={(e) => setDraftItem({ ...draftItem, unitCost: e.target.value === "" ? "" : Number(e.target.value) })}
                            className="form-input"
                            style={{ textAlign: "right" }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "#059669" }}>
                        Est: {formatCurrency(Number(draftItem.quantity) * Number(draftItem.unitCost))}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {activeItemIndex !== null ? (
                          <button
                            type="button"
                            onClick={handleDeleteItem}
                            className="btn btn-danger btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleClearDraft}
                            className="btn btn-secondary btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            Clear
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

            <div className="mt-auto pt-3 border-t border-slate-100 sticky bottom-0 bg-white z-10">
              <div className="flex justify-between items-center font-bold text-base text-slate-900">
                <span>Grand Total:</span>
                <span className="text-emerald-600 font-extrabold">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
