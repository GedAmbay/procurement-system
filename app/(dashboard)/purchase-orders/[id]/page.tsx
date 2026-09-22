"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, Send, ZoomIn, ZoomOut, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, numberToWords } from "@/lib/utils";

interface POFormValues {
  supplierId: string;
  deliveryDate: string;
  placeOfDelivery: string;
  deliveryTerms: string;
  paymentTerms: string;
  modeOfProcurement: string; // We'll store this in remarks for now if schema doesn't have it, or just use static for demo
}

export default function PurchaseOrderEditor() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [zoom, setZoom] = useState(0.85);
  const [targetRows, setTargetRows] = useState(10);

  const { register, handleSubmit, watch, reset, setValue } = useForm<POFormValues>({
    defaultValues: {
      supplierId: "",
      deliveryDate: "",
      placeOfDelivery: "LGU-PANDAN",
      deliveryTerms: "Full Delivery",
      paymentTerms: "Full Payment",
      modeOfProcurement: "Small Value",
    }
  });

  const watchAll = watch();

  useEffect(() => {
    async function loadData() {
      try {
        const [poRes, supRes] = await Promise.all([
          fetch(`/api/purchase-orders/${params.id}`),
          fetch(`/api/suppliers`)
        ]);

        if (poRes.ok && supRes.ok) {
          const data = await poRes.json();
          setPoData(data);
          setSuppliers(await supRes.json());

          reset({
            supplierId: data.supplierId || "",
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString().split('T')[0] : "",
            placeOfDelivery: data.placeOfDelivery || "LGU-PANDAN",
            deliveryTerms: data.deliveryTerms || "Full Delivery",
            paymentTerms: data.paymentTerms || "Full Payment",
            modeOfProcurement: "Small Value", // Mock field for template
          });
        } else {
          toast.error("Failed to load PO");
        }
      } catch (err) {
        toast.error("An error occurred loading data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, reset]);

  const onSubmit = async (data: POFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        supplierId: data.supplierId,
        deliveryDate: data.deliveryDate,
        placeOfDelivery: data.placeOfDelivery,
        deliveryTerms: data.deliveryTerms,
        paymentTerms: data.paymentTerms,
      };

      const res = await fetch(`/api/purchase-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setPoData((prev: any) => ({ ...prev, ...updated }));
        toast.success("Purchase Order saved successfully");
      } else {
        toast.error("Failed to save Purchase Order");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Status updated to ${status}`);
        setPoData((prev: any) => ({ ...prev, status }));
      }
    } catch (e) {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!poData) return <div className="p-8 text-center text-slate-500">PO not found</div>;

  const isReadOnly = poData.status === "COMPLETED";
  const selectedSupplier = suppliers.find(s => s.id === watchAll.supplierId) || poData.supplier;

  // Calculate exact PR number and ABC from nested relation if available
  const linkedPrNumber = poData.aoq?.rfq?.pr?.prNumber || "PENDING";
  const lineItems = poData.lineItems || [];

  return (
    <div className="flex flex-col h-screen max-h-[100vh] overflow-hidden bg-[var(--color-page-bg)] print:block print:!h-auto print:!overflow-visible">
      {/* Header */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/purchase-orders" className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">PO: {poData.poNumber}</h1>
            <p className="text-xs text-slate-500 font-medium">{poData.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn btn-secondary flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
          {!isReadOnly && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary flex items-center gap-2">
              <Save size={16} /> Save
            </button>
          )}
          {poData.status === "DRAFT" && (
            <button onClick={() => updateStatus("ISSUED")} className="btn btn-primary bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
              <Send size={16} /> Mark Issued
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
          <button type="button" onClick={() => setTargetRows(r => Math.min(r + 1, 30))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
        </div>

        {/* Left Side: Live Print Preview */}
        <div className="flex-1 overflow-auto bg-slate-200 print:p-0 print:bg-white print:block print:!overflow-visible print:!h-auto">
          <div className="p-8 print:p-0 w-max mx-auto min-w-full flex justify-center origin-top print:block print:w-full print:min-w-0 print:!transform-none print:!mb-0" style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 1056}px`, transition: "transform 0.2s ease" }}>
            <style>{`
              @media print { 
                @page { margin-top: 10mm !important; margin-bottom: 10mm !important; }
              }
            `}</style>
            <div className="print-area shadow-xl text-[14px] leading-tight print:shadow-none print:max-w-none print:m-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_td]:!text-[14px] w-[800px] min-h-[1056px] bg-white px-12 py-10 print:w-full print:min-h-0 print:p-0" style={{ fontFamily: "'Times New Roman', Times, serif" }}>

              <div className="border-[3px] border-black">
                <div className="text-right italic pt-2 pr-2 text-sm">Appendix 49</div>

                <div className="text-center font-bold mb-4">
                  <div className="text-2xl font-black font-serif">PURCHASE ORDER</div>
                  <div className="uppercase underline mt-1 text-[15px]">MUNICIPAL GOVERNMENT OF PANDAN</div>
                  <div className="text-[15px]">LGU</div>
                </div>

                <div className="border-t-[3px] border-black grid text-[15px]" style={{ gridTemplateColumns: '5rem 4rem minmax(0, 1fr) 5rem 7rem 8rem' }}>
                  <div className="col-span-3 border-r-[3px] border-black p-1 px-2 flex flex-col justify-between">
                    <div className="flex items-end"><span className="w-24 font-bold">Supplier :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{selectedSupplier?.name || ""}</span></div>
                    <div className="flex items-end mt-1"><span className="w-24 font-bold">Address :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{selectedSupplier?.address || ""}</span></div>
                    <div className="flex items-end mt-1"><span className="w-24 font-bold">TIN :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{selectedSupplier?.tin || ""}</span></div>
                  </div>
                  <div className="col-span-3 p-1 px-2 flex flex-col justify-between">
                    <div className="flex items-end"><span className="w-44 font-bold">P.O. No. :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{poData.poNumber}</span></div>
                    <div className="flex items-end mt-1"><span className="w-44 font-bold">Date :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{watchAll.deliveryDate ? new Date(watchAll.deliveryDate).toLocaleDateString('en-PH') : ""}</span></div>
                    <div className="flex items-end mt-1"><span className="w-44 font-bold">Mode of Procurement :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{watchAll.modeOfProcurement}</span></div>
                    <div className="flex items-end mt-1"><span className="w-44 font-bold">PR No./s :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{linkedPrNumber}</span></div>
                  </div>
                </div>

                <div className="border-t-[3px] border-black p-1 px-2 text-[15px]">
                  <div>Gentlemen:</div>
                  <div className="pl-8">Please furnish this Office the following articles subject to the terms and conditions contained herein:</div>
                </div>

                <div className="border-t-[3px] border-black grid text-[15px]" style={{ gridTemplateColumns: '5rem 4rem minmax(0, 1fr) 5rem 7rem 8rem' }}>
                  <div className="col-span-3 border-r-[3px] border-black p-1 px-2">
                    <div className="flex"><span className="font-bold w-36">Place of Delivery :</span> <span className="font-bold flex-1">{watchAll.placeOfDelivery}</span></div>
                    <div className="flex mt-1"><span className="font-bold w-36">Date of Delivery :</span> <span className="font-bold flex-1">{watchAll.deliveryDate ? new Date(watchAll.deliveryDate).toLocaleDateString('en-PH') : ""}</span></div>
                  </div>
                  <div className="col-span-3 p-1 px-2">
                    <div className="flex"><span className="font-bold w-32">Delivery Term :</span> <span className="font-bold flex-1">{watchAll.deliveryTerms}</span></div>
                    <div className="flex mt-1"><span className="font-bold w-32">Payment Term :</span> <span className="font-bold flex-1">{watchAll.paymentTerms}</span></div>
                  </div>
                </div>

                <table className="w-full border-collapse border-t-[3px] border-black">
                  <thead>
                    <tr className="border-b-[3px] border-black text-[14px]">
                      <th className="border-r border-black p-1 w-20">Stock/<br />Property No.</th>
                      <th className="border-r border-black p-1 w-16">Unit</th>
                      <th className="border-r border-black p-1">Description</th>
                      <th className="border-r border-black p-1 w-20">Quantity</th>
                      <th className="border-r border-black p-1 w-28">Unit Cost</th>
                      <th className="p-1 w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border-r border-black p-1 text-center">{idx + 1}</td>
                        <td className="border-r border-black p-1 text-center">{item.unit}</td>
                        <td className="border-r border-black p-1">{item.description}</td>
                        <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                        <td className="border-r border-black p-1 text-right">{formatCurrency(item.unitPrice).replace('₱', '')}</td>
                        <td className="p-1 text-right font-bold">{formatCurrency(item.totalPrice).replace('₱', '')}</td>
                      </tr>
                    ))}

                    {Array.from({ length: Math.max(0, targetRows - lineItems.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="h-6">
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="p-1"></td>
                      </tr>
                    ))}

                    {/* Footer signatory placeholder in table body */}
                    <tr>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black text-center font-bold italic py-4">Municipal Civil Registrar</td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>

                    <tr className="h-[3px] bg-black">
                      <td colSpan={6} className="p-0 border-0"></td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2} className="p-1 px-1 text-left whitespace-nowrap text-[12px] tracking-tight">(Total Amount in Words)</td>
                      <td colSpan={3} className="p-1 px-4 font-normal">{numberToWords(poData.totalAmount)}</td>
                      <td className="p-1 text-right">{formatCurrency(poData.totalAmount).replace('₱', '')}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-t-[3px] border-black p-4">
                  <div className="mb-6 indent-8 text-justify">
                    In case of failure to make the full delivery within the time specified above, a penalty of one-tenth (1/10) of one percent for every day of delay shall be imposed on the undelivered item/s.
                  </div>

                  <div className="flex mb-8">
                    <div className="w-1/2 pl-4">
                      <div className="mb-8">Conforme:</div>
                      <div className="text-center w-64 mx-auto">
                        <div className="border-b border-black h-4 mb-1"></div>
                        <div>Signature over Printed Name of Supplier</div>
                        <div className="border-b border-black h-8 mb-1 w-3/4 mx-auto"></div>
                        <div>Date</div>
                      </div>
                    </div>
                    <div className="w-1/2">
                      <div className="mb-8 pl-12">Very truly yours,</div>
                      <div className="text-center w-64 mx-auto font-bold mt-4">
                        HON. TOMAS U. ESTOPEREZ, JR.
                        <div className="font-normal">Municipal Mayor</div>
                      </div>
                      <div className="flex items-end justify-end pr-8 mt-6">
                        <span className="mr-2">Resolution No:</span>
                        <span className="border-b border-black w-24"></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t-[3px] border-black p-4 text-center">
                  <div className="mb-4">(In case of Negotiated Purchase pursuant to Section 369 (a) of RA 7160, this portion must be accomplished.)</div>
                  <div className="flex items-end justify-start mb-6">
                    <span className="mr-2">Approved per Sanggunian Resolution No.:</span>
                    <span className="border-b border-black flex-1 max-w-[400px]"></span>
                  </div>
                  <div className="text-left mb-8 pl-4">Certified Correct:</div>
                  <div className="flex justify-between px-16">
                    <div className="text-center w-64">
                      <div className="border-b border-black h-4 mb-1"></div>
                      <div>Secretary to the Sanggunian</div>
                    </div>
                    <div className="text-center w-32">
                      <div className="border-b border-black h-4 mb-1"></div>
                      <div>Date</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Data Entry Form */}
        <div className="no-print" style={{ width: "420px", flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "var(--color-page-bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", flex: 1 }}>
            <h3 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1.25rem", fontSize: "1rem" }}>PO Details</h3>

            <form className="space-y-5">
              <div>
                <label className="form-label">Awarded Supplier</label>
                <select
                  {...register("supplierId")}
                  className="form-select"
                  disabled={isReadOnly}
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Ideally set during AOQ, but can be forced here.</p>
              </div>

              <div>
                <label className="form-label">PO Date</label>
                <input
                  type="date"
                  {...register("deliveryDate")}
                  className="form-input"
                  disabled={isReadOnly}
                />
              </div>

              <div>
                <label className="form-label">Mode of Procurement</label>
                <input
                  {...register("modeOfProcurement")}
                  className="form-input"
                  disabled={isReadOnly}
                />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h4 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1rem", fontSize: "0.875rem" }}>Terms & Delivery</h4>

                <div className="space-y-4">
                  <div>
                    <label className="form-label">Place of Delivery</label>
                    <input
                      {...register("placeOfDelivery")}
                      className="form-input"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="form-label">Delivery Term</label>
                    <input
                      {...register("deliveryTerms")}
                      className="form-input"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="form-label">Payment Term</label>
                    <input
                      {...register("paymentTerms")}
                      className="form-input"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>

            </form>
          </div>

          <div style={{ padding: "1.25rem", background: "var(--color-page-bg)", borderTop: "1px solid #e2e8f0", position: "sticky", bottom: 0 }}>
            <div className="flex justify-between items-center text-lg font-bold text-slate-800">
              <span>PO Total:</span>
              <span className="text-emerald-600">{formatCurrency(poData.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
