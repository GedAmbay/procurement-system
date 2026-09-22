"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2, ZoomIn, ZoomOut, Users, Edit3, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { toast } from "sonner";

export default function AbstractLivePreviewPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [allSignatories, setAllSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.75);
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

  useEffect(() => {
    async function load() {
      try {
        const [aoqRes, sigRes] = await Promise.all([
          fetch(`/api/abstract/${params.id}`),
          fetch("/api/signatories"),
        ]);
        if (aoqRes.ok) {
          const d = await aoqRes.json();
          setData(d);
          if (d.rfq?.pr) {
            setReqOfficerName(d.rfq.pr.requestedBy || "");
            setReqOfficerOffice(d.rfq.pr.office?.name || "");
          }
        }
        if (sigRes.ok) {
          const sigs = await sigRes.json();
          setAllSignatories(sigs);
          // Pre-select all active signatories
          const active = sigs.filter((s: any) => s.isActive);
          setSelectedSigIds(active.map((s: any) => s.id));
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
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 80px)" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#2563eb" }} />
    </div>
  );
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

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "2px 2px", fontSize: "11px", verticalAlign: "middle" };
  const headerCell: React.CSSProperties = { ...cell, fontWeight: "700", textAlign: "center", background: "#fff", padding: 0 };

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full overflow-hidden print:block print:!h-auto print:!overflow-visible"
      style={{ height: "calc(var(--full-vh, 100vh) - 170px)" }}>

      {/* ─── Header Bar ─── */}
      <div className="no-print" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        background: "var(--color-page-bg)",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href={`/abstract/${params.id}`} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "34px", height: "34px", borderRadius: "50%",
            background: "var(--color-page-bg)", boxShadow: "var(--shadow-neu-drop)",
            color: "#64748b", textDecoration: "none",
          }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ fontWeight: "700", fontSize: "0.9375rem", color: "#0f172a" }}>Abstract of Canvas — Live Preview</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{data.aoqNumber}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => window.print()} className="btn flex items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="flex flex-1 w-full min-w-0 max-w-full overflow-hidden relative print:block print:!h-auto">

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

        {/* ─── Left: Live Preview ─── */}
        <div className="flex-1 relative min-w-0 bg-slate-200 print:bg-white print:static print:block print:!overflow-visible print:!h-auto">
          <div className="absolute inset-0 overflow-auto print:static print:overflow-visible">
            <style>{`
              @media print { 
                .print-zoom-reset { zoom: 1 !important; } 
                @page { margin-top: 20mm !important; }
                @page :first { margin-top: 10mm !important; }
              }
            `}</style>
            <div className="w-max mx-auto min-w-full flex justify-center print:block print:w-full print:min-w-0">
              <div className="p-8 print:p-0 origin-top print:!transform-none print:!m-0"
                style={{
                  transform: `scale(${zoom})`,
                  marginBottom: `${(zoom - 1) * 1759}px`,
                  marginLeft: `${(zoom - 1) * 1214 / 2}px`,
                  marginRight: `${(zoom - 1) * 1214 / 2}px`
                }}>
                <div style={{
                  background: "#fff",
                  color: "#000",
                  fontFamily: "Arial, sans-serif", fontSize: "11px",
                }} className="w-[1759px] shadow-xl min-h-[1150px] p-[40px] print:!p-0 block print:shadow-none print:!w-full print:!max-w-none print:!m-0 print:!min-h-0">
                  <div style={{ border: "1px solid #000", padding: "20px 0" }}>

                    {/* Doc Header */}
                    <div style={{ textAlign: "center", marginBottom: "6px" }}>
                      <div>Republic of the Philippines</div>
                      <div>Province of Antique</div>
                      <div>Municipality of Pandan</div>
                    </div>
                    <div style={{ textAlign: "center", marginBottom: "8px" }}>
                      <div style={{ fontSize: "20px", fontWeight: "900", letterSpacing: "0.05em" }}>ABSTRACT OF CANVASS</div>
                    </div>

                    {/* PR No & Date */}
                    <div style={{ display: "flex", justifyContent: "center", gap: "48px", marginBottom: "8px", fontSize: "11px" }}>
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
                            <th key={i} style={{ ...headerCell, fontSize: "10px" }} colSpan={2}>
                              {q ? q.supplier?.name?.toUpperCase() : `SUPPLIER ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {displayQuotes.map((_: any, i: number) => (
                            <React.Fragment key={i}>
                              <th key={`up-${i}`} style={{ ...headerCell, width: "8%", fontSize: "10px" }}>UNIT PRICE</th>
                              <th key={`tp-${i}`} style={{ ...headerCell, width: "8%", fontSize: "10px" }}>TOTAL PRICE</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </tbody>
                      <tbody>
                        {lineItems.map((item: any, idx: number) => {
                          const isRec = recommendedQuote !== undefined;
                          return (
                            <tr key={item.id}>
                              <td style={{ ...cell, textAlign: "center", fontWeight: "700", verticalAlign: "top" }}>{idx + 1}</td>
                              <td style={{ ...cell }}>{item.description}</td>
                              <td style={{ ...cell, textAlign: "center" }}>{item.quantity}</td>
                              <td style={{ ...cell, textAlign: "center" }}>{item.unit}</td>
                              {displayQuotes.map((q: any, qi: number) => {
                                const prices = q ? getItemPrice(q, item.id) : { unitPrice: 0, totalPrice: 0 };
                                const isWinner = q && recommendedQuote && q.id === recommendedQuote.id;
                                return (
                                  <React.Fragment key={qi}>
                                    <td key={`up-${qi}`} style={{ ...cell, textAlign: "right" }}>
                                      {fmt2(prices.unitPrice)}
                                    </td>
                                    <td key={`tp-${qi}`} style={{ ...cell, textAlign: "right" }}>
                                      {fmt2(prices.totalPrice)}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {Array.from({ length: Math.max(0, targetRows - lineItems.length) }).map((_, i) => (
                          <tr key={`fill-${i}`} style={{ height: "24px" }}>
                            <td style={cell}></td><td style={cell}></td><td style={cell}></td><td style={cell}></td>
                            {displayQuotes.map((_: any, qi: number) => (
                              <React.Fragment key={qi}><td key={`fu-${qi}`} style={cell}></td><td key={`ft-${qi}`} style={cell}></td></React.Fragment>
                            ))}
                          </tr>
                        ))}

                        {/* TOTAL row */}
                        <tr>
                          <td style={{ ...headerCell, borderTop: "2px solid #000", textAlign: "center" }} colSpan={4}>TOTAL AMOUNT</td>
                          {displayQuotes.map((q: any, qi: number) => {
                            const isWinner = q && recommendedQuote && q.id === recommendedQuote.id;
                            return (
                              <td key={`tot-${qi}`} colSpan={2} style={{ ...cell, borderTop: "2px solid #000", textAlign: "right", fontWeight: "700", fontSize: isWinner ? "12px" : "11px" }}>
                                {q && q.totalAmount > 0 ? fmt2(q.totalAmount) : ""}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>

                    {/* BAC Res No */}
                    <div className="print:break-inside-avoid" style={{ fontSize: "11px", marginBottom: "8px", padding: "0 24px" }}>
                      BAC Resolution No.:&nbsp;
                      <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "100px" }}>
                        &nbsp;{bacResNo}&nbsp;
                      </span>
                    </div>

                    {/* Certification Paragraph */}
                    <div className="print:break-inside-avoid" style={{ fontSize: "11px", lineHeight: "1.6", marginBottom: "40px", textAlign: "justify", padding: "0 24px" }}>
                      &nbsp;&nbsp;&nbsp;&nbsp;We, the undersigned the BAC Chairman, Members and Requisitioning Officer, do hereby certify that the foregoing is the true and correct ABSTRACT OF CANVASS of the Request for Quotation received on <strong>{fmtDate(dateReceived)}</strong> by BAC Secretariat and was opened by Bids and Awards Committee of Pandan, Antique on <strong>{fmtDate(dateAwarded)}</strong> for&nbsp;
                      <span style={{ borderBottom: "1px solid #000" }}><strong>&nbsp;{pr?.purpose}&nbsp;</strong></span>
                      &nbsp;needed for use in the Office of the <strong>{reqOfficerOffice || "___________________"}</strong>, Pandan, Antique.
                      The offer <strong><span style={{ textDecoration: "underline" }}>{recommendedQuote ? recommendedQuote.supplier?.name?.toUpperCase() : "___________________"}</span></strong> for items herein and respectively checked and articles/materials are hereby ACCEPTED AND AWARDED OF PRICE RECOMMENDATION. Recommending approval of the award in favor of the dealer quoted most advantageous offers indicating in the column above.
                    </div>

                    <div className="print:break-inside-avoid" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "nowrap", rowGap: "32px", padding: "0 24px" }}>
                      {bacChairman && (
                        <div
                          onClick={() => { setEditingSigId(bacChairman.id); setShowAllSigs(false); }}
                          style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === bacChairman.id ? "rgba(37,99,235,0.08)" : "transparent" }}
                          title="Click to edit"
                        >
                          <div style={{ fontWeight: "900", fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{bacChairman.name}</div>
                          <div style={{ fontSize: "10px" }}>{bacChairman.position}</div>
                          <div style={{ fontSize: "10px", fontWeight: "700" }}>BAC Chairman</div>
                        </div>
                      )}
                      {bacMembers.map((m: any) => (
                        <div
                          key={m.id}
                          onClick={() => { setEditingSigId(m.id); setShowAllSigs(false); }}
                          style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === m.id ? "rgba(37,99,235,0.08)" : "transparent" }}
                          title="Click to edit"
                        >
                          <div style={{ fontWeight: "900", fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.name}</div>
                          <div style={{ fontSize: "10px" }}>{m.position}</div>
                          <div style={{ fontSize: "10px", fontWeight: "700" }}>{m.label || "BAC Member"}</div>
                        </div>
                      ))}
                      <div
                        onClick={() => { setEditingSigId("req"); setShowAllSigs(false); }}
                        style={{ flex: "1 1 auto", textAlign: "center", padding: "4px", cursor: "pointer", borderRadius: "6px", backgroundColor: editingSigId === "req" ? "rgba(37,99,235,0.08)" : "transparent" }}
                        title="Click to edit"
                      >
                        <div style={{ fontWeight: "900", fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{reqOfficerName || "___________________"}</div>
                        <div style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px" }}>Requisitioning Officer</div>
                      </div>
                    </div>

                    {/* Approved by */}
                    <div className="print:break-inside-avoid" style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px", padding: "0 24px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "11px", marginBottom: "20px" }}>Approved:</div>
                        {hope ? (
                          <div style={{ textAlign: "center", minWidth: "180px" }}>
                            <div style={{ fontWeight: "900", fontSize: "12px", textTransform: "uppercase" }}>{hope.name}</div>
                            <div style={{ fontSize: "11px" }}>{hope.position}</div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", minWidth: "180px" }}>
                            <div style={{ borderBottom: "1px solid #000", width: "180px", marginBottom: "2px" }}></div>
                            <div style={{ fontSize: "11px" }}>Municipal Mayor</div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right: Form Panel ─── */}
        <div className="no-print" style={{
          width: "450px", flexShrink: 0,
          borderLeft: "1px solid #e2e8f0",
          background: "var(--color-page-bg)",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "2.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ── Document Details ── */}
            <section>
              <h3 style={{ fontWeight: "800", color: "#0f172a", marginBottom: "1.25rem", fontSize: "1rem" }}>Abstract Details</h3>

              {/* PR Number toggle */}
              <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#475569", cursor: "pointer" }} onClick={() => setShowPrNo(!showPrNo)}>
                  Purchase Request No.
                </label>
                <button
                  type="button"
                  onClick={() => setShowPrNo(!showPrNo)}
                  style={{
                    width: "44px", height: "24px", borderRadius: "12px",
                    background: showPrNo ? "#10b981" : "#cbd5e1",
                    position: "relative", border: "none", cursor: "pointer",
                    transition: "background 0.3s",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)"
                  }}
                >
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
                    position: "absolute", top: "2px", left: showPrNo ? "22px" : "2px",
                    transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                  }} />
                </button>
              </div>

              {/* Document Date */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Date</label>
                <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="form-input" style={{ width: "100%" }} />
              </div>

              {/* BAC Resolution No */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>
                  BAC Resolution No. <span style={{ fontWeight: "400", color: "#94a3b8" }}>(optional)</span>
                </label>
                <input type="text" value={bacResNo} onChange={e => setBacResNo(e.target.value)} className="form-input" style={{ width: "100%" }} placeholder="e.g. 2026-09-001" />
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

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Office Name</label>
                  <input type="text" value={reqOfficerOffice} onChange={e => setReqOfficerOffice(e.target.value)} className="form-input" style={{ width: "100%" }} placeholder="e.g. Municipal Health Office" />
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
                  style={{ fontSize: "0.7rem", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}
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
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: 13in 8.5in; }
        }
      `}</style>
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