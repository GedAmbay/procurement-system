"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Printer, Save, ArrowLeft, Loader2, Send, ZoomIn, ZoomOut, Minus, Plus, Package, FileText, ChevronRight, CheckCircle2, XCircle, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, numberToWords } from "@/lib/utils";

interface POFormValues {
  poNumber?: string;
  supplierId: string;
  deliveryDate: string;
  placeOfDelivery: string;
  deliveryTerms: string;
  paymentTerms: string;
  modeOfProcurement: string; // We'll store this in remarks for now if schema doesn't have it, or just use static for demo
  orderType: string;
  requestingOffice?: string;
}

export default function PurchaseOrderEditor() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  const [zoom, setZoom] = useState(0.85);
  const [targetRows, setTargetRows] = useState(10);
  const [showPoNo, setShowPoNo] = useState(false);
  const [showPrNo, setShowPrNo] = useState(false);
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

  const { register, handleSubmit, watch, reset, setValue } = useForm<POFormValues>({
    defaultValues: {
      poNumber: "",
      supplierId: "",
      deliveryDate: "",
      placeOfDelivery: "LGU-PANDAN",
      deliveryTerms: "Full Delivery",
      paymentTerms: "Full Payment",
      modeOfProcurement: "Small Value",
      orderType: "PURCHASE",
      requestingOffice: "",
    }
  });

  const watchAll = watch();
  const watchOrderType = watch("orderType") || poData?.orderType || poData?.abstract?.rfq?.pr?.requestType || poData?.pr?.requestType || "PURCHASE";
  const isJob = watchOrderType === "JOB";

  useEffect(() => {
    async function loadData() {
      try {
        const [poRes, supRes, offRes] = await Promise.all([
          fetch(`/api/purchase-orders/${params.id}`),
          fetch(`/api/suppliers`),
          fetch(`/api/offices`),
        ]);

        if (offRes.ok) {
          const allOffices = await offRes.json();
          setOffices(allOffices);
        }

        if (poRes.ok && supRes.ok) {
          const data = await poRes.json();
          setPoData(data);
          if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
          const allSups = await supRes.json();
          setSuppliers(allSups);

          // Find awarded quote if supplierId is not yet saved on po
          const validQuotes = data.abstract?.rfq?.quotations?.filter((q: any) => (q.totalAmount || 0) > 0) || [];
          const winningQuote = validQuotes.length > 0
            ? validQuotes.reduce((prev: any, curr: any) => (prev.totalAmount < curr.totalAmount ? prev : curr))
            : null;

          const resolvedSupplierId = data.supplierId || winningQuote?.supplierId || "";
          const initialOrderType = data.orderType || data.abstract?.rfq?.pr?.requestType || data.pr?.requestType || "PURCHASE";
          const defaultOffice =
            data.remarks ||
            data.abstract?.rfq?.pr?.office?.name ||
            data.pr?.office?.name ||
            "Municipal Civil Registrar";

          reset({
            poNumber: data.poNumber || "",
            supplierId: resolvedSupplierId,
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString().split('T')[0] : "",
            placeOfDelivery: data.placeOfDelivery || "LGU-PANDAN",
            deliveryTerms: data.deliveryTerms || "Full Delivery",
            paymentTerms: data.paymentTerms || "Full Payment",
            modeOfProcurement: "Small Value",
            orderType: initialOrderType,
            requestingOffice: defaultOffice,
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
        poNumber: data.poNumber,
        supplierId: data.supplierId,
        deliveryDate: data.deliveryDate,
        placeOfDelivery: data.placeOfDelivery,
        deliveryTerms: data.deliveryTerms,
        paymentTerms: data.paymentTerms,
        orderType: data.orderType || "PURCHASE",
        requestingOffice: data.requestingOffice,
      };

      const res = await fetch(`/api/purchase-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setPoData((prev: any) => ({ ...prev, ...updated }));
        setLastSaved(new Date());
        toast.success(isJob ? "Job Order saved successfully" : "Purchase Order saved successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || (isJob ? "Failed to save Job Order" : "Failed to save Purchase Order"));
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
        setLastSaved(new Date());
      }
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const handleCreateAcceptance = async () => {
    try {
      const res = await fetch("/api/acceptances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: params.id })
      });
      if (!res.ok) throw new Error("Failed to create acceptance report");
      const acceptance = await res.json();
      router.push(`/acceptances/${acceptance.id}`);
    } catch (e) {
      toast.error("Error creating acceptance");
    }
  };

  if (loading) return <LoaderWave variant="page" label="Loading purchase order..." />;
  if (!poData) return <div className="p-8 text-center text-slate-500">PO not found</div>;

  const isReadOnly = poData.status === "COMPLETED";

  // Resolve awarded quote from abstract as fallback if po has not saved supplier yet
  const validQuotes = poData.abstract?.rfq?.quotations?.filter((q: any) => (q.totalAmount || 0) > 0) || [];
  const winningQuote = validQuotes.length > 0
    ? validQuotes.reduce((prev: any, curr: any) => (prev.totalAmount < curr.totalAmount ? prev : curr))
    : null;

  const selectedSupplier = suppliers.find(s => s.id === watchAll.supplierId) || poData.supplier || winningQuote?.supplier;
  const poTotalAmount = (poData.totalAmount && poData.totalAmount > 0) ? poData.totalAmount : (winningQuote?.totalAmount || 0);

  // Calculate exact PR number and ABC from nested relation if available
  const linkedPrNumber = poData.abstract?.rfq?.pr?.prNumber || poData.pr?.prNumber || "PENDING";
  const lineItems = poData.lineItems || [];
  const acceptances = poData.acceptances || [];

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href="/purchase-orders"
              aria-label="Back to Purchase Orders"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Purchase Orders
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {poData.poNumber?.trim() ? poData.poNumber.trim() : (isJob ? "Job Order" : "Purchase Order")}
            </h2>
            <div className="flex items-center gap-2">
              {poData.status === "COMPLETED" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={12} className="text-emerald-700" />
                  COMPLETED
                </span>
              ) : poData.status === "SIGNED" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  SIGNED
                </span>
              ) : poData.status === "PARTIALLY_DELIVERED" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                  PARTIAL DELIVERY
                </span>
              ) : poData.status === "ISSUED" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                  ISSUED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {poData.status || "DRAFT"}
                </span>
              )}

              {getSavedTimeText() && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {getSavedTimeText()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(poData.status === "SIGNED" || poData.status === "PARTIALLY_DELIVERED" || poData.status === "COMPLETED") && (
            <Link
              href={`/acceptances/hub/${poData.id}`}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package size={17} className="text-emerald-600" />
              <span>Delivery Hub</span>
            </Link>
          )}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={() => window.print()}
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

          {poData.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => updateStatus("ISSUED")}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <Send size={16} /> Mark Issued
            </button>
          )}

          {poData.status === "ISSUED" && (
            <button
              type="button"
              onClick={() => updateStatus("SIGNED")}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 size={16} /> Mark as Signed
            </button>
          )}
        </div>
      </div>

      {/* Completed Banner */}
      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <CheckCircle2 size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This {isJob ? "Job Order" : "Purchase Order"} is completed.</strong> All deliveries and acceptances are finalized.
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
            <button type="button" onClick={() => setTargetRows(r => Math.min(r + 1, 30))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="po-zoom-wrapper origin-top print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(900 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "900px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area text-black shadow-xl text-[14px] leading-tight print:shadow-none print:max-w-none print:m-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_td]:!text-[14px] [&_th]:!font-['Times_New_Roman',_Times,_serif] [&_th]:!text-[14px] [&_th]:!text-black [&_th]:!normal-case [&_th]:!tracking-normal [&_th]:!font-bold w-[900px] min-h-[1123px] bg-white p-10 print:w-full print:min-h-0 print:p-0" style={{ fontFamily: "'Times New Roman', Times, serif" }}>

                    <div className="border-[3px] border-black">
                      <div className="text-right italic pt-2 pr-2 text-sm">Appendix 49</div>

                      <div className="text-center font-bold mb-4">
                        <div className="text-2xl font-black font-serif">{isJob ? "JOB ORDER" : "PURCHASE ORDER"}</div>
                        <div className="uppercase underline mt-1 text-[15px]">MUNICIPAL GOVERNMENT OF PANDAN</div>
                        <div className="text-[15px]">LGU</div>
                      </div>

                      <div className="border-t-[3px] border-black grid text-[15px]" style={{ gridTemplateColumns: '10% 8% minmax(0, 1fr) 12% 16% 18%' }}>
                        <div className="col-span-3 border-r-[3px] border-black p-1 px-2 flex flex-col justify-between">
                          <div className="flex items-end"><span className="font-bold whitespace-nowrap mr-2">Supplier :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{selectedSupplier?.name || ""}</span></div>
                          <div className="flex items-end mt-1"><span className="font-bold whitespace-nowrap mr-2">Address :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{selectedSupplier?.address || ""}</span></div>
                          <div className="flex items-end mt-1"><span className="font-bold whitespace-nowrap mr-2">TIN :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight"></span></div>
                        </div>
                        <div className="col-span-3 p-1 px-2 flex flex-col justify-between">
                          <div className="flex items-end"><span className="font-bold whitespace-nowrap mr-2">{isJob ? "J.O. No. :" : "P.O. No. :"}</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{showPoNo ? (watchAll.poNumber || poData?.poNumber || "") : ""}</span></div>
                          <div className="flex items-end mt-1"><span className="font-bold whitespace-nowrap mr-2">Date :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{watchAll.deliveryDate ? new Date(watchAll.deliveryDate).toLocaleDateString('en-PH') : ""}</span></div>
                          <div className="flex items-end mt-1"><span className="font-bold whitespace-nowrap mr-2">Mode of Procurement :</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{watchAll.modeOfProcurement}</span></div>
                          <div className="flex items-end mt-1"><span className="font-bold whitespace-nowrap mr-2">{isJob ? "JR No./s :" : "PR No./s :"}</span> <span className="flex-1 font-bold border-b border-black text-center leading-tight">{showPrNo && linkedPrNumber !== "PENDING" ? linkedPrNumber : ""}</span></div>
                        </div>
                      </div>

                      <div className="border-t-[3px] border-black p-1 px-2 text-[15px]">
                        <div>Gentlemen:</div>
                        <div className="pl-8">Please furnish this Office the following articles subject to the terms and conditions contained herein:</div>
                      </div>

                      <div className="border-t-[3px] border-black grid text-[15px]" style={{ gridTemplateColumns: '10% 8% minmax(0, 1fr) 12% 16% 18%' }}>
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
                            <th className="border-r border-black p-1 w-[10%]">Stock/<br />Property No.</th>
                            <th className="border-r border-black p-1 w-[8%]">Unit</th>
                            <th className="border-r border-black p-1">Description</th>
                            <th className="border-r border-black p-1 w-[12%]">Quantity</th>
                            <th className="border-r border-black p-1 w-[16%]">Unit Cost</th>
                            <th className="p-1 w-[18%]">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item: any, idx: number) => {
                            const isSpec = !item.quantity || item.quantity === 0;
                            let displayNo = "";
                            if (!isSpec) {
                              let count = 0;
                              for (let i = 0; i <= idx; i++) {
                                if (lineItems[i].quantity > 0) count++;
                              }
                              displayNo = count.toString();
                            }

                            const hasSpecs = !isSpec && idx + 1 < lineItems.length && (!lineItems[idx + 1].quantity || lineItems[idx + 1].quantity === 0);

                            // Match price from winning quote if line item price on PO is not set yet
                            const quoteLine = winningQuote?.lineItems?.find(
                              (qli: any) =>
                                qli.rfqLineItemId === item.id ||
                                qli.rfqLineItem?.sortOrder === item.sortOrder ||
                                qli.rfqLineItem?.description?.trim().toLowerCase() === item.description?.trim().toLowerCase()
                            );
                            const unitCost = item.unitPrice > 0 ? item.unitPrice : (quoteLine?.unitPrice || 0);
                            const itemAmount = item.totalPrice > 0 ? item.totalPrice : (quoteLine?.totalPrice || (unitCost * (item.quantity || 0)));

                            return (
                              <tr key={idx}>
                                <td className="border-r border-black p-1 text-center">{displayNo}</td>
                                <td className="border-r border-black p-1 text-center">{isSpec ? "" : item.unit}</td>
                                <td className={`border-r border-black p-1 ${isSpec ? "pl-4 text-sm" : (hasSpecs ? "font-bold" : "")}`}>{item.description}</td>
                                <td className="border-r border-black p-1 text-center">{isSpec ? "" : item.quantity}</td>
                                <td className="border-r border-black p-1 text-right">{isSpec ? "" : (unitCost > 0 ? formatCurrency(unitCost).replace('₱', '') : "")}</td>
                                <td className="p-1 text-right font-bold">{isSpec ? "" : (itemAmount > 0 ? formatCurrency(itemAmount).replace('₱', '') : "")}</td>
                              </tr>
                            );
                          })}

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
                            <td className="border-r border-black text-center font-bold italic py-4">
                              {watchAll.requestingOffice ||
                                poData?.remarks ||
                                poData?.abstract?.rfq?.pr?.office?.name ||
                                poData?.pr?.office?.name ||
                                "Municipal Civil Registrar"}
                            </td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td></td>
                          </tr>

                          <tr>
                            <td colSpan={6} className="p-0 border-0">
                              <div className="border-t-[3px] border-black w-full"></div>
                            </td>
                          </tr>
                          <tr className="font-bold">
                            <td colSpan={2} className="p-1 px-1 text-left whitespace-nowrap text-[12px] tracking-tight">(Total Amount in Words)</td>
                            <td colSpan={3} className="p-1 px-4 font-normal">{poTotalAmount > 0 ? numberToWords(poTotalAmount) : ""}</td>
                            <td className="p-1 text-right">{poTotalAmount > 0 ? formatCurrency(poTotalAmount).replace('₱', '') : ""}</td>
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
                            <div className="flex items-end justify-start pl-12 mt-6">
                              <span className="mr-2">Resolution No:</span>
                              <span className="border-b border-black w-40"></span>
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
            <h2 className="text-base font-bold text-slate-900">
              {isJob ? "Job Order Details" : "PO Details"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the order is completed."
                : `Update the details for the ${isJob ? "Job Order" : "Purchase Order"}.`}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1">
            {/* Type Toggle: Purchase Order vs Job Order */}
            <div>
              <label className="form-label">Order Type</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => !isReadOnly && setValue("orderType", "PURCHASE")}
                  disabled={isReadOnly}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${!isJob
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <span>Purchase Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => !isReadOnly && setValue("orderType", "JOB")}
                  disabled={isReadOnly}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${isJob
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <span>Job Order</span>
                </button>
              </div>
            </div>

            {/* Document Numbering */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    {isJob ? "JO Number" : "PO Number"}
                  </label>
                </div>
                <input
                  type="text"
                  {...register("poNumber")}
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
                  onClick={() => setShowPoNo(!showPoNo)}
                >
                  Show {isJob ? "JO Number" : "PO Number"}
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

              {/* Show/Hide PR Number on Document Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label
                  className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                  onClick={() => setShowPrNo(!showPrNo)}
                >
                  Show {isJob ? "JR Number" : "PR Number"}
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

            {/* Requesting Office / Department */}
            <div>
              <label className="form-label">Requesting Office / Department</label>
              <div className="relative">
                <input
                  type="text"
                  list="po-office-list"
                  {...register("requestingOffice")}
                  disabled={isReadOnly}
                  className="form-input font-bold text-sm bg-white"
                  placeholder="e.g. Municipal Civil Registrar"
                />
                <datalist id="po-office-list">
                  {offices.map((o) => (
                    <option key={o.id} value={o.name} />
                  ))}
                </datalist>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Shown in the table footer. Defaults from the requesting office in the PR and can be changed anytime.
              </p>
            </div>

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
              <p className="text-[10px] text-slate-400 mt-1">Ideally set during abstract, but can be forced here.</p>
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

            <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Details save automatically with the document.</span>
            </div>
          </form>

          {/* Sticky Total in right panel footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between font-bold text-sm text-slate-800">
            <span>{isJob ? "JO Total:" : "PO Total:"}</span>
            <span className="text-emerald-600 text-base font-extrabold">{formatCurrency(poTotalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
