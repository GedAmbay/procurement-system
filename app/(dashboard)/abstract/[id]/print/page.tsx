"use client";
import LoaderWave from "@/components/ui/loader-wave";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2, ZoomIn, ZoomOut, Users, Edit3, Minus, Plus, Save, CheckCircle2, Lock, Unlock, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { toast } from "sonner";

export default function AbstractLivePreviewPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [allSignatories, setAllSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const [targetRows, setTargetRows] = useState(15);

  // Editable form state
  const [showPrNo, setShowPrNo] = useState(true);
  const [docDate, setDocDate] = useState("");
  const [bacResNo, setBacResNo] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [dateAwarded, setDateAwarded] = useState("");

  // Signatories overrides: record of id -> { name, position, label }
  const [sigOverrides, setSigOverrides] = useState<Record<string, { name: string; position: string; label: string }>>({});
  const [selectedSigIds, setSelectedSigIds] = useState<string[]>([]);
  const [editingSigId, setEditingSigId] = useState<string | null>(null);
  const [showAllSigs, setShowAllSigs] = useState(false);
  const [reqOfficerName, setReqOfficerName] = useState("");
  const [reqOfficerOffice, setReqOfficerOffice] = useState("");
  const [pageBreaks, setPageBreaks] = useState<(number | string)[]>([]);

  const togglePageBreak = (idx: number | string) => {
    setPageBreaks(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  useEffect(() => {
    async function load() {
      try {
        const [abstractRes, sigRes] = await Promise.all([
          fetch(`/api/abstract/${params.id}`),
          fetch("/api/signatories"),
        ]);
        let abstractResData: any = null;
        if (abstractRes.ok) {
          const d = await abstractRes.json();
          abstractResData = d;
          setData(d);
          if (d.updatedAt) setLastSaved(new Date(d.updatedAt));
          if (d.rfq?.pr) {
            setReqOfficerName(d.reqOfficerName || d.rfq.pr.requestedBy || "");
            setReqOfficerOffice(d.reqOfficerOffice || d.rfq.pr.office?.name || "");
          }
          if (d.docDate) setDocDate(new Date(d.docDate).toISOString().split('T')[0]);
          if (d.bacResNo) setBacResNo(d.bacResNo);
          if (d.dateReceived) setDateReceived(new Date(d.dateReceived).toISOString().split('T')[0]);
          if (d.dateAwarded) setDateAwarded(new Date(d.dateAwarded).toISOString().split('T')[0]);
        }
        if (sigRes.ok) {
          const sigs = await sigRes.json();
          setAllSignatories(sigs);

          if (abstractRes.ok && abstractResData && abstractResData.signatoriesData) {
            const savedSigs = abstractResData.signatoriesData as any;
            setSelectedSigIds(savedSigs.selectedSigIds || []);
            setSigOverrides(savedSigs.sigOverrides || {});
          } else {
            // Pre-select only relevant roles (preventing accidental additions like viewers or end users)
            const defaultRoles = ["HOPE", "BAC_CHAIRMAN", "BAC_VICE_CHAIRMAN", "BAC_MEMBER", "APPROVING_OFFICIAL"];
            const activeAndRelevant = sigs.filter((s: any) => s.isActive && defaultRoles.includes(s.role));
            setSelectedSigIds(activeAndRelevant.map((s: any) => s.id));
            // Init overrides
            const overrides: Record<string, { name: string; position: string; label: string }> = {};
            sigs.forEach((s: any) => {
              overrides[s.id] = {
                name: s.name,
                position: s.position,
                label: getRoleLabel(s.role),
              };
            });
            setSigOverrides(overrides);
          }
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const saveChanges = async (newStatus?: string) => {
    try {
      setSubmitting(true);
      const payload: any = {
        docDate,
        bacResNo,
        dateReceived,
        dateAwarded,
        reqOfficerName,
        reqOfficerOffice,
        signatoriesData: { selectedSigIds, sigOverrides },
      };
      if (newStatus) payload.status = newStatus;

      const res = await fetch(`/api/abstract/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      const updated = await res.json();
      setData((prev: any) => ({ ...prev, ...updated }));
      setLastSaved(new Date());
      toast.success(newStatus ? `Abstract ${newStatus.toLowerCase()} successfully!` : "Changes saved");
      if (newStatus) setIsUnlocked(false);
    } catch (error) {
      toast.error("An error occurred while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoaderWave variant="page" label="Preparing document..." />;
  if (!data) return <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Abstract not found</div>;

  const rfq = data.rfq;
  const pr = rfq.pr;
  const quotations: any[] = rfq.quotations || [];
  const lineItems: any[] = rfq.lineItems || [];

  const validQuotes = quotations.filter(q => q.totalAmount > 0);
  const lowestAmount = validQuotes.length > 0 ? Math.min(...validQuotes.map((q: any) => q.totalAmount)) : null;
  const recommendedQuote = validQuotes.find(q => q.totalAmount === lowestAmount);

  const getItemPrice = (quotation: any, rfqLineItemId: string) => {
    const li = quotation.lineItems?.find((l: any) => l.rfqLineItemId === rfqLineItemId);
    return li ? { unitPrice: li.unitPrice || 0, totalPrice: li.totalPrice || 0 } : { unitPrice: 0, totalPrice: 0 };
  };

  const sortedQuotations = [...quotations].sort((a, b) => {
    if (a.totalAmount === 0 && b.totalAmount > 0) return 1;
    if (b.totalAmount === 0 && a.totalAmount > 0) return -1;
    return (a.totalAmount || 0) - (b.totalAmount || 0);
  });

  const displayQuotes = [...sortedQuotations];
  const MAX_SUPPLIERS = 3;
  while (displayQuotes.length < MAX_SUPPLIERS) displayQuotes.push(null);

  const fmt2 = (n: number) => n > 0 ? n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "___________________";

  const selectedSigs = selectedSigIds
    .map(id => allSignatories.find(s => s.id === id))
    .filter(Boolean)
    .map(s => ({ ...s, ...sigOverrides[s.id] }));

  const hope = selectedSigs.find(s => s.role === "HOPE" || s.role === "APPROVING_OFFICIAL");
  const bacChairman = selectedSigs.find(s => s.role === "BAC_CHAIRMAN");
  const bacMembers = selectedSigs.filter(s => s.id !== hope?.id && s.id !== bacChairman?.id);

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "2px 2px", fontSize: "13px", verticalAlign: "middle" };
  const headerCell: React.CSSProperties = { ...cell, fontWeight: "700", textAlign: "center", background: "#fff", padding: 0 };

  const isReadOnly = data.status !== "DRAFT" && !isUnlocked;

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

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href={`/abstract/${params.id}`}
              aria-label="Back to Abstract Hub"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Abstract Hub
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {data.abstractNumber?.trim()
                ? data.abstractNumber.trim()
                : (data.bacResNo?.trim() ? `Res. ${data.bacResNo.trim()}` : "Abstract of Canvass")}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  {data.status || "FINAL"}
                </span>
                {getSavedTimeText() && (
                  <span className="text-xs text-slate-500 font-medium">{getSavedTimeText()}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {data.status || "DRAFT"}
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
          {/* Abstract Hub Button */}
          <Link
            href={`/abstract/${params.id}`}
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
                onClick={() => setIsUnlocked(true)}
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
                onClick={() => saveChanges()}
                disabled={submitting}
                className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
              </button>
              {data.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => saveChanges("ISSUED")}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Finalize
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This Abstract of Canvass is finalized and locked.</strong> Unlock it to make changes.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-w-0 max-w-full w-full gap-4 overflow-hidden relative print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!w-full">
        {/* ─── Left: Live Preview ─── */}
        <div className="flex-1 w-0 min-w-0 max-w-full rounded-2xl bg-[#d8e1eb] overflow-hidden relative flex flex-col shadow-inner print:rounded-none print:!bg-white print:!overflow-visible print:!shadow-none print:!block print:!w-full print:!m-0 print:!p-0">
          {/* Zoom Controls (Bottom Left) */}
          <div className="no-print absolute bottom-6 left-6 flex items-center gap-1 bg-white p-1 rounded-full shadow-md border border-slate-200 z-10 text-slate-600">
            <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
            <button type="button" onClick={() => setZoom(1)} className="px-3 hover:bg-slate-100 rounded-full font-bold text-xs h-full transition-colors" title="Reset Zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
            <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
            <button type="button" onClick={() => setTargetRows(r => Math.max(r - 1, 0))} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Remove Row"><Minus size={18} /></button>
            <div className="px-2 font-bold text-xs flex flex-col items-center justify-center h-full" title="Target Table Rows"><span className="leading-none">{targetRows}</span><span className="text-[9px] leading-none text-slate-400">Rows</span></div>
            <button type="button" onClick={() => setTargetRows(r => r + 1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <style>{`
              @page {
                size: landscape;
              }
            `}</style>
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="abstract-zoom-wrapper origin-top print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(1448 * zoom + 64)}px`,
                  minHeight: `${Math.round(816 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "1448px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 816)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div
                    style={{
                      background: "#fff",
                      color: "#000",
                      fontFamily: "Arial, sans-serif",
                      fontSize: "13px",
                    }}
                    className="abstract-print-sheet print-area w-[1448px] shadow-xl min-h-[816px] p-[40px] print:!p-0 block print:shadow-none print:!w-full print:!max-w-none print:!m-0 print:!min-h-0"
                  >
                    <div style={{ border: "1px solid #000", padding: "10px 0" }}>

                      {/* Doc Header */}
                      <div style={{ textAlign: "center", marginBottom: "6px" }}>
                        <div>Republic of the Philippines</div>
                        <div>Province of Antique</div>
                        <div>Municipality of Pandan</div>
                      </div>
                      <div style={{ textAlign: "center", marginBottom: "8px" }}>
                        <div style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "0.05em" }}>ABSTRACT OF CANVASS</div>
                      </div>

                      {/* PR No & Date */}
                      <div style={{ display: "flex", justifyContent: "center", gap: "48px", marginBottom: "8px", fontSize: "13px" }}>
                        <div>
                          Purchase Request No.:&nbsp;
                          <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "80px", paddingBottom: "1px" }}>
                            &nbsp;{showPrNo ? pr?.prNumber : ""}&nbsp;
                          </span>
                        </div>
                        <div>
                          Dated:&nbsp;
                          <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "80px", paddingBottom: "1px" }}>
                            &nbsp;{docDate ? fmtDate(docDate) : ""}&nbsp;
                          </span>
                        </div>
                      </div>

                      {/* Main Table */}
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
                        <tbody>
                          <tr>
                            <th style={{ ...headerCell, width: "26px" }} rowSpan={3}>NO.</th>
                            <th style={{ ...headerCell, width: "35%" }} rowSpan={3}>DESCRIPTION</th>
                            <th style={{ ...headerCell, width: "38px" }} rowSpan={3}>QTY</th>
                            <th style={{ ...headerCell, width: "34px" }} rowSpan={3}>UNIT</th>
                            <th style={{ ...headerCell }} colSpan={displayQuotes.length * 2}>SUPPLIER&apos;S NAME</th>
                          </tr>
                          <tr>
                            {displayQuotes.map((q: any, i: number) => (
                              <th key={i} style={{ ...headerCell, fontSize: "13px" }} colSpan={2}>
                                {q ? q.supplier?.name?.toUpperCase() : `SUPPLIER ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                          <tr>
                            {displayQuotes.map((_: any, i: number) => (
                              <React.Fragment key={i}>
                                <th key={`up-${i}`} style={{ ...headerCell, width: "8%", fontSize: "13px" }}>UNIT PRICE</th>
                                <th key={`tp-${i}`} style={{ ...headerCell, width: "8%", fontSize: "13px" }}>TOTAL PRICE</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </tbody>
                        <tbody>
                          {lineItems.map((item: any, idx: number) => {
                            const isRec = recommendedQuote !== undefined;
                            const hasBreak = pageBreaks.includes(idx);

                            const isSpec = !item.quantity || item.quantity === 0;
                            let displayNo = "";
                            if (!isSpec) {
                              let count = 0;
                              for (let i = 0; i <= idx; i++) {
                                if (Number(lineItems[i].quantity) > 0) count++;
                              }
                              displayNo = count.toString();
                            }

                            const hasSpecs = !isSpec && idx + 1 < lineItems.length && (!lineItems[idx + 1].quantity || lineItems[idx + 1].quantity === 0);

                            return (
                              <tr key={item.id} className={`group ${hasBreak ? 'break-before-page' : ''}`} style={hasBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                                <td style={{ ...cell, textAlign: "center", fontWeight: "700", verticalAlign: "top", position: "relative" }}>
                                  <div className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2" onClick={() => togglePageBreak(idx)}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${hasBreak ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`} title={hasBreak ? "Remove Page Break" : "Insert Page Break Above"}>
                                      {hasBreak ? <Minus size={12} /> : <Plus size={12} />}
                                    </div>
                                  </div>
                                  {hasBreak && (
                                    <div className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print" style={{ pointerEvents: 'none' }}></div>
                                  )}
                                  {displayNo}
                                </td>
                                <td style={{ ...cell, fontWeight: isSpec ? "normal" : (hasSpecs ? "bold" : "normal"), paddingLeft: isSpec ? "1.5rem" : "0.5rem" }}>{item.description}</td>
                                <td style={{ ...cell, textAlign: "center" }}>{isSpec ? "" : item.quantity}</td>
                                <td style={{ ...cell, textAlign: "center" }}>{isSpec ? "" : item.unit}</td>
                                {displayQuotes.map((q: any, qi: number) => {
                                  const prices = q ? getItemPrice(q, item.id) : { unitPrice: 0, totalPrice: 0 };
                                  return (
                                    <React.Fragment key={qi}>
                                      <td key={`up-${qi}`} style={{ ...cell, textAlign: "right" }}>
                                        {isSpec ? "" : fmt2(prices.unitPrice)}
                                      </td>
                                      <td key={`tp-${qi}`} style={{ ...cell, textAlign: "right" }}>
                                        {isSpec ? "" : fmt2(prices.totalPrice)}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            );
                          })}

                          {Array.from({ length: Math.max(0, targetRows - lineItems.length) }).map((_, i) => {
                            const idx = `fill-${i}`;
                            const hasBreak = pageBreaks.includes(idx);
                            return (
                              <tr key={idx} className={`group ${hasBreak ? 'break-before-page' : ''}`} style={hasBreak ? { pageBreakBefore: 'always', breakBefore: 'page', height: "24px" } : { height: "24px" }}>
                                <td style={{ ...cell, position: "relative" }}>
                                  <div className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2" onClick={() => togglePageBreak(idx)}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${hasBreak ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`} title={hasBreak ? "Remove Page Break" : "Insert Page Break Above"}>
                                      {hasBreak ? <Minus size={12} /> : <Plus size={12} />}
                                    </div>
                                  </div>
                                  {hasBreak && (
                                    <div className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print" style={{ pointerEvents: 'none' }}></div>
                                  )}
                                </td>
                                <td style={cell}></td><td style={cell}></td><td style={cell}></td>
                                {displayQuotes.map((_: any, qi: number) => (
                                  <React.Fragment key={qi}><td key={`fu-${qi}`} style={cell}></td><td key={`ft-${qi}`} style={cell}></td></React.Fragment>
                                ))}
                              </tr>
                            );
                          })}

                          {/* TOTAL row */}
                          <tr className={`group ${pageBreaks.includes('total') ? 'break-before-page' : ''}`} style={pageBreaks.includes('total') ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                            <td style={{ ...headerCell, borderTop: "2px solid #000", textAlign: "center", position: "relative" }} colSpan={4}>
                              <div className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2" onClick={() => togglePageBreak('total')}>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${pageBreaks.includes('total') ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`} title={pageBreaks.includes('total') ? "Remove Page Break" : "Insert Page Break Above"}>
                                  {pageBreaks.includes('total') ? <Minus size={12} /> : <Plus size={12} />}
                                </div>
                              </div>
                              {pageBreaks.includes('total') && (
                                <div className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print" style={{ pointerEvents: 'none' }}></div>
                              )}
                              TOTAL AMOUNT
                            </td>
                            {displayQuotes.map((q: any, qi: number) => {
                              const isWinner = q && recommendedQuote && q.id === recommendedQuote.id;
                              return (
                                <td key={`tot-${qi}`} colSpan={2} style={{ ...cell, borderTop: "2px solid #000", textAlign: "right", fontWeight: isWinner ? "700" : "normal", fontSize: isWinner ? "14px" : "13px" }}>
                                  {q && q.totalAmount > 0 ? fmt2(q.totalAmount) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>

                      {/* BAC Res No */}
                      <div className={`print:break-inside-avoid group ${pageBreaks.includes('signatures') ? 'break-before-page' : ''}`} style={pageBreaks.includes('signatures') ? { pageBreakBefore: 'always', breakBefore: 'page', position: 'relative' } : { position: 'relative' }}>
                        <div className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2" onClick={() => togglePageBreak('signatures')}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${pageBreaks.includes('signatures') ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`} title={pageBreaks.includes('signatures') ? "Remove Page Break" : "Insert Page Break Above"}>
                            {pageBreaks.includes('signatures') ? <Minus size={12} /> : <Plus size={12} />}
                          </div>
                        </div>
                        {pageBreaks.includes('signatures') && (
                          <div className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print" style={{ pointerEvents: 'none' }}></div>
                        )}
                        <div style={{ fontSize: "13px", marginBottom: "8px", padding: "0 24px" }}>
                          BAC Resolution No.:&nbsp;
                          <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "100px" }}>
                            &nbsp;{bacResNo}&nbsp;
                          </span>
                        </div>
                      </div>

                      {/* Certification Paragraph */}
                      <div className="print:break-inside-avoid" style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "50px", textAlign: "justify", padding: "0 24px" }}>
                        &nbsp;&nbsp;&nbsp;&nbsp;We, the undersigned the BAC Chairman, Members and Requisitioning Officer, do hereby certify that the foregoing is the true and correct ABSTRACT OF CANVASS of the Request for Quotation received on <strong>{fmtDate(dateReceived)}</strong> by BAC Secretariat and was opened by Bids and Awards Committee of Pandan, Antique on <strong>{fmtDate(dateAwarded)}</strong> for&nbsp;
                        <span style={{ borderBottom: "1px solid #000" }}><strong>&nbsp;{pr?.purpose}&nbsp;</strong></span>
                        &nbsp;needed for use in the Office of the <strong>{reqOfficerOffice || "___________________"}</strong>, Pandan, Antique.
                        The offer <strong><span>{recommendedQuote ? recommendedQuote.supplier?.name?.toUpperCase() : "___________________"}</span></strong> for items herein and respectively checked and articles/materials are hereby ACCEPTED AND AWARDED OF PRICE RECOMMENDATION. Recommending approval of the award in favor of the dealer quoted most advantageous offers indicating in the column above.
                      </div>

                      <div className="print:break-inside-avoid" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "nowrap", rowGap: "32px" }}>
                        {bacChairman && (
                          <div
                            onClick={() => { setEditingSigId(bacChairman.id); setShowAllSigs(false); }}
                            style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === bacChairman.id ? "rgba(37,99,235,0.08)" : "transparent" }}
                            title="Click to edit"
                          >
                            <div style={{ fontWeight: "700", fontSize: "12px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{bacChairman.name}</div>
                            <div style={{ fontSize: "12px", }}>{bacChairman.position}</div>
                            <div style={{ fontSize: "12px" }}>BAC Chairman</div>
                          </div>
                        )}
                        {bacMembers.map((m: any) => (
                          <div
                            key={m.id}
                            onClick={() => { setEditingSigId(m.id); setShowAllSigs(false); }}
                            style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === m.id ? "rgba(37,99,235,0.08)" : "transparent" }}
                            title="Click to edit"
                          >
                            <div style={{ fontWeight: "700", fontSize: "12px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.name}</div>
                            <div style={{ fontSize: "12px" }}>{m.position}</div>
                            <div style={{ fontSize: "12px" }}>{m.label || "BAC Member"}</div>
                          </div>
                        ))}
                        <div
                          onClick={() => { setEditingSigId("req"); setShowAllSigs(false); }}
                          style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === "req" ? "rgba(37,99,235,0.08)" : "transparent" }}
                          title="Click to edit"
                        >
                          <div style={{ fontWeight: "700", fontSize: "12px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{reqOfficerName || "___________________"}</div>
                          <div style={{ fontSize: "12px" }}>Requisitioning Officer</div>
                        </div>
                      </div>

                      {/* Approved by */}
                      <div className="print:break-inside-avoid" style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px", padding: "0 24px", marginBottom: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                          <div style={{ fontSize: "13px", marginBottom: "30px" }}>Approved:</div>
                          {hope ? (
                            <div style={{ textAlign: "center", minWidth: "180px" }}>
                              <div style={{ fontWeight: "700", fontSize: "12px", textTransform: "uppercase" }}>{hope.name}</div>
                              <div style={{ fontSize: "12px" }}>{hope.position}</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", minWidth: "180px" }}>
                              <div style={{ borderBottom: "1px solid #000", width: "180px", marginBottom: "2px" }}></div>
                              <div style={{ fontSize: "13px" }}>Municipal Mayor</div>
                            </div>
                          )}
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
            <h2 className="text-base font-bold text-slate-900">Abstract Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the document is finalized."
                : "Update the details and signatories for the Abstract."}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", pointerEvents: isReadOnly ? "none" : "auto", opacity: isReadOnly ? 0.7 : 1 }}>

            {/* ── Document Details ── */}
            <section>

              {/* Document Numbering */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      BAC Resolution No.
                    </label>
                  </div>
                  <input
                    type="text"
                    value={bacResNo}
                    onChange={e => setBacResNo(e.target.value)}
                    placeholder="e.g. 2026-09-001"
                    className="form-input font-mono font-bold text-sm bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Leave blank if not yet assigned by custodian. Can be updated at any time.
                  </p>
                </div>

                {/* Show/Hide PR Number on Document Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <label
                    className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                    onClick={() => setShowPrNo(!showPrNo)}
                  >
                    Show PR Number
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

              {/* Document Date */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Date</label>
                <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="form-input" style={{ width: "100%" }} />
              </div>
            </section>

            {/* ── Certification ── */}
            <section>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
                📝 Certification Paragraph
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Date Received</label>
                <input type="date" value={dateReceived} onChange={e => setDateReceived(e.target.value)} className="form-input" style={{ width: "100%" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Date Opened / Awarded</label>
                <input type="date" value={dateAwarded} onChange={e => setDateAwarded(e.target.value)} className="form-input" style={{ width: "100%" }} />
              </div>
            </section>

            {/* ── Requisitioning Officer ── */}
            {(!editingSigId || editingSigId === "req") && (
              <section>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  👤 Requisitioning Officer
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Officer Name</label>
                  <input type="text" value={reqOfficerName} onChange={e => setReqOfficerName(e.target.value)} className="form-input" style={{ width: "100%" }} placeholder="e.g. Juan Dela Cruz" />
                </div>
              </section>
            )}

            {/* ── Signatories ── */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ✍ Signatories
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAllSigs(!showAllSigs); setEditingSigId(null); }}
                  style={{ fontSize: "0.6875rem", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}
                >
                  {showAllSigs ? "Hide List" : "Add / Remove"}
                </button>
              </div>

              {!editingSigId && !showAllSigs ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center", background: "var(--color-page-bg)", borderRadius: "0.75rem", boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.4), inset -3px -3px 6px rgba(255,255,255,0.8)", color: "#94a3b8", fontSize: "0.8125rem", fontStyle: "italic" }}>
                  Click a signatory on the document to edit their details, or click "Add / Remove" to manage signatories.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {allSignatories
                    .filter((s: any) => {
                      if (editingSigId) return s.id === editingSigId;
                      if (showAllSigs) return s.isActive;
                      return false;
                    })
                    .map((sig: any) => {
                      const isSelected = selectedSigIds.includes(sig.id);
                      const isEditing = editingSigId === sig.id;
                      const override = sigOverrides[sig.id] || { name: sig.name, position: sig.position, label: getRoleLabel(sig.role) };
                      return (
                        <div key={sig.id} style={{
                          borderRadius: "0.75rem", padding: "0.75rem",
                          background: "var(--color-page-bg)",
                          boxShadow: isSelected ? "var(--shadow-neu-drop)" : "inset 3px 3px 6px rgba(163,177,198,0.4), inset -3px -3px 6px rgba(255,255,255,0.8)",
                          opacity: isSelected ? 1 : 0.5, transition: "all 0.2s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                setSelectedSigIds(ids => e.target.checked ? [...ids, sig.id] : ids.filter(id => id !== sig.id));
                              }}
                              style={{ accentColor: "#2563eb", width: "15px", height: "15px" }}
                            />
                            <div style={{ flex: 1, fontSize: "0.8125rem", fontWeight: "700", color: "#334155" }}>{override.name}</div>
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", background: "#f1f5f9", padding: "1px 6px", borderRadius: "9999px" }}>
                              {getRoleLabel(sig.role)}
                            </span>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => setEditingSigId(isEditing ? null : sig.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}
                                title="Edit details"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                          </div>
                          {isSelected && isEditing && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", paddingLeft: "1.5rem", marginTop: "0.625rem" }}>
                              <input
                                type="text"
                                value={override.name}
                                onChange={e => setSigOverrides(prev => ({ ...prev, [sig.id]: { ...prev[sig.id], name: e.target.value } }))}
                                placeholder="Full Name"
                                style={{
                                  width: "100%", padding: "0.3rem 0.5rem", border: "none", borderRadius: "0.5rem",
                                  background: "var(--color-page-bg)",
                                  boxShadow: "inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)",
                                  fontSize: "0.8125rem", color: "#334155", outline: "none", fontFamily: "inherit",
                                }}
                              />
                              <input
                                type="text"
                                value={override.position}
                                onChange={e => setSigOverrides(prev => ({ ...prev, [sig.id]: { ...prev[sig.id], position: e.target.value } }))}
                                placeholder="Position / Designation"
                                style={{
                                  width: "100%", padding: "0.3rem 0.5rem", border: "none", borderRadius: "0.5rem",
                                  background: "var(--color-page-bg)",
                                  boxShadow: "inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)",
                                  fontSize: "0.8125rem", color: "#334155", outline: "none", fontFamily: "inherit",
                                }}
                              />
                              <input
                                type="text"
                                value={override.label}
                                onChange={e => setSigOverrides(prev => ({ ...prev, [sig.id]: { ...prev[sig.id], label: e.target.value } }))}
                                placeholder="Label (e.g. BAC Member)"
                                style={{
                                  width: "100%", padding: "0.3rem 0.5rem", border: "none", borderRadius: "0.5rem",
                                  background: "var(--color-page-bg)",
                                  boxShadow: "inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)",
                                  fontSize: "0.8125rem", color: "#334155", outline: "none", fontFamily: "inherit",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Details save automatically with the document.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    HOPE: "HOPE / LCE",
    BAC_CHAIRMAN: "BAC Chairman",
    BAC_VICE_CHAIRMAN: "BAC Vice Chairman",
    BAC_MEMBER: "BAC Member",
    BUDGET_OFFICER: "BAC Member",
    SUPPLY_OFFICER: "BAC Member",
    END_USER: "BAC Member",
    APPROVING_OFFICIAL: "Approving Official",
    VIEWER: "Viewer",
  };
  return map[role] ?? role;
}