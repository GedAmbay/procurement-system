"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut, Minus, Plus, Lock, Unlock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface AcceptanceFormValues {
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

      reset({
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : "",
        dateReceived: data.dateReceived ? new Date(data.dateReceived).toISOString().split('T')[0] : "",
        dateInspected: data.dateInspected ? new Date(data.dateInspected).toISOString().split('T')[0] : "",
        lineItems: data.lineItems.map((item: any) => ({
          id: item.id,
          description: item.poLineItem.description,
          unit: item.poLineItem.unit,
          unitPrice: item.poLineItem.unitPrice,
          poQuantity: item.poLineItem.quantity,
          quantityDelivered: item.quantityDelivered,
        }))
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
      if (!res.ok) throw new Error();
      toast.success("Acceptance report saved successfully");
      fetchAcceptance();
      setIsUnlocked(false);
    } catch (e) {
      toast.error("Failed to save");
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
    } catch (e) {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
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
    <div className="flex flex-col h-screen max-h-[100vh] overflow-hidden bg-[var(--color-page-bg)] print:block print:!h-auto print:!overflow-visible">
      {/* Header */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/purchase-orders" className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">IAR: {acceptance.iarNumber}</h1>
            <p className="text-xs text-slate-500 font-medium">{acceptance.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn btn-secondary flex items-center gap-2">
            <Printer size={16} /> Print
          </button>

          {acceptance.status === "DRAFT" && (
            <>
              <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary flex items-center gap-2">
                <Save size={16} /> Save
              </button>
              <button onClick={() => updateStatus("ISSUED")} className="btn btn-primary bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <CheckCircle2 size={16} /> Finalize
              </button>
            </>
          )}

          {acceptance.status !== "DRAFT" && (
            <button type="button" onClick={() => setIsUnlocked(!isUnlocked)} className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`}>
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}
          {isUnlocked && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary flex items-center gap-2">
              <Save size={16} /> Save Changes
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
          <button type="button" onClick={() => setTargetRows(r => Math.min(r + 1, 40))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
        </div>

        {/* Left Side: Live Print Preview */}
        <div className="flex-1 overflow-auto bg-slate-200 print:p-0 print:bg-white print:block print:!overflow-visible print:!h-auto">
          <div className="p-8 print:p-0 w-max mx-auto min-w-full flex justify-center origin-top print:block print:w-full print:min-w-0 print:!transform-none print:!mb-0" style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 1123}px`, transition: "transform 0.2s ease" }}>
            <div className="print-area shadow-xl text-[12px] leading-tight print:shadow-none print:max-w-none print:m-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_th]:!font-['Times_New_Roman',_Times,_serif]" style={{ width: "980px", minHeight: "1123px", background: "white", padding: "3rem", fontFamily: "'Times New Roman', Times, serif" }}>


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
                    <div className="flex font-bold"><span className="w-44">PO No. /Date:</span> <span className="flex-1 border-b border-black">{acceptance.po?.poNumber} / {acceptance.po?.createdAt ? new Date(acceptance.po.createdAt).toLocaleDateString() : ""}</span></div>
                    <div className="flex font-bold"><span className="w-44">Req. Office/Department:</span> <span className="flex-1 border-b border-black text-center">{acceptance.po?.aoq?.rfq?.pr?.office?.name}</span></div>
                  </div>
                  <div className="w-2/5 p-2 flex flex-col gap-1 justify-center">
                    <div className="flex font-bold"><span className="w-28">AIR No. :</span> <span className="flex-1 border-b border-black">{acceptance.iarNumber}</span></div>
                    <div className="flex font-bold"><span className="w-28">Date :</span> <span className="flex-1 border-b border-black">{new Date(acceptance.createdAt).toLocaleDateString()}</span></div>
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
                      if (item.quantityDelivered === 0) return null;
                      return (
                        <tr key={idx} className="h-6">
                          <td className="border-r-2 border-black border-b text-center" style={{ borderBottomStyle: 'dashed' }}>{idx + 1}</td>
                          <td className="border-r-2 border-black border-b px-2" style={{ borderBottomStyle: 'dashed' }}>{item.description}</td>
                          <td className="border-r-2 border-black border-b text-center" style={{ borderBottomStyle: 'dashed' }}>{item.unit}</td>
                          <td className="border-b text-center font-bold" style={{ borderBottomStyle: 'dashed' }}>{item.quantityDelivered}</td>
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
                  <div className="w-1/2 border-r-2 border-black p-4 flex flex-col justify-between" style={{ minHeight: "220px" }}>
                    <div>
                      <div className="text-center font-bold mb-2">ACCEPTANCE</div>
                      <div className="flex mb-4">
                        <span className="font-bold w-28">Date Received:</span>
                        <span className="flex-1 border-b border-black text-center">{watchAll.dateReceived ? new Date(watchAll.dateReceived).toLocaleDateString() : ""}</span>
                      </div>

                      <div className="pl-6 mb-4">
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

                    <div className="mt-8 text-center flex flex-col gap-6">
                      <div className="relative">
                        <div className="font-bold underline uppercase">HON. TOMAS U. ESTOPEREZ JR.</div>
                        <div className="text-xs">Requisitioning Officer</div>
                      </div>
                      <div className="text-left text-xs">Received By:</div>
                      <div className="relative mt-4">
                        <div className="font-bold underline uppercase">FLORIME Y. OLANDRES</div>
                        <div className="text-xs">Requisitioning Officer</div>
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2 p-4 flex flex-col justify-between" style={{ minHeight: "220px" }}>
                    <div>
                      <div className="text-center font-bold mb-2">INSPECTION</div>
                      <div className="flex mb-4">
                        <span className="font-bold w-28">Date Inspected:</span>
                        <span className="flex-1 border-b border-black text-center">{watchAll.dateInspected ? new Date(watchAll.dateInspected).toLocaleDateString() : ""}</span>
                      </div>

                      <div className="pl-6 mb-4 flex gap-2">
                        <div className="w-4 h-4 border border-black flex flex-shrink-0 items-center justify-center font-bold text-xs mt-1">/</div>
                        <div className="leading-tight">
                          Inspected, verified and found <span className="font-bold">OK</span><br />
                          as to quantity and specifications
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-between gap-2 text-center">
                      <div className="flex-1">
                        <div className="font-bold underline uppercase">EDSEL J. AMBUBUYOG</div>
                        <div className="text-xs leading-tight">Chairman, Committee on<br />Inspection/Acting Mun. Treasurer</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold underline uppercase">HON. TOMAS U. ESTOPEREZ JR.</div>
                        <div className="text-xs leading-tight">Requisitioning Officer</div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-between gap-2 text-center">
                      <div className="flex-1">
                        <div className="font-bold underline uppercase">CARLOS O. SUAN JR.</div>
                        <div className="text-xs leading-tight">Member/ PDO II</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold underline uppercase">RUEL E. CASIDSID</div>
                        <div className="text-xs leading-tight">Member/Draftsman III</div>
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

        {/* Right Side: Data Entry Form */}
        <div className="no-print" style={{ width: "420px", flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "var(--color-page-bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", flex: 1 }}>
            <h3 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1.25rem", fontSize: "1rem" }}>Acceptance Details</h3>

            <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                    return (
                      <div key={field.id} className="p-3 bg-white rounded-lg shadow-sm border border-slate-100 flex flex-col gap-2">
                        <div className="text-xs font-semibold text-slate-700">{itemDesc}</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-500">Ordered: {maxQty}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Delivered:</span>
                            <input
                              type="number"
                              step="1"
                              max={maxQty}
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

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
