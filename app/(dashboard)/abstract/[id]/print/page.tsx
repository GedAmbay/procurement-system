"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2, ZoomIn, ZoomOut, Users, Edit3 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { toast } from "sonner";

export default function AbstractLivePreviewPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [allSignatories, setAllSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.85);

  // Editable form state
  const [showPrNo, setShowPrNo] = useState(true);
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bacResNo, setBacResNo] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [dateAwarded, setDateAwarded] = useState(() => new Date().toISOString().split("T")[0]);

  // Signatories overrides: record of id -> { name, position, label }
  const [sigOverrides, setSigOverrides] = useState<Record<string, { name: string; position: string; label: string }>>({});
  const [selectedSigIds, setSelectedSigIds] = useState<string[]>([]);

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
          // Pre-fill date received from earliest quotation submittedAt
          const dates = (d.rfq?.quotations || [])
            .map((q: any) => q.submittedAt)
            .filter(Boolean)
            .sort();
          if (dates.length > 0) setDateReceived(new Date(dates[0]).toISOString().split("T")[0]);
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
  if (!data) return <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Not found</div>;

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

  const displayQuotes = [...quotations];
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

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "2px 4px", fontSize: "9px", verticalAlign: "middle" };
  const headerCell: React.CSSProperties = { ...cell, fontWeight: "700", textAlign: "center", background: "#fff" };

  return (
    <div className="flex flex-col overflow-hidden print:block print:!h-auto print:!overflow-visible"
      style={{ height: "calc(var(--full-vh, 100vh) - 72px)" }}>

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
            <div style={{ fontWeight: "700", fontSize: "0.9375rem", color: "#0f172a" }}>Abstract of Canvass — Live Preview</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{data.aoqNumber}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Zoom Controls */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.125rem",
            background: "var(--color-page-bg)", borderRadius: "9999px",
            boxShadow: "var(--shadow-neu-drop)", padding: "0.25rem 0.5rem",
          }}>
            <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: "4px" }}><ZoomOut size={15} /></button>
            <button type="button" onClick={() => setZoom(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "0.75rem", fontWeight: "700", padding: "4px 6px", minWidth: "40px" }}>{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: "4px" }}><ZoomIn size={15} /></button>
          </div>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden print:block print:!h-auto">

        {/* ─── Left: Live Preview ─── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#94a3b8", padding: "1.5rem" }}
          className="print:p-0 print:bg-white print:block print:!overflow-visible">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", marginBottom: `${(zoom - 1) * 1100}px` }}
            className="print:!transform-none print:!mb-0">
            <div style={{
              width: "1050px", background: "#fff", margin: "0 auto",
              padding: "20px 24px", fontFamily: "Arial, sans-serif", fontSize: "9px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
            }} className="print:shadow-none print:w-full">

              {/* Doc Header */}
              <div style={{ textAlign: "center", marginBottom: "6px" }}>
                <div>Republic of the Philippines</div>
                <div>Province of Antique</div>
                <div>Municipality of Pandan</div>
              </div>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "15px", fontWeight: "900", letterSpacing: "0.05em" }}>ABSTRACT OF CANVASS</div>
              </div>

              {/* PR No & Date */}
              <div style={{ display: "flex", justifyContent: "center", gap: "48px", marginBottom: "8px", fontSize: "9px" }}>
                <div>
                  Purchase Request No.:&nbsp;
                  <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "80px", paddingBottom: "1px" }}>
                    &nbsp;{showPrNo ? rfq.rfqNumber : ""}&nbsp;
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
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
                <thead>
                  <tr>
                    <th style={{ ...headerCell, width: "26px" }} rowSpan={3}>NO.</th>
                    <th style={{ ...headerCell }} rowSpan={3}>DESCRIPTION</th>
                    <th style={{ ...headerCell, width: "38px" }} rowSpan={3}>QTY</th>
                    <th style={{ ...headerCell, width: "34px" }} rowSpan={3}>UNIT</th>
                    <th style={{ ...headerCell }} colSpan={displayQuotes.length * 2}>SUPPLIER&apos;S NAME</th>
                  </tr>
                  <tr>
                    {displayQuotes.map((q: any, i: number) => (
                      <th key={i} style={{ ...headerCell, fontSize: "8px" }} colSpan={2}>
                        {q ? q.supplier?.name?.toUpperCase() : `SUPPLIER ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {displayQuotes.map((_: any, i: number) => (
                      <>
                        <th key={`up-${i}`} style={{ ...headerCell, width: "75px", fontSize: "7.5px" }}>UNIT PRICE</th>
                        <th key={`tp-${i}`} style={{ ...headerCell, width: "85px", fontSize: "7.5px" }}>TOTAL PRICE</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item: any, idx: number) => {
                    const isRec = recommendedQuote !== undefined;
                    return (
                      <tr key={item.id}>
                        <td style={{ ...cell, textAlign: "center", fontWeight: "700", verticalAlign: "top" }}>{idx + 1}</td>
                        <td style={{ ...cell, fontWeight: "700" }}>{item.description}</td>
                        <td style={{ ...cell, textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ ...cell, textAlign: "center" }}>{item.unit}</td>
                        {displayQuotes.map((q: any, qi: number) => {
                          const prices = q ? getItemPrice(q, item.id) : { unitPrice: 0, totalPrice: 0 };
                          const isWinner = q && recommendedQuote && q.id === recommendedQuote.id;
                          return (
                            <>
                              <td key={`up-${qi}`} style={{ ...cell, textAlign: "right", fontWeight: isWinner ? "700" : "400" }}>
                                {fmt2(prices.unitPrice)}
                              </td>
                              <td key={`tp-${qi}`} style={{ ...cell, textAlign: "right", fontWeight: isWinner ? "700" : "400" }}>
                                {fmt2(prices.totalPrice)}
                              </td>
                            </>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {Array.from({ length: Math.max(0, 10 - lineItems.length) }).map((_, i) => (
                    <tr key={`fill-${i}`} style={{ height: "14px" }}>
                      <td style={cell}></td><td style={cell}></td><td style={cell}></td><td style={cell}></td>
                      {displayQuotes.map((_: any, qi: number) => (
                        <><td key={`fu-${qi}`} style={cell}></td><td key={`ft-${qi}`} style={cell}></td></>
                      ))}
                    </tr>
                  ))}

                  {/* TOTAL row */}
                  <tr>
                    <td style={{ ...headerCell, borderTop: "2px solid #000", textAlign: "center" }} colSpan={4}>TOTAL AMOUNT</td>
                    {displayQuotes.map((q: any, qi: number) => {
                      const isWinner = q && recommendedQuote && q.id === recommendedQuote.id;
                      return (
                        <>
                          <td key={`tot-up-${qi}`} style={{ ...cell, borderTop: "2px solid #000" }}></td>
                          <td key={`tot-tp-${qi}`} style={{ ...cell, borderTop: "2px solid #000", textAlign: "right", fontWeight: "700", fontSize: isWinner ? "10px" : "9px" }}>
                            {q && q.totalAmount > 0 ? fmt2(q.totalAmount) : ""}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                </tbody>
              </table>

              {/* BAC Res No */}
              <div style={{ fontSize: "9px", marginBottom: "8px" }}>
                BAC Resolution No.:&nbsp;
                <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "100px" }}>
                  &nbsp;{bacResNo}&nbsp;
                </span>
              </div>

              {/* Certification Paragraph */}
              <div style={{ fontSize: "9px", lineHeight: "1.6", marginBottom: "14px", textAlign: "justify" }}>
                &nbsp;&nbsp;&nbsp;&nbsp;We, the undersigned the BAC Chairman, Members and Requisitioning Officer, do hereby certify that the foregoing is the true and correct ABSTRACT OF CANVASS of the Request for Quotation received on <strong>{fmtDate(dateReceived)}</strong> by BAC Secretariat and was opened by Bids and Awards Committee of Pandan, Antique on <strong>{fmtDate(dateAwarded)}</strong> for&nbsp;
                <span style={{ borderBottom: "1px solid #000" }}><strong>&nbsp;{pr?.purpose}&nbsp;</strong></span>
                &nbsp;needed for use in the Office of the <strong>{pr?.office?.name || "___________________"}</strong>, Pandan, Antique.
                The offer <strong><span style={{ textDecoration: "underline" }}>{recommendedQuote ? recommendedQuote.supplier?.name?.toUpperCase() : "___________________"}</span></strong> for items herein and respectively checked and articles/materials are hereby ACCEPTED AND AWARDED OF PRICE RECOMMENDATION. Recommending approval of the award in favor of the dealer quoted most advantageous offers indicating in the column above.
              </div>

              {/* Signatories */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
                {bacChairman && (
                  <div style={{ flex: "0 0 auto", textAlign: "center", minWidth: "120px" }}>
                    <div style={{ fontWeight: "900", fontSize: "9px", textTransform: "uppercase" }}>{bacChairman.name}</div>
                    <div style={{ fontSize: "8px" }}>{bacChairman.position}</div>
                    <div style={{ fontSize: "8px", fontWeight: "700" }}>BAC Chairman</div>
                  </div>
                )}
                {bacMembers.map((m: any) => (
                  <div key={m.id} style={{ flex: "0 0 auto", textAlign: "center", minWidth: "100px" }}>
                    <div style={{ fontWeight: "900", fontSize: "9px", textTransform: "uppercase" }}>{m.name}</div>
                    <div style={{ fontSize: "8px" }}>{m.position}</div>
                    <div style={{ fontSize: "8px", fontWeight: "700" }}>{m.label || "BAC Member"}</div>
                  </div>
                ))}
                <div style={{ flex: "0 0 auto", textAlign: "center", minWidth: "110px", marginLeft: "auto" }}>
                  <div style={{ fontWeight: "900", fontSize: "9px", textTransform: "uppercase" }}>{pr?.requestedBy || "___________________"}</div>
                  <div style={{ fontSize: "8px" }}>{pr?.office?.name}</div>
                  <div style={{ fontSize: "8px", fontWeight: "700" }}>Requisitioning Officer</div>
                </div>
              </div>

              {/* Approved by */}
              <div style={{ textAlign: "right", marginTop: "6px" }}>
                <div style={{ fontSize: "9px", marginBottom: "20px" }}>Approved:</div>
                {hope ? (
                  <div style={{ display: "inline-block", textAlign: "center" }}>
                    <div style={{ fontWeight: "900", fontSize: "10px", textTransform: "uppercase" }}>{hope.name}</div>
                    <div style={{ fontSize: "9px" }}>{hope.position}</div>
                  </div>
                ) : (
                  <div style={{ display: "inline-block", textAlign: "center" }}>
                    <div style={{ borderBottom: "1px solid #000", width: "180px", marginBottom: "2px" }}></div>
                    <div style={{ fontSize: "9px" }}>Municipal Mayor</div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ─── Right: Form Panel ─── */}
        <div className="no-print" style={{
          width: "340px", flexShrink: 0,
          borderLeft: "1px solid #e2e8f0",
          background: "var(--color-page-bg)",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ── Document Details ── */}
            <section>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                📋 Document Details
              </div>

              {/* PR Number toggle */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                  Purchase Request No.
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", cursor: "pointer", color: "#334155" }}>
                    <input type="radio" checked={showPrNo} onChange={() => setShowPrNo(true)} style={{ accentColor: "#2563eb" }} />
                    Show ({rfq.rfqNumber})
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", cursor: "pointer", color: "#334155" }}>
                    <input type="radio" checked={!showPrNo} onChange={() => setShowPrNo(false)} style={{ accentColor: "#2563eb" }} />
                    Leave blank
                  </label>
                </div>
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

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Date Opened / Awarded</label>
                <input type="date" value={dateAwarded} onChange={e => setDateAwarded(e.target.value)} className="form-input" style={{ width: "100%" }} />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Purpose</label>
                <div style={{
                  padding: "0.5rem 0.75rem", borderRadius: "0.625rem", fontSize: "0.8125rem",
                  background: "var(--color-page-bg)", boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)",
                  color: "#64748b", minHeight: "40px",
                }}>
                  {pr?.purpose || "—"}
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Recommended Supplier <span style={{ color: "#16a34a" }}>(auto)</span></label>
                <div style={{
                  padding: "0.5rem 0.75rem", borderRadius: "0.625rem", fontSize: "0.8125rem",
                  background: "var(--color-page-bg)", boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)",
                  color: recommendedQuote ? "#059669" : "#94a3b8", fontWeight: recommendedQuote ? "700" : "400",
                }}>
                  {recommendedQuote ? recommendedQuote.supplier?.name : "No bids encoded yet"}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Requesting Office <span style={{ color: "#16a34a" }}>(auto)</span></label>
                <div style={{
                  padding: "0.5rem 0.75rem", borderRadius: "0.625rem", fontSize: "0.8125rem",
                  background: "var(--color-page-bg)", boxShadow: "inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)",
                  color: "#64748b",
                }}>
                  {pr?.office?.name || "—"}
                </div>
              </div>
            </section>

            {/* ── Signatories ── */}
            <section>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                ✍ Signatories
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {allSignatories.map((sig: any) => {
                  const isSelected = selectedSigIds.includes(sig.id);
                  const override = sigOverrides[sig.id] || { name: sig.name, position: sig.position, label: getRoleLabel(sig.role) };
                  return (
                    <div key={sig.id} style={{
                      borderRadius: "0.75rem", padding: "0.75rem",
                      background: "var(--color-page-bg)",
                      boxShadow: isSelected ? "var(--shadow-neu-drop)" : "inset 3px 3px 6px rgba(163,177,198,0.4), inset -3px -3px 6px rgba(255,255,255,0.8)",
                      opacity: isSelected ? 1 : 0.5, transition: "all 0.2s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: isSelected ? "0.625rem" : 0 }}>
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
                      </div>
                      {isSelected && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", paddingLeft: "1.5rem" }}>
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
            </section>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: landscape; margin: 0.5cm; }
        }
      `}</style>
    </div>
  );
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    HOPE: "HOPE / LCE",
    BAC_CHAIRMAN: "BAC Chairman",
    BAC_MEMBER: "BAC Member",
    BUDGET_OFFICER: "BAC Member",
    SUPPLY_OFFICER: "BAC Member",
    END_USER: "BAC Member",
    APPROVING_OFFICIAL: "Approving Official",
    VIEWER: "Viewer",
  };
  return map[role] ?? role;
}