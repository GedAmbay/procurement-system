"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, LGU_INFO } from "@/lib/utils";

interface QuoteLineItem {
  id: string;
  rfqLineItemId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteFormValues {
  submittedAt: string;
  remarks: string;
  lineItems: QuoteLineItem[];
}

export default function SupplierEncodingPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const { register, control, handleSubmit, watch, reset, setValue } = useForm<QuoteFormValues>({
    defaultValues: {
      submittedAt: "",
      remarks: "",
      lineItems: [],
    }
  });

  const { fields } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchLineItems = watch("lineItems");
  const totalAmount = watchLineItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/quotations/${params.supplierId}`);
        if (res.ok) {
          const data = await res.json();
          setQuoteData(data);

          // Match the quotation line items with the RFQ line items for display
          const mappedLineItems = data.rfq.lineItems.map((rfqItem: any) => {
            const quoteItem = data.lineItems.find((q: any) => q.rfqLineItemId === rfqItem.id);
            return {
              id: quoteItem?.id || "",
              rfqLineItemId: rfqItem.id,
              description: rfqItem.description,
              unit: rfqItem.unit,
              quantity: rfqItem.quantity,
              unitPrice: quoteItem?.unitPrice || 0,
            };
          });

          reset({
            submittedAt: data.submittedAt ? new Date(data.submittedAt).toISOString().split('T')[0] : "",
            remarks: data.remarks || "",
            lineItems: mappedLineItems,
          });
        }
      } catch (err) {
        toast.error("Failed to load quotation data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.supplierId, reset]);

  const onSubmit = async (data: QuoteFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        lineItems: data.lineItems.map(item => ({
          id: item.id,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.quantity) * Number(item.unitPrice),
        }))
      };

      const res = await fetch(`/api/quotations/${params.supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Supplier bid encoded successfully");
        router.push(`/rfqs/${params.id}`);
      } else {
        toast.error("Failed to save quotation");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!quoteData) return <div>Error loading data</div>;

  const { rfq, supplier } = quoteData;
  const isCompleted = rfq.status === "COMPLETED";

  return (
    <div className="flex flex-col overflow-hidden print:block print:!h-auto print:!overflow-visible" style={{ height: 'calc(var(--full-vh) - 128px)' }}>
      {/* Header */}
      <div className="no-print flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link href={`/rfqs/${params.id}`} className="text-slate-500 hover:text-slate-800 transition-colors bg-white hover:bg-slate-100 p-2 rounded-full border border-slate-200 shadow-sm flex items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Encode Bid: {supplier.name}</h1>
            <p className="text-xs text-slate-500 font-medium">RFQ: {rfq.rfqNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn flex items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm">
            <Printer size={16} /> Print
          </button>
          {!isCompleted && (
            <button onClick={handleSubmit(onSubmit)} disabled={submitting} className="btn btn-primary flex items-center gap-2">
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
            <div className="print-area w-[816px] bg-white shadow-xl min-h-[1056px] p-10 print:shadow-none print:w-full print:max-w-none print:p-8 print:m-0 print:min-h-0 font-sans text-[11px]">

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

              <div className="flex justify-end mb-4 text-[12px]">
                <div className="w-[245px]">
                  <div className="flex mb-1"><span className="w-10">Date:</span> <span className="border-b border-black flex-1 text-center">{new Date().toLocaleDateString('en-PH')}</span></div>
                  <div className="flex mb-1"><span className="w-16">Quotation:</span> <span className="border-b border-black flex-1 text-center font-bold">{rfq.rfqNumber}</span></div>
                </div>
              </div>

              <div className="mb-4 text-[12px]">
                <div className="flex mb-1 w-[400px]"><span className="w-16">Company</span> <span className="border-b border-black flex-1 uppercase font-bold">{supplier.name}</span></div>
                <div className="flex mb-1 w-[400px]"><span className="w-16">Address</span> <span className="border-b border-black flex-1">{supplier.address || "__________________________"}</span></div>
              </div>

              <div className="mb-8 pl-8 text-[12px]">
                Please quote your lowest price on the item(s) listed below, subject to the General Conditions on the last page, stating the <br />
                shortest time of the delivery and submit your quotation duly signed by your representative not later than ___________________________ <br />
                in the return envelope attached herewith.
              </div>

              <div className="flex justify-end mb-6 text-center">
                <div className="w-[250px]">
                  <div className="font-bold px-4 text-[14px]">JEFFY S. CANGAYDA</div>
                  <div>BAC Chairman</div>
                </div>
              </div>

              <div className="mb-4 text-xs font-bold leading-tight">
                NOTE:<br />
                <span className="ml-4 inline-block w-4">1</span> DELIVERY PERIOD WITHIN _____________________ CALENDAR DAYS.<br />
                <span className="ml-4 inline-block w-4">2</span> WARRANTY SHALL BE FOR A PERIOD OF SIX (6) MONTHS FOR SUPPLIES & MATERIALS. ONE (1) YEAR FOR<br />
                <span className="ml-4 inline-block w-4"></span>  EQUIPMENT, FROM DATE OF ACCEPTANCE BY THE PROCURING ENTITY.<br />
                <span className="ml-4 inline-block w-4">3</span> PRICE VALIDITY SHALL BE FOR A PERIOD OF <span className="underline">THIRTY (30)</span> CALENDAR DAYS.<br />
                <span className="ml-4 inline-block w-4">4</span> G-EPS REGISTRATION CERTIFICATE SHALL BE ATTACHED UPON SUBMISSION OF THE QUOTATION.<br />
                <span className="ml-4 inline-block w-4">5</span> BIDDER SHALL SUBMIT ORIGINAL BROCHURES SHOWING CERTIFICATIONS OF THE PRODUCT BEING OFFERED.<br />
                <div className="flex" style={{ marginLeft: "0.5px" }}>
                  <span className="ml-4 inline-block w-4 font-bold">6</span>
                  <span className="font-bold">Approved Budget for the Contract (ABC)
                    <span className="ml-69 w-32 border-b border-black text-center pr-8">P <span className="ml-4">{formatCurrency(rfq.pr.totalAmount).replace('₱', '')}</span>
                    </span>
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse border-2 border-black mb-1">
                <thead>
                  <tr>
                    <th className="border border-black p-1 w-10">Item<br />No</th>
                    <th className="border border-black p-1 text-center">ITEM & DESCRIPTION</th>
                    <th className="border border-black p-1 w-12">QTY</th>
                    <th className="border border-black p-1 w-18">Unit</th>
                    <th className="border border-black p-1 w-28">Unit<br />Price</th>
                    <th className="border border-black p-1 w-28">TOTAL<br />COST</th>
                  </tr>
                </thead>
                <tbody>
                  {watchLineItems.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => !isCompleted && setActiveItemIndex(idx)}
                      className={`${!isCompleted ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''} ${activeItemIndex === idx ? 'bg-blue-100' : ''}`}
                    >
                      <td className="border border-black p-0 text-center">{idx + 1}</td>
                      <td className="border border-black p-0 pl-2">{item.description}</td>
                      <td className="border border-black p-0 text-center">{item.quantity}</td>
                      <td className="border border-black p-0 text-center">{item.unit}</td>
                      <td className="border border-black p-0 pr-2 text-right">{item.unitPrice > 0 ? formatCurrency(item.unitPrice).replace('₱', '') : ""}</td>
                      <td className="border border-black p-0 pr-2 text-right font-semibold">{(item.unitPrice > 0) ? formatCurrency(item.quantity * item.unitPrice).replace('₱', '') : ""}</td>
                    </tr>
                  ))}
                  {/* Empty rows filler */}
                  {Array.from({ length: Math.max(0, 15 - watchLineItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-end mb-2">
                <div className="font-bold text-[14px]">GRAND TOTAL</div>
                <div className="w-32 border-b-2 border-black pb-0.5 mb-1 text-base text-right font-bold">
                  {totalAmount > 0 ? formatCurrency(totalAmount).replace('₱', '') : ""}
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
                  <div className="mb-4 text-[12px]">Printed Name/Signature</div>
                  <div className="border-b border-black mb-1 h-4"></div>
                  <div className="text-[12px]">Tel No./ Cell phone No.</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Data Entry Form (No Print) */}
        <div className="no-print w-[500px] border-l border-slate-200 bg-white overflow-y-auto flex flex-col">
          <div className="p-5 flex-1">
            <h3 className="font-bold text-slate-800 mb-4 text-lg">Encode Bid Amount</h3>
            <p className="text-sm text-slate-500 mb-6">Enter the prices returned by the supplier. Leave blank or 0 if they did not bid on an item.</p>

            <form className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date Received</label>
                <input
                  type="date"
                  {...register("submittedAt")}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  disabled={isCompleted}
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-700 text-sm">
                    {activeItemIndex !== null ? "Encode Bid Amount" : "Line Items"}
                  </h4>
                  {activeItemIndex !== null && !isCompleted && (
                    <button
                      type="button"
                      onClick={() => setActiveItemIndex(null)}
                      className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-md font-semibold transition-colors btn btn-secondary"
                    >
                      Cancel Selection
                    </button>
                  )}
                </div>

                {!isCompleted && activeItemIndex !== null ? (
                  <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                    <div className="text-sm font-semibold text-slate-700 mb-1">{watchLineItems[activeItemIndex].description}</div>
                    <div className="text-xs text-slate-500 mb-4">Qty: {watchLineItems[activeItemIndex].quantity} {watchLineItems[activeItemIndex].unit}</div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                        <input
                          type="number"
                          step="0.01"
                          {...register(`lineItems.${activeItemIndex}.unitPrice`)}
                          className="w-full p-2 pl-7 border border-slate-300 rounded-md text-sm bg-white text-right font-medium"
                          disabled={isCompleted}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-4">
                      <div className="text-sm font-bold text-emerald-600">
                        Estimated Cost: {formatCurrency(watchLineItems[activeItemIndex].quantity * (watchLineItems[activeItemIndex].unitPrice || 0))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeItemIndex < fields.length - 1) {
                            setActiveItemIndex(activeItemIndex + 1);
                          } else {
                            setActiveItemIndex(null);
                          }
                        }}
                        className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-1.5 rounded-md text-xs font-semibold transition-colors btn btn-primary"
                      >
                        {activeItemIndex < fields.length - 1 ? "Next Item" : "Done"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm">
                    Select a line item from the printed form on the left to encode its bid amount.
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 sticky bottom-0">
            <div className="flex justify-between items-center text-lg font-bold text-slate-800">
              <span>Total Bid:</span>
              <span className="text-emerald-600">{formatCurrency(totalAmount)}</span>
            </div>

          </div>
        </div>
      </div>
    </div >
  );
}
