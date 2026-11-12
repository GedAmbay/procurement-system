"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Printer,
  Send,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import LoaderWave from "@/components/ui/loader-wave";
import {
  Button,
  StatusPill,
  StatTile,
  Stepper,
  Banner,
} from "@/components/ui/design-system";
import {
  formatPeso,
  evaluateAbstractBids,
  checkFinalizeEligibility,
  AbstractEvaluationResult,
  FinalizeEligibility,
} from "@/lib/money";

export default function AbstractHubPage() {
  const params = useParams();
  const router = useRouter();
  const abstractId = params.id as string;

  const [abstract, setAbstract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [selectedNewSupplier, setSelectedNewSupplier] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [updatingQuotationId, setUpdatingQuotationId] = useState<string | null>(null);

  // Finalize Modal State
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [confirmAward, setConfirmAward] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [abstractId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/abstract/${abstractId}`);
      if (res.ok) {
        const data = await res.json();
        setAbstract(data);
      } else {
        toast.error("Failed to load abstract");
      }

      const supRes = await fetch("/api/suppliers");
      if (supRes.ok) {
        setAllSuppliers(await supRes.json());
      }
    } catch (e) {
      toast.error("Network error while loading data");
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async () => {
    if (!selectedNewSupplier || !abstract?.rfq) return;
    const quotations = abstract.rfq.quotations || [];
    if (quotations.length >= 3) {
      toast.error("Maximum of 3 suppliers allowed");
      return;
    }
    setAddingSupplier(true);
    try {
      const res = await fetch(`/api/rfqs/${abstract.rfq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: selectedNewSupplier }),
      });
      if (res.ok) {
        toast.success("Supplier added");
        setSelectedNewSupplier("");
        setShowAddSupplier(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add supplier");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleMarkNoBid = async (quotationId: string, supplierName: string) => {
    setUpdatingQuotationId(quotationId);
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NO_BID" }),
      });
      if (res.ok) {
        toast.success(`Marked ${supplierName} as No Bid`);
        fetchData();
      } else {
        toast.error("Failed to update status");
      }
    } catch (e) {
      toast.error("Error updating quotation");
    } finally {
      setUpdatingQuotationId(null);
    }
  };

  const handleReopenBid = async (quotationId: string, supplierName: string) => {
    setUpdatingQuotationId(quotationId);
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING" }),
      });
      if (res.ok) {
        toast.success(`Reopened bid for ${supplierName}`);
        fetchData();
      } else {
        toast.error("Failed to reopen quotation");
      }
    } catch (e) {
      toast.error("Error updating quotation");
    } finally {
      setUpdatingQuotationId(null);
    }
  };

  const handleFinalizeSubmit = async () => {
    if (!confirmAward) return;
    setFinalizing(true);
    try {
      const res = await fetch(`/api/abstract/${abstractId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Abstract finalized and issued successfully!");
        setShowFinalizeModal(false);
        fetchData();
      } else {
        toast.error(data.error || "Finalization failed");
      }
    } catch (e) {
      toast.error("Error during finalization");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <LoaderWave variant="page" label="Loading abstract hub..." />;
  if (!abstract || !abstract.rfq) {
    return (
      <div className="p-8 text-center text-slate-500">
        Abstract not found.
      </div>
    );
  }

  const rfq = abstract.rfq;
  const pr = rfq.pr;
  const quotations: any[] = rfq.quotations || [];
  const lineItems: any[] = rfq.lineItems || [];

  // Single source of truth evaluation
  const evaluation: AbstractEvaluationResult =
    abstract.evaluation || evaluateAbstractBids(quotations, lineItems);
  const eligibility: FinalizeEligibility =
    abstract.eligibility || checkFinalizeEligibility(quotations, lineItems);

  const availableSuppliers = allSuppliers.filter(
    (s) => !quotations.some((q) => q.supplierId === s.id)
  );

  const prNumber =
    pr?.prNumber ||
    abstract.abstractNumber ||
    abstract.rfq?.rfqNumber ||
    (pr?.id ? `PR-${pr.id.slice(-6).toUpperCase()}` : "2026-11-0142");
  const officeName = pr?.office?.name || "Bids and Awards Committee";
  const totalItemCount = lineItems.length;
  const totalAbc = evaluation.totalAbc || pr?.totalAmount || 0;

  // Stepper workflow mapping
  const currentStatus = abstract.status || "DRAFT";
  const isFinalizedOrMore = currentStatus === "FINALIZED" || currentStatus === "ISSUED" || currentStatus === "SIGNED" || currentStatus === "COMPLETED";
  const isIssuedOrMore = currentStatus === "ISSUED" || currentStatus === "SIGNED" || currentStatus === "COMPLETED";

  const stepperSteps = [
    {
      id: 1,
      stepNumber: 1,
      title: "Draft created",
      subtitle: "Done",
      status: "done" as const,
    },
    {
      id: 2,
      stepNumber: 2,
      title: "Collecting quotations",
      subtitle: isFinalizedOrMore
        ? "Completed"
        : `In progress - ${evaluation.returnedCount} of 3 returned`,
      status: isFinalizedOrMore
        ? ("done" as const)
        : ("in_progress" as const),
    },
    {
      id: 3,
      stepNumber: 3,
      title: "Finalized",
      subtitle: isFinalizedOrMore ? "Completed" : "Not started",
      status: isFinalizedOrMore ? ("done" as const) : ("not_started" as const),
    },
    {
      id: 4,
      stepNumber: 4,
      title: "Issued",
      subtitle: isIssuedOrMore ? "Completed" : "Not started",
      status: isIssuedOrMore ? ("done" as const) : ("not_started" as const),
    },
  ];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Breadcrumbs */}
      <nav className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2 select-none">
        <Link href="/abstract" className="hover:text-slate-800 transition-colors">
          Abstract of Canvass
        </Link>
        <span className="text-slate-400">›</span>
        <span className="text-slate-900 font-bold">Abstract Hub</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3.5">
          <Link
            href="/abstract"
            aria-label="Back to Abstract List"
            className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                PR No. {prNumber}
              </h1>
              <StatusPill
                variant={
                  currentStatus === "DRAFT"
                    ? "draft"
                    : currentStatus === "FINALIZED"
                      ? "finalized"
                      : currentStatus === "ISSUED"
                        ? "issued"
                        : "returned"
                }
                label={currentStatus === "DRAFT" ? "Draft" : currentStatus}
              />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{officeName}</span>
              <span>·</span>
              <span>
                {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
              </span>
              <span>·</span>
              <span>
                ABC{" "}
                <strong className="text-emerald-700 font-bold">
                  {formatPeso(totalAbc)}
                </strong>
              </span>
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={<Printer size={16} />}
              onClick={() => router.push(`/abstract/${abstractId}/print`)}
            >
              Open Abstract
            </Button>

            {currentStatus === "DRAFT" && (
              <Button
                variant="primary"
                icon={<Send size={16} />}
                disabled={!eligibility.canFinalize}
                onClick={() => setShowFinalizeModal(true)}
              >
                Finalize &amp; Issue
              </Button>
            )}
          </div>
          {currentStatus === "DRAFT" && !eligibility.canFinalize && (
            <span className="text-[11px] text-slate-500 font-medium">
              {eligibility.disabledReason ||
                `Available once all 3 quotations are returned (${evaluation.returnedCount} of 3 so far)`}
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
        <Stepper steps={stepperSteps} />
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tile 1: Suppliers */}
        <StatTile
          label="Suppliers"
          value={evaluation.totalSuppliers}
          subtext={
            evaluation.totalSuppliers >= 3
              ? "Maximum of 3 reached"
              : `${3 - evaluation.totalSuppliers} slot(s) remaining`
          }
        />

        {/* Tile 2: Quotations Returned */}
        <StatTile
          label="Quotations Returned"
          value={`${evaluation.returnedCount} / 3`}
          progressPercent={(evaluation.returnedCount / 3) * 100}
          subtext={
            evaluation.pendingCount > 0
              ? `${evaluation.pendingCount} still pending`
              : evaluation.noBidCount > 0
                ? `${evaluation.noBidCount} marked no bid`
                : "All 3 accounted for"
          }
        />

        {/* Tile 3: Lowest Bid So Far */}
        <StatTile
          label="Lowest Bid So Far"
          badge={
            <StatusPill
              variant={evaluation.isProvisional ? "provisional" : "returned"}
              label={evaluation.isProvisional ? "Provisional" : "Final"}
            />
          }
          value={
            evaluation.lowestBidder ? (
              <span className="text-emerald-700">
                {formatPeso(evaluation.lowestBidder.totalBid)}
              </span>
            ) : (
              <span className="text-slate-400 text-lg font-bold">No bids yet</span>
            )
          }
          subtext={
            evaluation.lowestBidder ? (
              <span className="text-emerald-700 font-semibold">
                {evaluation.lowestBidder.supplierName} ·{" "}
                {formatPeso(Math.abs(evaluation.lowestBidder.variancePesos))}{" "}
                {evaluation.lowestBidder.variancePesos <= 0 ? "under" : "over"} ABC (
                {evaluation.lowestBidder.percentVariance.toFixed(1)}%)
              </span>
            ) : (
              "Awaiting returned quotations"
            )
          }
        />
      </div>

      {/* Dynamic Warning Banner */}
      {evaluation.warningMessages.length > 0 && currentStatus === "DRAFT" && (
        <Banner variant="warning">
          {evaluation.warningMessages.join(" ")}
        </Banner>
      )}

      {/* Suppliers Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Supplier quotations
          </h2>
          {evaluation.totalSuppliers < 3 && currentStatus === "DRAFT" && (
            <Button
              size="sm"
              variant="secondary"
              icon={showAddSupplier ? <X size={14} /> : <Plus size={14} />}
              onClick={() => setShowAddSupplier((v) => !v)}
            >
              {showAddSupplier ? "Cancel" : "Add Supplier"}
            </Button>
          )}
        </div>
      </div>

      {/* Add Supplier Inline Dropdown */}
      {showAddSupplier && (
        <div className="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/30 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <Building2 size={18} className="text-blue-600 shrink-0" />
          <select
            value={selectedNewSupplier}
            onChange={(e) => setSelectedNewSupplier(e.target.value)}
            className="w-full sm:flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">— Select a supplier to add (up to 3) —</option>
            {availableSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            size="md"
            variant="primary"
            disabled={!selectedNewSupplier || addingSupplier}
            onClick={addSupplier}
          >
            {addingSupplier ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Add
          </Button>
        </div>
      )}

      {/* Supplier Cards Grid */}
      {quotations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Building2 size={44} className="text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700">No suppliers added yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Click "Add Supplier" above to add up to 3 suppliers to this Abstract.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {evaluation.summaries.map((summary) => {
            const quote = quotations.find((q) => q.id === summary.quotationId);
            const isLowest =
              evaluation.lowestBidder?.quotationId === summary.quotationId &&
              summary.status === "RETURNED" &&
              summary.totalBid > 0;

            const isReturned = summary.status === "RETURNED";
            const isNoBid = summary.status === "NO_BID";
            const isPending = summary.status === "PENDING";

            const supplierName = quote?.supplier?.name || summary.supplierName;
            const contactPerson =
              quote?.supplier?.contactPerson || quote?.supplier?.address || "No contact info";

            return (
              <div
                key={summary.quotationId}
                className={`bg-white rounded-2xl p-6 transition-all shadow-sm flex flex-col justify-between ${isLowest
                    ? "border-2 border-emerald-500 ring-4 ring-emerald-50"
                    : "border border-slate-200/90 hover:border-slate-300"
                  }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isLowest
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600"
                        }`}
                    >
                      <Building2 size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug truncate">
                        {supplierName}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {contactPerson}
                      </p>
                      {isLowest && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-100/80">
                          <span>★ Lowest so far</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Rows */}
                  <div className="divide-y divide-slate-100 mt-4 text-xs">
                    {/* Status */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Status</span>
                      <StatusPill
                        variant={
                          isReturned
                            ? "returned"
                            : isNoBid
                              ? "no_bid"
                              : "pending"
                        }
                      />
                    </div>

                    {/* Received Date */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Received</span>
                      {isReturned ? (
                        summary.submittedAt ? (
                          <span className="font-semibold text-slate-800">
                            {new Date(summary.submittedAt).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            Date missing
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 font-medium">Not yet received</span>
                      )}
                    </div>

                    {/* Bid Amount */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Bid amount</span>
                      {isReturned ? (
                        <span className="text-base font-extrabold text-slate-900">
                          {formatPeso(summary.totalBid)}
                        </span>
                      ) : isNoBid ? (
                        <span className="text-slate-400 font-medium">No bid</span>
                      ) : (
                        <span className="text-slate-400 font-medium">No bid entered</span>
                      )}
                    </div>

                    {/* Versus ABC */}
                    {isReturned && (
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Versus ABC</span>
                        <span
                          className={`font-bold ${summary.variancePesos <= 0
                              ? "text-emerald-700"
                              : "text-red-600"
                            }`}
                        >
                          {formatPeso(Math.abs(summary.variancePesos))}{" "}
                          {summary.variancePesos <= 0 ? "under" : "over"} ·{" "}
                          {summary.percentVariance.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-5 mt-2 border-t border-slate-100 flex items-center gap-2.5">
                  {isReturned ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        router.push(
                          `/abstract/${abstractId}/supplier/${summary.quotationId}`
                        )
                      }
                    >
                      Edit bid
                    </Button>
                  ) : isPending ? (
                    <>
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() =>
                          router.push(
                            `/abstract/${abstractId}/supplier/${summary.quotationId}`
                          )
                        }
                      >
                        Enter quotation
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={updatingQuotationId === summary.quotationId}
                        onClick={() =>
                          handleMarkNoBid(summary.quotationId, supplierName)
                        }
                      >
                        {updatingQuotationId === summary.quotationId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          "Mark as no bid"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={updatingQuotationId === summary.quotationId}
                      onClick={() =>
                        handleReopenBid(summary.quotationId, supplierName)
                      }
                    >
                      Reopen bid
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finalize Dialog Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Finalize &amp; Issue Abstract
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Confirm the winning supplier quotation to lock bids and issue.
                </p>
              </div>
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Winner summary */}
            {evaluation.lowestBidder ? (
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Recommended Awardee (Lowest Bid)
                  </span>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {evaluation.lowestBidder.supplierName}
                  </div>
                  <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                    {formatPeso(Math.abs(evaluation.lowestBidder.variancePesos))}{" "}
                    under ABC ({evaluation.lowestBidder.percentVariance.toFixed(1)}% savings)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-medium">Total Bid</span>
                  <div className="text-xl font-black text-emerald-700">
                    {formatPeso(evaluation.lowestBidder.totalBid)}
                  </div>
                </div>
              </div>
            ) : (
              <Banner variant="error">
                Cannot finalize without at least one valid returned quotation.
              </Banner>
            )}

            {/* Checklist */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Readiness Checklist
              </span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2.5">
                  {eligibility.checklist.minSuppliersMet ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 shrink-0" />
                  )}
                  <span
                    className={
                      eligibility.checklist.minSuppliersMet
                        ? "text-slate-700 font-medium"
                        : "text-red-600 font-semibold"
                    }
                  >
                    At least 3 suppliers registered
                  </span>
                </li>

                <li className="flex items-center gap-2.5">
                  {eligibility.checklist.allReturnedOrNoBid ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 shrink-0" />
                  )}
                  <span
                    className={
                      eligibility.checklist.allReturnedOrNoBid
                        ? "text-slate-700 font-medium"
                        : "text-red-600 font-semibold"
                    }
                  >
                    All supplier quotations accounted for (Returned or marked No Bid)
                  </span>
                </li>

                <li className="flex items-center gap-2.5">
                  {eligibility.checklist.allDatesPresent ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 shrink-0" />
                  )}
                  <span
                    className={
                      eligibility.checklist.allDatesPresent
                        ? "text-slate-700 font-medium"
                        : "text-red-600 font-semibold"
                    }
                  >
                    All returned quotations have date received recorded
                  </span>
                </li>

                <li className="flex items-center gap-2.5">
                  {eligibility.checklist.winnerWithinBudget ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 shrink-0" />
                  )}
                  <span
                    className={
                      eligibility.checklist.winnerWithinBudget
                        ? "text-slate-700 font-medium"
                        : "text-red-600 font-semibold"
                    }
                  >
                    Lowest bid is within the Approved Budget for Contract (ABC)
                  </span>
                </li>
              </ul>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmAward}
                onChange={(e) => setConfirmAward(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs font-semibold text-slate-800 leading-relaxed">
                I have verified all supplier quotations and confirm the award recommendation.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowFinalizeModal(false)}
                disabled={finalizing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!confirmAward || !eligibility.canFinalize || finalizing}
                onClick={handleFinalizeSubmit}
              >
                {finalizing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Confirm &amp; Finalize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
