"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut, Send, Clock, CheckCircle2, Lock, Unlock, Minus, Plus, User, LayoutGrid, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import ConfirmModal from "@/components/ui/confirm-modal";

export default function RfqLivePreviewPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rfq, setRfq] = useState<any>(null);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [targetRows, setTargetRows] = useState(8);
  const [showRfqNo, setShowRfqNo] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      rfqNumber: "",
      signatoryId: "",
      deadline: "",
    }
  });

  const watchRfqNumber = watch("rfqNumber");
  const watchSignatoryId = watch("signatoryId");
  const watchDeadline = watch("deadline");

  const selectedSignatory =
    signatories.find(s => s.id === watchSignatoryId) ||
    rfq?.signatory ||
    signatories.find(s => s.name?.toUpperCase().includes("JEFFY"));

  useEffect(() => {
    async function loadData() {
      try {
        const [rfqRes, sigRes] = await Promise.all([
          fetch(`/api/rfqs/${params.id}`),
          fetch("/api/signatories")
        ]);

        let loadedSignatories: any[] = [];
        if (sigRes.ok) {
          loadedSignatories = await sigRes.json();
          setSignatories(loadedSignatories);
        }

        if (rfqRes.ok) {
          const data = await rfqRes.json();
          setRfq(data);
          if (data.updatedAt) {
            setLastSaved(new Date(data.updatedAt));
          } else if (data.createdAt) {
            setLastSaved(new Date(data.createdAt));
          } else {
            setLastSaved(new Date());
          }

          const defaultSig = loadedSignatories.find(
            s => s.name?.toUpperCase().includes("JEFFY")
          );
          const activeSigId = data.signatoryId || (defaultSig ? defaultSig.id : "");

          reset({
            rfqNumber: data.rfqNumber || "",
            signatoryId: activeSigId,
            deadline: data.deadline ? data.deadline.substring(0, 10) : "",
          });
        }
      } catch (err) {
        toast.error("Failed to load RFQ");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, reset]);

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const payload = {
        rfqNumber: data.rfqNumber?.trim() || null,
        signatoryId: data.signatoryId || null,
        deadline: data.deadline || null,
      };

      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save RFQ details");
      }

      const updated = await res.json();
      setRfq(updated);
      setLastSaved(new Date(updated.updatedAt || Date.now()));
      toast.success("RFQ details saved successfully");
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    const currentSigId = watchSignatoryId || rfq?.signatoryId;
    if ((status === "ISSUED" || status === "COMPLETED") && !currentSigId) {
      toast.error("Please select a signatory before issuing");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { status };
      if (currentSigId) {
        payload.signatoryId = currentSigId;
      }
      if (watchRfqNumber !== undefined) {
        payload.rfqNumber = watchRfqNumber?.trim() || null;
      }
      if (watchDeadline) {
        payload.deadline = watchDeadline;
      }

      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }

      const updated = await res.json();
      setRfq(updated);
      setLastSaved(new Date(updated.updatedAt || Date.now()));
      toast.success(`RFQ ${status === "ISSUED" ? "issued" : status.toLowerCase().replace(/_/g, ' ')} successfully`);
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockConfirm = async (password?: string) => {
    if (!password) {
      toast.error("Password is required");
      return;
    }

    setIsUnlocked(true);
    setUnlockModalOpen(false);
    toast.success("Document unlocked securely");
  };

  if (loading) return <LoaderWave variant="page" label="Loading RFQ..." />;
  if (!rfq) return <div>Error loading data</div>;

  const isReadOnly = rfq.status !== "DRAFT" && !isUnlocked;

  const getSavedTimeText = () => {
    if (!lastSaved) return "Saved just now";
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

  const getIssuedTimeText = () => {
    const dateStr = rfq?.updatedAt || rfq?.createdAt;
    if (!dateStr) return "Issued today · Locked for editing";
    const issuedDate = new Date(dateStr);
    const today = new Date();
    const isToday =
      issuedDate.getDate() === today.getDate() &&
      issuedDate.getMonth() === today.getMonth() &&
      issuedDate.getFullYear() === today.getFullYear();
    if (isToday) return "Issued today · Locked for editing";
    return `Issued on ${issuedDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} · Locked for editing`;
  };

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href="/rfqs"
              aria-label="Back to Requests for Quotation"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Requests for Quotation
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {rfq.rfqNumber?.trim() ? (rfq.rfqNumber.trim().toUpperCase().startsWith("RFQ") ? rfq.rfqNumber.trim() : `${rfq.rfqNumber.trim()}`) : "Untitled RFQ"}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  {rfq.status}
                </span>
                <span className="text-xs text-slate-500 font-medium">{getIssuedTimeText()}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {rfq.status || "DRAFT"}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {getSavedTimeText()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Abstract Hub Button */}
          <Link
            href={rfq.abstract ? `/abstract/${rfq.abstract.id}` : `/abstract`}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <LayoutGrid size={17} className="text-slate-600" />
            <span>Abstract Hub</span>
          </Link>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {isReadOnly ? (
            <>
              <button
                type="button"
                onClick={() => setUnlockModalOpen(true)}
                className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                <Unlock size={16} /> Unlock
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                <Printer size={16} /> Print
              </button>
            </>
          ) : (
            <>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={() => setIsUnlocked(false)}
                  className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  <Lock size={16} /> Lock
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
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={submitting}
                className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
              </button>
              {rfq.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => updateStatus("ISSUED")}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Issue
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lock Banner when issued */}
      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This RFQ is issued and locked.</strong> Unlock it to make changes. Unlocking returns it to Draft.
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
                  width: `${Math.round(890 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "890px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area rfq-print-sheet text-black w-[890px] bg-white shadow-xl min-h-[1123px] p-10 pb-16 print:shadow-none print:!w-[890px] print:!min-w-[890px] print:!max-w-[890px] print:!p-10 print:!mx-auto print:!my-0 print:min-h-0 font-sans text-[11px]">

                    {/* Header Layout per Template */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold italic text-[12px]">LGU of PANDAN, ANTIQUE</div>
                      <div className="w-[290px] mr-[16%]">
                        <div className="flex mt-4 mb-1"><span className="w-[155px] italic">Project Reference Number</span> <span className="border-b border-black w-[120px]"></span></div>
                        <div className="flex mb-1"><span className="w-[155px] italic">Name of the Project</span> <span className="border-b border-black w-[120px]"></span></div>
                        <div className="flex mb-1"><span className="w-[155px] italic">Location of the Project</span> <span className="border-b border-black w-[120px]"></span></div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div >Standard Form Number: SF-GOOD-60</div>
                      <div>Revised on: May 24, 2004</div>
                      <h2 className="text-[25px]">Standard Form Title: <span className="font-bold text-[25px] italic">REQUEST FOR QUOTATION</span></h2>
                    </div>

                    <div className="flex justify-end mb-4 text-[13px] mr-[16%]">
                      <div className="w-[290px]">
                        <div className="flex mb-1"><span className="w-20">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
                        <div className="flex mb-1"><span className="w-20">Quotation:</span> <span className="border-b border-black flex-1 text-center font-bold">{showRfqNo ? (watchRfqNumber || rfq.rfqNumber || "") : ""}</span></div>
                      </div>
                    </div>

                    <div className="mb-4 text-[13px]">
                      <div className="flex mb-1 w-[400px]"><span className="w-16">Company</span> <span className="border-b border-black flex-1 uppercase font-bold"></span></div>
                      <div className="flex mb-1 w-[400px]"><span className="w-16">Address</span> <span className="border-b border-black flex-1"></span></div>
                    </div>

                    <div className="mb-8 indent-[42px] text-[13px]">
                      Please quote your lowest price on the item(s) listed below, subject to the General Conditions <br />
                      on the last page, stating the shortest time of the delivery and submit your quotation duly signed by your <br />
                      representative not later than <span className="font-bold underline">{watchDeadline ? formatDate(watchDeadline) : (rfq.deadline ? formatDate(rfq.deadline) : "______________________________________")}</span> in the return envelope attached herewith. <br />
                    </div>

                    <div className="flex justify-end mb-6 text-center">
                      <div className="w-[550px]">
                        <div className="font-bold px-4 text-[16px] uppercase">{selectedSignatory?.name || "JEFFY S. CANGAYDA"}</div>
                        <div className="text-[13px]">BAC Chairman</div>
                      </div>
                    </div>

                    <div className="mb-4 text-xs font-bold leading-tight text-[13px]">
                      NOTE:<br />
                      <span className="ml-7 inline-block w-4">1</span> DELIVERY PERIOD WITHIN _____________________ CALENDAR DAYS.<br />
                      <span className="ml-7 inline-block w-4">2</span> WARRANTY SHALL BE FOR A PERIOD OF SIX (6) MONTHS FOR SUPPLIES & MATERIALS,<br />
                      <span className="ml-7 inline-block w-4"></span>  ONE (1) YEAR FOR EQUIPMENT, FROM DATE OF ACCEPTANCE BY THE PROCURING<br />
                      <span className="ml-7 inline-block w-4"></span>  ENTITY.<br />
                      <span className="ml-7 inline-block w-4">3</span> PRICE VALIDITY SHALL BE FOR A PERIOD OF <span className="underline">THIRTY (30)</span> CALENDAR DAYS.<br />
                      <span className="ml-7 inline-block w-4">4</span> G-EPS REGISTRATION CERTIFICATE SHALL BE ATTACHED UPON SUBMISSION OF THE<br />
                      <span className="ml-7 inline-block w-4"></span> QUOTATION.<br />
                      <span className="ml-7 inline-block w-4">5</span> BIDDER SHALL SUBMIT ORIGINAL BROCHURES SHOWING CERTIFICATIONS OF THE <br />
                      <span className="ml-7 inline-block w-4"></span> PRODUCT BEING OFFERED.<br />
                      <div className="flex" style={{ marginLeft: "0.5px" }}>
                        <span className="ml-7 inline-block w-4 font-bold">6</span>
                        <span className="font-bold">Approved Budget for the Contract (ABC)
                          <span className="ml-33 w-36 border-b border-black text-center pr-8">P <span className="ml-4">{formatCurrency(rfq.pr.totalAmount).replace('₱', '')}</span>
                          </span>
                        </span>
                      </div>
                    </div>

                    <table className="w-full border-collapse border-[3px] border-black mb-1 table-fixed">
                      <thead className="[&_th]:!font-sans" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
                        <tr>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-1 w-[6%] text-center align-middle font-bold">ITEM <br />NO.</th>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-2 text-center align-middle font-bold">ITEM & DESCRIPTION</th>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-1 w-[8%] text-center align-middle font-bold">QTY</th>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-1 w-[8%] text-center align-middle font-bold">UNIT</th>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-1 w-[16%] text-center align-middle font-bold">UNIT<br />PRICE</th>
                          <th style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="border-x border-b-[3px] border-black py-0 px-1 w-[16%] text-center align-middle font-bold">TOTAL<br />COST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfq.lineItems.map((item: any, idx: number) => {
                          const isSpec = !item.quantity || item.quantity === 0;

                          // Calculate item number dynamically
                          let displayNo = "";
                          if (!isSpec) {
                            let count = 0;
                            for (let i = 0; i <= idx; i++) {
                              if (rfq.lineItems[i].quantity > 0) count++;
                            }
                            displayNo = count.toString();
                          }

                          const hasSpecs = !isSpec && idx + 1 < rfq.lineItems.length && (!rfq.lineItems[idx + 1].quantity || rfq.lineItems[idx + 1].quantity === 0);

                          return (
                            <tr key={idx} className="h-6">
                              <td className="border-x border-black py-0 px-1 text-center align-top leading-normal">{displayNo}</td>
                              <td className={`border-x border-black py-0 px-2.5 align-top leading-normal ${isSpec ? "pl-6 text-[14px]" : (hasSpecs ? "font-bold" : "")}`}>{item.description}</td>
                              <td className="border-x border-black py-0 px-1 text-center align-top leading-normal">{isSpec ? "" : item.quantity}</td>
                              <td className="border-x border-black py-0 px-1 text-center align-top leading-normal">{isSpec ? "" : item.unit}</td>
                              <td className="border-x border-black py-0 px-2 text-center align-top">
                                {!isSpec && (
                                  <div className="flex items-end">
                                    <span className="mr-1">P ___________</span>
                                  </div>
                                )}
                              </td>
                              <td className="border-x border-black py-1 px-2 align-top">
                                {!isSpec && (
                                  <div className="flex items-end">
                                    <span className="mr-1">P ___________</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Empty rows filler */}
                        {Array.from({ length: Math.max(0, targetRows - rfq.lineItems.length) }).map((_, i) => (
                          <tr key={`empty-${i}`} className="h-6">
                            <td className="border-x border-black p-0"></td>
                            <td className="border-x border-black p-0"></td>
                            <td className="border-x border-black p-0"></td>
                            <td className="border-x border-black p-0"></td>
                            <td className="border-x border-black p-0"></td>
                            <td className="border-x border-black p-0"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-between items-end mb-2">
                      <div className="font-bold text-[14px]">GRAND TOTAL</div>
                      <div className="w-32 border-b-2 border-black pb-0.5 mt-4 mb-1 text-base text-right font-bold">
                        <div className="border-b-2 border-black w-full mt-0.5"></div>
                      </div>
                    </div>

                    <div className="pl-13 mb-10 text-[13px] leading-tight">
                      {rfq.pr.purpose}
                    </div>

                    <div className="mb-8 text-[13px] indent-[50px]">
                      After having carefully read and accepted your General Conditions, I/We quote you on the item<br />
                      at prices noted above.<br />
                    </div>

                    <div className="flex justify-end text-center mt-8 pb-4">
                      <div className="w-[250px]">
                        <div className="border-b border-black mb-1 h-4"></div>
                        <div className="mb-4 text-[13px]">Printed Name/Signature</div>
                        <div className="border-b border-black mb-1 h-4"></div>
                        <div className="text-[13px]">Tel No./ Cell phone No.</div>
                      </div>
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
        <div className="no-print w-[320px] lg:w-[340px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 flex flex-col overflow-y-auto">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">RFQ Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly ? "Read-only while the RFQ is issued." : "Update the details for the Request for Quotation."}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1">
            {/* Document Numbering */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    RFQ Number
                  </label>
                </div>
                <input
                  type="text"
                  {...register("rfqNumber")}
                  disabled={isReadOnly}
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
                  onClick={() => setShowRfqNo(!showRfqNo)}
                >
                  Show RFQ Number
                </label>
                <button
                  type="button"
                  onClick={() => setShowRfqNo(!showRfqNo)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    background: showRfqNo ? "#10b981" : "#cbd5e1",
                    position: "relative",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.3s",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  title={showRfqNo ? "Hide from document" : "Show on document"}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: "2px",
                      left: showRfqNo ? "22px" : "2px",
                      transition: "left 0.3s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </button>
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-semibold text-slate-700">Signatory</label>
              <select
                {...register("signatoryId")}
                disabled={isReadOnly}
                className="form-select"
              >
                <option value="">Select Signatory...</option>
                {signatories.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label text-xs font-semibold text-slate-700">Submission Deadline</label>
              <input
                type="date"
                {...register("deadline")}
                disabled={isReadOnly}
                className="form-input"
              />
              {!isReadOnly && (
                <p className="text-[11px] text-slate-500 mt-1">Required before the RFQ can be issued.</p>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100">
              {isReadOnly ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lock size={14} className="text-slate-400 shrink-0" />
                  <span>Fields are locked. Use Unlock to edit.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Details save automatically with the document.</span>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document has been finalized. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        requirePassword={true}
        isDestructive={true}
      />
    </div>
  );
}
