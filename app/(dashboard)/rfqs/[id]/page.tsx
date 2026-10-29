"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut, Send, Clock, CheckCircle2, Lock, Unlock, Minus, Plus, User } from "lucide-react";
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

  return (
    <div className="flex flex-col overflow-hidden print:block print:!h-auto print:!overflow-visible" style={{ height: 'calc(var(--full-vh) - 173px)' }}>
      {/* Header */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/rfqs" className="text-slate-500 hover:text-slate-800 transition-colors bg-white hover:bg-slate-100 p-2 rounded-full border border-slate-200 shadow-sm flex items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800">Live Preview</h1>
              <span className="badge" style={{
                background: rfq.status === "COMPLETED" ? "#f0fdf4" : (rfq.status === "ISSUED" ? "#eff6ff" : "#fef3c7"),
                color: rfq.status === "COMPLETED" ? "#16a34a" : (rfq.status === "ISSUED" ? "#2563eb" : "#b45309"),
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontWeight: 700
              }}>
                {rfq.status === "COMPLETED" && <CheckCircle2 size={12} />}
                {rfq.status.replace(/_/g, ' ')}
              </span>
            </div>

          </div>
        </div>
        <div className="flex gap-2">
          {rfq.abstract && (
            <Link
              href={`/abstract/${rfq.abstract.id}`}
              className="btn flex items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
            >
              Abstract Hub
            </Link>
          )}
          {rfq.status === "DRAFT" && (
            <button
              onClick={() => updateStatus("ISSUED")}
              disabled={submitting}
              className="btn btn-primary flex items-center gap-2"
            >
              <Send size={16} /> Issue
            </button>
          )}
          {(rfq.status === "ISSUED" || rfq.status === "COMPLETED") && (
            <button
              type="button"
              onClick={() => isUnlocked ? setIsUnlocked(false) : setUnlockModalOpen(true)}
              className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`}
            >
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}
          <button onClick={() => window.print()} className="btn flex items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm">
            <Printer size={16} /> Print
          </button>
          {!isReadOnly && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary flex items-center gap-2">
              <Save size={16} /> Save
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative print:block print:!h-auto print:!overflow-visible">
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

        {/* Left Side: Live Print Preview */}
        <div className="flex-1 overflow-auto bg-slate-200 print:p-0 print:bg-white print:block print:!overflow-visible print:!h-auto">
          <div className="p-8 print:p-0 w-max mx-auto min-w-full flex justify-center origin-top print:block print:w-full print:min-w-0 print:!transform-none print:!mb-0" style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 1123}px` }}>

            <div className="print-area text-black w-[794px] bg-white shadow-xl min-h-[1123px] p-10 print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0 print:min-h-0 font-sans text-[11px]">

              {/* Header Layout per Template */}
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold italic text-[12px]">LGU of PANDAN, ANTIQUE</div>
                <div className="w-[280px]">
                  <div className="flex mt-4"><span className="w-40 text-right pr-2 italic">Project Reference Number</span> <span className="border-b border-black flex-1"></span></div>
                  <div className="flex"><span className="w-40 text-right pr-2 italic">Name of the Project</span> <span className="border-b border-black flex-1"></span></div>
                  <div className="flex"><span className="w-40 text-right pr-2 italic">Location of the Project</span> <span className="border-b border-black flex-1"></span></div>
                </div>
              </div>

              <div className="mb-2">
                <div >Standard Form Number: SF-GOOD-60</div>
                <div>Revised on: May 24, 2004</div>
                <h2 className="text-[25px]">Standard Form Title: <span className="font-bold text-[25px] italic">REQUEST FOR QUOTATION</span></h2>
              </div>

              <div className="flex justify-end mb-4 text-[13px]">
                <div className="w-[245px]">
                  <div className="flex mb-1"><span className="w-10">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
                  <div className="flex mb-1"><span className="w-16">Quotation:</span> <span className="border-b border-black flex-1 text-center font-bold">{showRfqNo ? (watchRfqNumber || rfq.rfqNumber || "") : ""}</span></div>
                </div>
              </div>

              <div className="mb-4 text-[13px]">
                <div className="flex mb-1 w-[400px]"><span className="w-16">Company</span> <span className="border-b border-black flex-1 uppercase font-bold"></span></div>
                <div className="flex mb-1 w-[400px]"><span className="w-16">Address</span> <span className="border-b border-black flex-1"></span></div>
              </div>

              <div className="mb-8 indent-[28px] text-[13px]">
                Please quote your lowest price on the item(s) listed below, subject to the General Conditions on the last page, <br />
                stating the shortest time of the delivery and submit your quotation duly signed by your representative not later <br />
                than <span className="font-bold underline">{watchDeadline ? formatDate(watchDeadline) : (rfq.deadline ? formatDate(rfq.deadline) : "___________________________")}</span> in the return envelope attached herewith. <br />
              </div>

              <div className="flex justify-end mb-6 text-center">
                <div className="w-[250px]">
                  <div className="font-bold px-4 text-[16px] uppercase">{selectedSignatory?.name || "JEFFY S. CANGAYDA"}</div>
                  <div className="text-[13px]">BAC Chairman</div>
                </div>
              </div>

              <div className="mb-4 text-xs font-bold leading-tight text-[13px]">
                NOTE:<br />
                <span className="ml-4 inline-block w-4">1</span> DELIVERY PERIOD WITHIN _____________________ CALENDAR DAYS.<br />
                <span className="ml-4 inline-block w-4">2</span> WARRANTY SHALL BE FOR A PERIOD OF SIX (6) MONTHS FOR SUPPLIES & MATERIALS. ONE (1) YEAR<br />
                <span className="ml-4 inline-block w-4"></span>  FOR EQUIPMENT, FROM DATE OF ACCEPTANCE BY THE PROCURING ENTITY.<br />
                <span className="ml-4 inline-block w-4">3</span> PRICE VALIDITY SHALL BE FOR A PERIOD OF <span className="underline">THIRTY (30)</span> CALENDAR DAYS.<br />
                <span className="ml-4 inline-block w-4">4</span> G-EPS REGISTRATION CERTIFICATE SHALL BE ATTACHED UPON SUBMISSION OF THE QUOTATION.<br />
                <span className="ml-4 inline-block w-4">5</span> BIDDER SHALL SUBMIT ORIGINAL BROCHURES SHOWING CERTIFICATIONS OF THE PRODUCT<br />
                <span className="ml-4 inline-block w-4"></span> BEING OFFERED.<br />
                <div className="flex" style={{ marginLeft: "0.5px" }}>
                  <span className="ml-4 inline-block w-4 font-bold">6</span>
                  <span className="font-bold">Approved Budget for the Contract (ABC)
                    <span className="ml-69 w-36 border-b border-black text-center pr-8">P <span className="ml-4">{formatCurrency(rfq.pr.totalAmount).replace('₱', '')}</span>
                    </span>
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse border-[3px] border-black mb-1 table-fixed">
                <thead>
                  <tr>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 w-[8%] text-center align-middle">ITEM <br />NO</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 text-center align-middle">ITEM & DESCRIPTION</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 w-[6%] text-center align-middle">QTY</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 w-[8%] text-center align-middle">UNIT</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 w-[13%] text-center align-middle">UNIT<br />PRICE</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-0 w-[13%] text-center align-middle">TOTAL<br />COST</th>
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
                      <tr key={idx} className="h-8">
                        <td className="border-x-[3px] border-black p-1 text-center align-top">{displayNo}</td>
                        <td className={`border-x-[3px] border-black p-1 align-top ${isSpec ? "pl-4 text-[13px]" : (hasSpecs ? "font-bold" : "")}`}>{item.description}</td>
                        <td className="border-x-[3px] border-black p-1 text-center align-top">{isSpec ? "" : item.quantity}</td>
                        <td className="border-x-[3px] border-black p-1 text-center align-top">{isSpec ? "" : item.unit}</td>
                        <td className="border-x-[3px] border-black p-1 text-center align-top">
                          {!isSpec && (
                            <div className="flex items-end">
                              <span className="mr-1">P</span>
                              <span className="flex-1 border-b border-black pb-4"></span>
                            </div>
                          )}
                        </td>
                        <td className="border-x-[3px] border-black p-1 align-top">
                          {!isSpec && (
                            <div className="flex items-end">
                              <span className="mr-1">P</span>
                              <span className="flex-1 border-b border-black pb-4"></span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Empty rows filler */}
                  {Array.from({ length: Math.max(0, targetRows - rfq.lineItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-6">
                      <td className="border-x-[3px] border-black p-0"></td>
                      <td className="border-x-[3px] border-black p-0"></td>
                      <td className="border-x-[3px] border-black p-0"></td>
                      <td className="border-x-[3px] border-black p-0"></td>
                      <td className="border-x-[3px] border-black p-0"></td>
                      <td className="border-x-[3px] border-black p-0"></td>
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

              <div className="pl-6 mb-10 text-[13px] leading-tight">
                {rfq.pr.purpose}
              </div>

              <div className="mb-8 text-[13px] indent-[28px]">
                After having carefully read and accepted your General Conditions, I/We quote you on the item
                at prices noted above.
              </div>

              <div className="flex justify-end text-center mt-12">
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

        {/* Right Side: Data Entry Form */}
        <div className="no-print" style={{ width: "340px", flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "var(--color-page-bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", flex: 1 }}>
            <h3 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1.25rem", fontSize: "1rem" }}>RFQ Details</h3>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.5rem" }}>Update the details for the Request for Quotation.</p>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
                    Print RFQ Number on document
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
                <label className="form-label">Signatory</label>
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
                <label className="form-label">Submission Deadline</label>
                <input
                  type="date"
                  {...register("deadline")}
                  disabled={isReadOnly}
                  className="form-input"
                />
              </div>

              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Details
                </button>
              )}
            </form>
          </div>
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
    </div >
  );
}
