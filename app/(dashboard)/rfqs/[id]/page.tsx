"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut, Send, Clock, CheckCircle2, Lock, Unlock, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function RfqLivePreviewPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rfq, setRfq] = useState<any>(null);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [targetRows, setTargetRows] = useState(8);

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      signatoryId: "",
    }
  });

  const watchSignatoryId = watch("signatoryId");

  useEffect(() => {
    async function loadData() {
      try {
        const [rfqRes, sigRes] = await Promise.all([
          fetch(`/api/rfqs/${params.id}`),
          fetch("/api/signatories")
        ]);

        if (sigRes.ok) {
          setSignatories(await sigRes.json());
        }

        if (rfqRes.ok) {
          const data = await rfqRes.json();
          setRfq(data);
          reset({
            signatoryId: data.signatoryId || "",
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
        signatoryId: data.signatoryId || null,
      };

      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok || res.status === 400) {
        toast.success("RFQ details saved successfully");
        // fetch data again
        const refreshRes = await fetch(`/api/rfqs/${params.id}`);
        if (refreshRes.ok) setRfq(await refreshRes.json());
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (status === "ISSUED" && !watchSignatoryId) {
      toast.error("Please select a signatory and save before issuing");
      return;
    }

    try {
      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
        const data = await res.json();
        setRfq(data);
      }
    } catch (e) {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!rfq) return <div>Error loading data</div>;

  const isReadOnly = rfq.status !== "DRAFT" && !isUnlocked;

  return (
    <div className="flex flex-col overflow-hidden print:block print:!h-auto print:!overflow-visible" style={{ height: 'calc(var(--full-vh) - 128px)' }}>
      {/* Header */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/rfqs" className="text-slate-500 hover:text-slate-800 transition-colors bg-white hover:bg-slate-100 p-2 rounded-full border border-slate-200 shadow-sm flex items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Request for Quotation</h1>
            <p className="text-xs text-slate-500 font-medium">{rfq.rfqNumber} • Status: <strong className="text-slate-700">{rfq.status.replace(/_/g, ' ')}</strong></p>
          </div>
        </div>
        <div className="flex gap-2">
          {rfq.status === "DRAFT" && (
            <button onClick={() => updateStatus("ISSUED")} className="btn btn-primary flex items-center gap-2">
              <Send size={16} /> Mark as Issued
            </button>
          )}
          {rfq.status === "ISSUED" && (
            <>
              <button type="button" onClick={() => setIsUnlocked(!isUnlocked)} className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`}>
                {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
              </button>
              <button onClick={() => updateStatus("CLOSED")} className="btn bg-success text-success flex items-center gap-2">
                <CheckCircle2 size={16} /> Close RFQ
              </button>
            </>
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
            <div className="print-area text-black w-[800px] bg-white shadow-xl min-h-[1123px] p-10 print:shadow-none print:w-full print:max-w-none print:p-8 print:m-0 print:min-h-0 font-sans text-[11px]">

              {/* Header Layout per Template */}
              <div className="flex justify-between items-start mb-6">
                <div className="font-bold italic text-[12px]">LGU of PANDAN, ANTIQUE</div>
                <div className="w-[280px]">
                  <div className="flex mb-1"><span className="w-40 text-right pr-2 italic">Project Reference Number</span> <span className="border-b border-black flex-1"></span></div>
                  <div className="flex mb-1"><span className="w-40 text-right pr-2 italic">Name of the Project</span> <span className="border-b border-black flex-1"></span></div>
                  <div className="flex mb-1"><span className="w-40 text-right pr-2 italic">Location of the Project</span> <span className="border-b border-black flex-1"></span></div>
                </div>
              </div>

              <div className="mb-6">
                <div>Standard Form Number: SF-GOOD-60</div>
                <div>Revised on: May 24, 2004</div>
                <h2 className="text-[25px] mt-1">Standard Form Title: <span className="font-bold text-[25px] mt-1 italic">REQUEST FOR QUOTATION</span></h2>
              </div>

              <div className="flex justify-end mb-4 text-[13px]">
                <div className="w-[245px]">
                  <div className="flex mb-1"><span className="w-10">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
                  <div className="flex mb-1"><span className="w-16">Quotation:</span> <span className="border-b border-black flex-1 text-center font-bold">{rfq.rfqNumber}</span></div>
                </div>
              </div>

              <div className="mb-4 text-[13px]">
                <div className="flex mb-1 w-[400px]"><span className="w-16">Company</span> <span className="border-b border-black flex-1 uppercase font-bold"></span></div>
                <div className="flex mb-1 w-[400px]"><span className="w-16">Address</span> <span className="border-b border-black flex-1"></span></div>
              </div>

              <div className="mb-8 indent-[28px] text-[13px]">
                Please quote your lowest price on the item(s) listed below, subject to the General Conditions on the last page, <br />
                stating the shortest time of the delivery and submit your quotation duly signed by your representative not later <br />
                than ___________________________ in the return envelope attached herewith. <br />
              </div>

              <div className="flex justify-end mb-6 text-center">
                <div className="w-[250px]">
                  <div className="font-bold px-4 text-[16px] uppercase">{rfq.signatory?.name || "JEFFY S. CANGAYDA"}</div>
                  <div>{rfq.signatory?.position || "BAC Chairman"}</div>
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
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 w-[5%] text-center align-middle">ITEM <br />NO</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 text-center align-middle">ITEM & DESCRIPTION</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 w-[6%] text-center align-middle">QTY</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 w-[8%] text-center align-middle">UNIT</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 w-[13%] text-center align-middle">UNIT<br />PRICE</th>
                    <th className="border-x-[3px] border-b-[3px] border-black p-1 w-[13%] text-center align-middle">TOTAL<br />COST</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.lineItems.map((item: any, idx: number) => (
                    <tr key={idx} className="h-8">
                      <td className="border-x-[3px] border-black px-1 py-2 text-center align-top">{idx + 1}</td>
                      <td className="border-x-[3px] border-black px-2 py-2 align-top">{item.description}</td>
                      <td className="border-x-[3px] border-black px-1 py-2 text-center align-top">{item.quantity}</td>
                      <td className="border-x-[3px] border-black px-1 py-2 text-center align-top">{item.unit}</td>
                      <td className="border-x-[3px] border-black px-2 py-2 align-top">
                        <div className="flex items-end">
                          <span className="mr-1">P</span>
                          <span className="flex-1 border-b border-black pb-4"></span>
                        </div>
                      </td>
                      <td className="border-x-[3px] border-black px-2 py-2 align-top">
                        <div className="flex items-end">
                          <span className="mr-1">P</span>
                          <span className="flex-1 border-b border-black pb-4"></span>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                <div className="w-32 border-b-2 border-black pb-0.5 mb-1 text-base text-right font-bold">
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

            <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="form-label">Signatory</label>
                <select
                  {...register("signatoryId")}
                  disabled={isReadOnly}
                  className="form-select"
                >
                  <option value="">Select Signatory...</option>
                  {signatories.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                  ))}
                </select>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div >
  );
}
