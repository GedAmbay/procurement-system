"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Save,
  Loader2,
  Calendar,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import LoaderWave from "@/components/ui/loader-wave";
import { Button, MoneyInput } from "@/components/ui/design-system";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  toCentavos,
  fromCentavos,
  formatPeso,
} from "@/lib/money";

interface LineItemState {
  id?: string;
  rfqLineItemId: string;
  description: string;
  unit: string;
  quantity: number;
  abcUnitCost: number;
  unitPrice: number;
}

export default function BidEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { isRail } = useSidebar();

  const abstractId = params.id as string;
  const quotationId = params.supplierId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [rfq, setRfq] = useState<any>(null);

  const [dateReceived, setDateReceived] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/quotations/${quotationId}`);
        if (!res.ok) {
          toast.error("Quotation not found");
          return;
        }
        const data = await res.json();
        setQuoteData(data);
        setSupplier(data.supplier);
        setRfq(data.rfq);

        // Date received defaults to today if not previously set
        const todayStr = new Date().toISOString().split("T")[0];
        if (data.submittedAt) {
          setDateReceived(new Date(data.submittedAt).toISOString().split("T")[0]);
        } else {
          setDateReceived(todayStr);
        }

        // Map RFQ line items to line item states
        const rfqItems = data.rfq?.lineItems || [];
        const existingLines = data.lineItems || [];

        const initialItems: LineItemState[] = rfqItems.map((rfqItem: any) => {
          const match = existingLines.find(
            (qli: any) => qli.rfqLineItemId === rfqItem.id
          );
          return {
            id: match?.id,
            rfqLineItemId: rfqItem.id,
            description: rfqItem.description,
            unit: rfqItem.unit,
            quantity: Number(rfqItem.quantity) || 1,
            abcUnitCost: Number(rfqItem.unitCost) || 0,
            unitPrice: match ? Number(match.unitPrice) || 0 : 0,
          };
        });

        setLineItems(initialItems);
      } catch (err) {
        toast.error("Failed to load quotation data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [quotationId]);

  // Window navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Single source of truth calculation derived in useMemo
  const summary = useMemo(() => {
    let grandTotalCentavos = 0;
    let totalAbcCentavos = 0;

    const rows = lineItems.map((item) => {
      const qty = item.quantity;
      const abcUnitCentavos = toCentavos(item.abcUnitCost);
      const abcLineCentavos = Math.round(qty * abcUnitCentavos);

      const bidUnitCentavos = toCentavos(item.unitPrice);
      const bidLineCentavos = Math.round(qty * bidUnitCentavos);

      const lineVarianceCentavos = bidLineCentavos - abcLineCentavos;

      grandTotalCentavos += bidLineCentavos;
      totalAbcCentavos += abcLineCentavos;

      return {
        ...item,
        bidLineTotal: fromCentavos(bidLineCentavos),
        lineVariancePesos: fromCentavos(lineVarianceCentavos),
        isOverAbc: lineVarianceCentavos > 0 && bidUnitCentavos > 0,
      };
    });

    const varianceCentavos = grandTotalCentavos - totalAbcCentavos;
    const isOverBudget = varianceCentavos > 0 && grandTotalCentavos > 0;
    const isUnderBudget = varianceCentavos <= 0 && grandTotalCentavos > 0;

    const progressPercent =
      totalAbcCentavos > 0
        ? Math.min(100, (grandTotalCentavos / totalAbcCentavos) * 100)
        : 0;

    return {
      rows,
      grandTotal: fromCentavos(grandTotalCentavos),
      totalAbc: fromCentavos(totalAbcCentavos),
      variancePesos: fromCentavos(varianceCentavos),
      isOverBudget,
      isUnderBudget,
      progressPercent,
    };
  }, [lineItems]);

  const handlePriceChange = (index: number, newPrice: number) => {
    setIsDirty(true);
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unitPrice: newPrice };
      return next;
    });
  };

  const handleEnterKey = (index: number) => {
    if (index + 1 < lineItems.length) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave without saving?"
      );
      if (!confirmed) return;
    }
    router.push(`/abstract/${abstractId}`);
  };

  const handleSave = async () => {
    if (!dateReceived) {
      toast.error("Date received is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        status: "RETURNED",
        submittedAt: dateReceived,
        lineItems: lineItems.map((item) => {
          const qty = item.quantity;
          const cleanPrice = Number(item.unitPrice) || 0;
          return {
            id: item.id || undefined,
            rfqLineItemId: item.rfqLineItemId,
            unitPrice: cleanPrice,
            totalPrice: qty * cleanPrice,
          };
        }),
      };

      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDirty(false);
        toast.success("Bid saved successfully");
        router.push(`/abstract/${abstractId}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to save quotation");
      }
    } catch (e) {
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoaderWave variant="page" label="Loading bid entry..." />;
  if (!quoteData || !supplier) {
    return (
      <div className="p-8 text-center text-slate-500">
        Quotation details not found.
      </div>
    );
  }

  const prNumber =
    rfq?.pr?.prNumber ||
    rfq?.rfqNumber ||
    (rfq?.pr?.id ? `PR-${rfq.pr.id.slice(-6).toUpperCase()}` : "2026-11-0142");

  return (
    <div className="w-full space-y-6 pb-28">
      {/* Breadcrumbs */}
      <nav className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2 select-none">
        <Link href="/abstract" className="hover:text-slate-800 transition-colors">
          Abstract of Canvass
        </Link>
        <span className="text-slate-400">›</span>
        <Link
          href={`/abstract/${abstractId}`}
          className="hover:text-slate-800 transition-colors"
        >
          Abstract Hub
        </Link>
        <span className="text-slate-400">›</span>
        <span className="text-slate-900 font-bold">Bid entry</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Back to Abstract Hub"
            className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all shrink-0"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {supplier.name}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {supplier.address || "No address on file"} · PR No. {prNumber}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* Dirty state pill */}
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Check size={14} className="text-emerald-600 stroke-[3]" />
              All changes saved
            </span>
          )}

          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            icon={
              saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )
            }
          >
            Save bid
          </Button>
        </div>
      </div>

      {/* 3 Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: ABC */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Approved Budget for the Contract
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPeso(summary.totalAbc)}
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-3">
            Sum of the {lineItems.length} line-item ABCs
          </p>
        </div>

        {/* Card 2: Total Bid with Progress Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Total Bid
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPeso(summary.grandTotal)}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 my-2.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  summary.isOverBudget ? "bg-red-500" : "bg-emerald-600"
                }`}
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
          <div className="text-xs font-bold mt-1">
            {summary.grandTotal === 0 ? (
              <span className="text-slate-400 font-medium">No prices entered yet</span>
            ) : summary.isOverBudget ? (
              <span className="text-red-600">
                {formatPeso(Math.abs(summary.variancePesos))} over budget
              </span>
            ) : (
              <span className="text-emerald-700">
                {formatPeso(Math.abs(summary.variancePesos))} under budget
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Date Received */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <label
              htmlFor="date-received"
              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2"
            >
              Date Received <span className="text-red-500 font-black">*</span>
            </label>
            <div className="relative">
              <input
                id="date-received"
                type="date"
                required
                value={dateReceived}
                onChange={(e) => {
                  setDateReceived(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-3">
            Required. Defaults to today.
          </p>
        </div>
      </div>

      {/* Line Items Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Title Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-base font-extrabold text-slate-900">Line items</h2>
          <p className="text-xs text-slate-500 font-medium">
            Enter unit prices from the returned quotation. Press Tab or Enter to move to the next price.
          </p>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-12">#</th>
                <th className="py-3 px-4 min-w-[220px]">Item Description</th>
                <th className="py-3 px-4 text-center w-20">Qty</th>
                <th className="py-3 px-4 text-center w-24">Unit</th>
                <th className="py-3 px-4 text-right w-36">ABC Unit Price</th>
                <th className="py-3 px-4 text-right w-52">Unit Price (Bid)</th>
                <th className="py-3 px-4 text-right w-36">Total Cost</th>
                <th className="py-3 px-4 text-center w-32">VS ABC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.rows.map((row, idx) => {
                const diff = row.lineVariancePesos;
                const hasBid = row.unitPrice > 0;

                return (
                  <tr
                    key={row.rfqLineItemId}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 text-center text-slate-400 font-bold">
                      {idx + 1}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {row.description}
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4 text-center text-slate-700 font-semibold">
                      {row.quantity}
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 text-center text-slate-500 font-medium capitalize">
                      {row.unit}
                    </td>

                    {/* ABC Unit Price */}
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-500">
                      {formatPeso(row.abcUnitCost)}
                    </td>

                    {/* Unit Price Bid Input */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end">
                        <MoneyInput
                          ref={(el) => {
                            inputRefs.current[idx] = el;
                          }}
                          value={row.unitPrice}
                          onChange={(val) => handlePriceChange(idx, val)}
                          onEnterPress={() => handleEnterKey(idx)}
                          hasError={row.isOverAbc}
                          placeholder="0.00"
                        />
                      </div>
                    </td>

                    {/* Total Cost */}
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {row.bidLineTotal > 0 ? formatPeso(row.bidLineTotal) : "₱0.00"}
                    </td>

                    {/* VS ABC Pill */}
                    <td className="py-3.5 px-4 text-center">
                      {!hasBid ? (
                        <span className="text-slate-300 font-medium">—</span>
                      ) : diff < 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                          -{formatPeso(Math.abs(diff))}
                        </span>
                      ) : diff > 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-red-700 bg-red-50 border border-red-200">
                          +{formatPeso(diff)}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                          ₱0.00
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/40">
                <td
                  colSpan={6}
                  className="py-4 px-4 text-right text-xs font-bold text-slate-600"
                >
                  Grand total
                </td>
                <td className="py-4 px-4 text-right text-base font-black text-emerald-700">
                  {formatPeso(summary.grandTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Footer */}
      <div
        className={`fixed bottom-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 sm:px-8 shadow-lg flex items-center justify-between transition-all duration-200 ${
          isRail ? "left-[72px]" : "left-0 md:left-[260px]"
        }`}
      >
        <div className="text-xs sm:text-sm font-semibold text-slate-600 flex items-center gap-2">
          <span>Grand total</span>
          <span className="text-base sm:text-lg font-black text-slate-900">
            {formatPeso(summary.grandTotal)}
          </span>
          <span className="text-slate-400 font-normal">
            of {formatPeso(summary.totalAbc)} approved budget
          </span>
        </div>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          icon={
            saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )
          }
        >
          Save bid
        </Button>
      </div>
    </div>
  );
}
