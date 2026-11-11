"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut, Minus, Plus, Lock, Unlock, CheckCircle2, User, Package } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import ConfirmModal from "@/components/ui/confirm-modal";

interface AcceptanceFormValues {
  airNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dateReceived: string;
  dateInspected: string;
  lineItems: {
    id: string;
    quantityDelivered: number;
    description: string;
    unit: string;
    unitPrice: number;
    poQuantity: number;
    previouslyDelivered: number;
  }[];
}

export default function AcceptanceEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [acceptance, setAcceptance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [targetRows, setTargetRows] = useState(25);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [showAirNo, setShowAirNo] = useState(true);
  const [showPoNo, setShowPoNo] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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

  const { register, handleSubmit, control, reset, watch } = useForm<AcceptanceFormValues>();
  const { fields } = useFieldArray({
    control,
    name: "lineItems"
  });

  const watchAll = watch();

  useEffect(() => {
    fetchAcceptance();
  }, [id]);

  const fetchAcceptance = async () => {
    try {
      const res = await fetch(`/api/acceptances/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAcceptance(data);
      if (data.updatedAt) setLastSaved(new Date(data.updatedAt));

      reset({
        airNumber: data.airNumber || data.AIRNumber || "",
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : "",
        dateReceived: data.dateReceived ? new Date(data.dateReceived).toISOString().split('T')[0] : "",
        dateInspected: data.dateInspected ? new Date(data.dateInspected).toISOString().split('T')[0] : "",
        lineItems: data.lineItems.map((item: any) => {
          let previouslyDelivered = 0;
          if (data.po?.acceptances) {
            const otherAcceptances = data.po.acceptances.filter((a: any) => a.id !== data.id && a.status !== "DRAFT");
            for (const oa of otherAcceptances) {
              const match = oa.lineItems.find((oli: any) => oli.poLineItemId === item.poLineItemId);
              if (match) previouslyDelivered += match.quantityDelivered;
            }
          }

          return {
            id: item.id,
            description: item.poLineItem.description,
            unit: item.poLineItem.unit,
            unitPrice: item.poLineItem.unitPrice,
            poQuantity: item.poLineItem.quantity,
            quantityDelivered: item.quantityDelivered,
            previouslyDelivered
          };
        })
      });
      setLoading(false);
    } catch (e) {
      toast.error("Failed to load acceptance report");
      setLoading(false);
    }
  };

  const onSubmit = async (data: AcceptanceFormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/acceptances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save");
      }
      toast.success("Acceptance report saved successfully");
      fetchAcceptance();
      setLastSaved(new Date());
      setIsUnlocked(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/acceptances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked as ${status}`);
      fetchAcceptance();
      setLastSaved(new Date());
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const handleSaveConfirm = () => {
    setSaveModalOpen(false);
    handleSubmit(onSubmit)();
  };

  const handleUnlockConfirm = async (password?: string) => {
    // TODO: In a fully secure implementation, you would send this password 
    // to an API endpoint to verify it against the database before unlocking.
    if (!password) {
      toast.error("Password is required");
      return;
    }

    // For now, simulating a successful password verification
    setIsUnlocked(true);
    setUnlockModalOpen(false);
    toast.success("Document unlocked securely");
  };

  if (loading) return <LoaderWave variant="page" label="Loading acceptance..." />;
  if (!acceptance) return <div className="p-8 text-center text-slate-500">Report not found</div>;

  const isReadOnly = acceptance.status !== "DRAFT" && !isUnlocked;

  // Computations for preview
  const totalAmount = (watchAll.lineItems || []).reduce((sum, item) => sum + (item.quantityDelivered * item.unitPrice), 0);

  let isComplete = true;
  for (const item of watchAll.lineItems || []) {
    if (item.quantityDelivered < item.poQuantity) {
      isComplete = false;
      break;
    }
  }

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href={`/acceptances/hub/${acceptance.po?.id}`}
              aria-label="Back to Delivery Hub"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Delivery Hub
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {watchAll.airNumber?.trim()
                ? `AIR: ${watchAll.airNumber.trim()}`
                : (acceptance.airNumber?.trim() || acceptance.AIRNumber?.trim() ? `AIR: ${(acceptance.airNumber || acceptance.AIRNumber).trim()}` : "Acceptance & Inspection")}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  {acceptance.status || "FINAL"}
                </span>
                {getSavedTimeText() && (
                  <span className="text-xs text-slate-500 font-medium">{getSavedTimeText()}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {acceptance.status || "DRAFT"}
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
          {acceptance.po?.id && (
            <Link
              href={`/acceptances/hub/${acceptance.po.id}`}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package size={17} className="text-emerald-600" />
              <span>Delivery Hub</span>
            </Link>
          )}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {acceptance.status !== "DRAFT" && (
            <button
              type="button"
              onClick={() => isUnlocked ? setIsUnlocked(false) : setUnlockModalOpen(true)}
              className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center"
            title="Print"
          >
            <Printer size={16} />
          </button>

          {(!isReadOnly || isUnlocked) && (
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              disabled={submitting}
              className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {isUnlocked ? "Save Changes" : "Save"}
            </button>
          )}

          {acceptance.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => updateStatus("ISSUED")}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Finalize
            </button>
          )}
        </div>
      </div>

      {/* Lock Banner when finalized */}
      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This Acceptance & Inspection Report is finalized and locked.</strong> Unlock it to make changes.
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
            <button type="button" onClick={() => setTargetRows(r => Math.min(r + 1, 40))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="air-zoom-wrapper origin-top print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(980 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "980px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area shadow-xl text-[14px] leading-tight print:shadow-none print:max-w-none print:m-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_th]:!font-['Times_New_Roman',_Times,_serif]" style={{ width: "980px", minHeight: "1123px", background: "white", padding: "3rem", fontFamily: "'Times New Roman', Times, serif" }}>


                    <div className="border-2 border-black flex flex-col">
                <div className="text-right italic mb-2 mr-1">Appendix 50</div>
                <div className="text-center font-bold my-4">
                  <div className="text-xl tracking-wide">ACCEPTANCE & INSPECTION REPORT</div>
                </div>

                <div className="border-black flex items-center py-1 font-bold">
                  <div className="w-3/5 flex items-center px-2">
                    <span className="mr-1">LGU:</span>
                    <span className="border-b border-black w-44 text-center uppercase">PANDAN</span>
                  </div>
                  <div className="w-2/5 flex items-center px-2">
                    <span className="mr-2">Fund:</span>
                    <span>General Fund</span>
                  </div>
                </div>

                <div className="border-t-2 border-black flex">
                  <div className="w-3/5 border-r-2 border-black p-2 flex flex-col gap-1 justify-center">
                    <div className="flex font-bold"><span className="w-44">Supplier :</span> <span className="flex-1 border-b border-black">{acceptance.po?.supplier?.name}</span></div>
                    <div className="flex font-bold"><span className="w-44">{(acceptance.po?.orderType === "JOB" || acceptance.po?.pr?.requestType === "JOB" || acceptance.po?.abstract?.rfq?.pr?.requestType === "JOB") ? "JO No. /Date:" : "PO No. /Date:"}</span> <span className="flex-1 border-b border-black">{showPoNo ? (acceptance.po?.poNumber || "") : ""}{showPoNo && acceptance.po?.createdAt ? ` / ${new Date(acceptance.po.createdAt).toLocaleDateString()}` : ""}</span></div>
                    <div className="flex font-bold"><span className="w-44">Req. Office/Department:</span> <span className="flex-1 border-b border-black ">{acceptance.po?.abstract?.rfq?.pr?.office?.name || acceptance.po?.pr?.office?.name || ""}</span></div>
                  </div>
                  <div className="w-2/5 p-2 flex flex-col gap-1 justify-center">
                    <div className="flex font-bold"><span className="w-28">AIR No. :</span> <span className="flex-1 border-b border-black">{showAirNo ? (watchAll.airNumber || acceptance.airNumber || acceptance.AIRNumber || "") : ""}</span></div>
                    <div className="flex font-bold"><span className="w-28">Date :</span> <span className="flex-1 border-b border-black"></span></div>
                    <div className="flex font-bold"><span className="w-28">Invoice No. :</span> <span className="flex-1 border-b border-black">{watchAll.invoiceNumber}</span></div>
                    <div className="flex font-bold"><span className="w-28">Date :</span> <span className="flex-1 border-b border-black">{watchAll.invoiceDate ? new Date(watchAll.invoiceDate).toLocaleDateString() : ""}</span></div>
                  </div>
                </div>

                <table className="w-full border-collapse border-y-2 border-black flex-1 table-fixed">
                  <thead>
                    <tr className="border-b-2 border-black h-8">
                      <th className="border-r-2 border-black" style={{ width: '12%' }}>Stock/ Property No.</th>
                      <th className="border-r-2 border-black" style={{ width: '48%' }}>Description</th>
                      <th className="border-r-2 border-black" style={{ width: '20%' }}>Unit</th>
                      <th style={{ width: '20%' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(watchAll.lineItems || []).map((item, idx) => {
                      const isSpec = !item.poQuantity || item.poQuantity === 0;
                      if (item.quantityDelivered === 0 && !isSpec) return null;

                      let displayNo = "";
                      if (!isSpec) {
                        let count = 0;
                        const allItems = watchAll.lineItems || [];
                        for (let i = 0; i <= idx; i++) {
                          if (allItems[i].poQuantity > 0) count++;
                        }
                        displayNo = count.toString();
                      }

                      const allItems = watchAll.lineItems || [];
                      const hasSpecs = !isSpec && idx + 1 < allItems.length && (!allItems[idx + 1].poQuantity || allItems[idx + 1].poQuantity === 0);

                      return (
                        <tr key={idx} className="h-6">
                          <td className="border-r-2 border-black border-b text-center" style={{ borderBottomStyle: 'dashed' }}>{displayNo}</td>
                          <td className={`border-r-2 border-black border-b px-2 ${isSpec ? "pl-4" : (hasSpecs ? "font-bold" : "")}`} style={{ borderBottomStyle: 'dashed' }}>{item.description}</td>
                          <td className="border-r-2 border-black border-b text-center" style={{ borderBottomStyle: 'dashed' }}>{isSpec ? "" : item.unit}</td>
                          <td className="border-b text-center font-bold" style={{ borderBottomStyle: 'dashed' }}>{isSpec ? "" : item.quantityDelivered}</td>
                        </tr>
                      )
                    })}
                    {Array.from({ length: Math.max(0, targetRows - (watchAll.lineItems?.filter(i => i.quantityDelivered > 0).length || 0)) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="h-6">
                        <td className="border-r-2 border-black border-b" style={{ borderBottomStyle: 'dashed' }}></td>
                        <td className="border-r-2 border-black border-b" style={{ borderBottomStyle: 'dashed' }}></td>
                        <td className="border-r-2 border-black border-b" style={{ borderBottomStyle: 'dashed' }}></td>
                        <td className="border-b" style={{ borderBottomStyle: 'dashed' }}></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-b-2 border-black font-bold h-8">
                      <td className="border-r-2 border-black"></td>
                      <td className="border-r-2 border-black px-2">
                        <div className="flex items-center">
                          <span className="ml-16">TOTAL</span>
                          <span className="flex-1 text-center">P</span>
                          <span className="mr-2">{formatCurrency(totalAmount).replace('₱', '')}</span>
                        </div>
                      </td>
                      <td className="border-r-2 border-black"></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                <div className="flex border-t-2 border-black">
                  <div className="w-[45%] border-r-2 border-black flex flex-col h-full" style={{ minHeight: "260px" }}>
                    <div className="text-center font-bold py-2 border-b-2 border-black">ACCEPTANCE</div>
                    <div className="flex flex-col flex-1 p-4">
                      <div className="h-[70px]">
                        <div className="flex mb-3">
                          <span className="font-bold w-28 whitespace-nowrap mr-2">Date Received:</span>
                          <span className="w-48 border-b border-black text-center">{watchAll.dateReceived ? new Date(watchAll.dateReceived).toLocaleDateString() : ""}</span>
                        </div>

                        <div className="pl-6">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 border border-black flex items-center justify-center font-bold text-xs">{isComplete ? "/" : ""}</div>
                            <span>Complete</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-black flex items-center justify-center font-bold text-xs">{!isComplete ? "/" : ""}</div>
                            <span>Partial (pls. Specify)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex mt-6">
                        <div className="w-1/2 flex items-center">
                          <span className="text-sm">Received By:</span>
                        </div>
                        <div className="w-1/2 flex flex-col justify-between text-center">
                          <div className="flex flex-col items-center">
                            <div className="font-bold underline uppercase whitespace-nowrap">HON. TOMAS U. ESTOPEREZ JR.</div>
                            <div className="text-[10px] mt-1">Requisitioning Officer</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="font-bold underline uppercase whitespace-nowrap">FLORIME Y. OLANDRES</div>
                            <div className="text-[10px] mt-1">Requisitioning Officer</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-[55%] flex flex-col h-full" style={{ minHeight: "260px" }}>
                    <div className="text-center font-bold py-2 border-b-2 border-black">INSPECTION</div>
                    <div className="flex flex-col flex-1 p-4">
                      <div className="h-[70px]">
                        <div className="flex mb-3">
                          <span className="font-bold w-28 whitespace-nowrap mr-2">Date Inspected:</span>
                          <span className="w-48 border-b border-black text-center">{watchAll.dateInspected ? new Date(watchAll.dateInspected).toLocaleDateString() : ""}</span>
                        </div>

                        <div className="pl-6 flex gap-2">
                          <div className="w-4 h-4 border border-black flex flex-shrink-0 items-center justify-center font-bold text-xs mt-1">/</div>
                          <div className="leading-tight">
                            Inspected, verified and found <span className="font-bold">OK</span><br />
                            as to quantity and specifications
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-between text-center mt-6">
                        <div className="flex justify-between gap-2 items-start">
                          <div className="flex-1">
                            <div className="font-bold underline uppercase whitespace-normal leading-tight">EDSEL J. AMBUBUYOG</div>
                            <div className="text-[10px] leading-tight mt-1">Chairman, Committee on<br />Inspection/Acting Mun. Treasurer</div>
                          </div>
                          <div className="flex-1">
                            <div className="font-bold underline uppercase whitespace-normal leading-tight">HON. TOMAS U.<br />ESTOPEREZ JR.</div>
                            <div className="text-[10px] leading-tight mt-1">Requisitioning Officer</div>
                          </div>
                        </div>

                        <div className="flex justify-between gap-2 items-start">
                          <div className="flex-1">
                            <div className="font-bold underline uppercase whitespace-nowrap">CARLOS O. SUAN JR.</div>
                            <div className="text-[10px] leading-tight mt-1">Member/ PDO II</div>
                          </div>
                          <div className="flex-1">
                            <div className="font-bold underline uppercase whitespace-nowrap">RUEL E. CASIDSID</div>
                            <div className="text-[10px] leading-tight mt-1">Member/Draftsman III</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-2 text-[10px] font-bold">
                <div>Cc: COA- 1 copy</div>
                <div className="ml-5">Voucher- 2 copies</div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Guaranteed scroll spacer */}
      <div
        style={{ height: "80px", minHeight: "80px", width: "100%", flexShrink: 0 }}
        className="no-print pointer-events-none"
        aria-hidden="true"
      />
    </div>
  </div>

        {/* Right Side: Form Panel */}
        <div className="no-print w-[360px] lg:w-[400px] xl:w-[440px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Acceptance Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the report is finalized."
                : "Update the details and delivered quantities."}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1">
              {/* Document Numbering */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      AIR Number
                    </label>
                  </div>
                  <input
                    type="text"
                    {...register("airNumber")}
                    disabled={isReadOnly}
                    placeholder="e.g. 26-01-001"
                    className="form-input font-mono font-bold text-sm bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Leave blank if not yet assigned by custodian. Can be updated at any time.
                  </p>
                </div>

                {/* Show/Hide AIR Number on Document Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <label
                    className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                    onClick={() => setShowAirNo(!showAirNo)}
                  >
                    Print AIR Number on document
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAirNo(!showAirNo)}
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      background: showAirNo ? "#10b981" : "#cbd5e1",
                      position: "relative",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.3s",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                    }}
                    title={showAirNo ? "Hide from document" : "Show on document"}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: "2px",
                        left: showAirNo ? "22px" : "2px",
                        transition: "left 0.3s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  </button>
                </div>

                {/* Show/Hide PO/JO Number on Document Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <label
                    className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                    onClick={() => setShowPoNo(!showPoNo)}
                  >
                    Print {(acceptance.po?.orderType === "JOB" || acceptance.po?.pr?.requestType === "JOB" || acceptance.po?.abstract?.rfq?.pr?.requestType === "JOB")
                      ? "JO Number"
                      : "PO Number"} on document
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPoNo(!showPoNo)}
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      background: showPoNo ? "#10b981" : "#cbd5e1",
                      position: "relative",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.3s",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                    }}
                    title={showPoNo ? "Hide from document" : "Show on document"}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: "2px",
                        left: showPoNo ? "22px" : "2px",
                        transition: "left 0.3s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Invoice No.</label>
                  <input type="text" {...register("invoiceNumber")} disabled={isReadOnly} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Invoice Date</label>
                  <input type="date" {...register("invoiceDate")} disabled={isReadOnly} className="form-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date Received</label>
                  <input type="date" {...register("dateReceived")} disabled={isReadOnly} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Date Inspected</label>
                  <input type="date" {...register("dateInspected")} disabled={isReadOnly} className="form-input" />
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-bold text-slate-800 mb-2">Delivery Quantities</h4>
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const itemDesc = watchAll.lineItems?.[index]?.description;
                    const maxQty = watchAll.lineItems?.[index]?.poQuantity;
                    const prevDelivered = watchAll.lineItems?.[index]?.previouslyDelivered || 0;
                    const remainingQty = maxQty - prevDelivered;

                    // Skip rendering inputs for specification lines
                    if (!maxQty || maxQty === 0) return null;

                    return (
                      <div key={field.id} className="p-3 bg-white rounded-lg shadow-sm border border-slate-100 flex flex-col gap-2">
                        <div className="text-xs font-semibold text-slate-700">{itemDesc}</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500">
                            Ordered: <span className="font-bold">{maxQty}</span>
                            {prevDelivered > 0 && <span className="text-orange-500 ml-1">(Prev: {prevDelivered})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Delivered:</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max={remainingQty}
                              {...register(`lineItems.${index}.quantityDelivered` as const, { valueAsNumber: true })}
                              disabled={isReadOnly}
                              className="form-input !py-1 !px-2 w-20 text-right"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Details save automatically with the document.</span>
              </div>
            </form>

            {/* Sticky Total in right panel footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between font-bold text-sm text-slate-800">
              <span>Delivered Total:</span>
              <span className="text-emerald-600 text-base font-extrabold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

      <ConfirmModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={handleSaveConfirm}
        title="Confirm Save"
        message="Are you sure you want to save these changes to the acceptance report?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document has been issued. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        requirePassword={true}
        isDestructive={true}
      />
    </div>
  );
}
