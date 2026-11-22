"use client";

import LoaderWave from "@/components/ui/loader-wave";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Printer,
  Loader2,
  ZoomIn,
  ZoomOut,
  Users,
  Edit3,
  Minus,
  Plus,
  Save,
  CheckCircle2,
  Lock,
  Unlock,
  LayoutGrid,
  CalendarX,
  FileText,
  User,
  Calendar,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, LGU_INFO } from "@/lib/utils";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/confirm-modal";
import {
  AbstractExcelTableGrid,
  AbstractQuotationData,
} from "@/components/documents/abstract-excel-table-grid";

export default function AbstractLivePreviewPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [allSignatories, setAllSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);

  const [zoom, setZoom] = useState(0.65);
  const [targetRows, setTargetRows] = useState(15);

  // 3-Panel Right Sidebar state
  const [panelView, setPanelView] = useState<"details" | "item" | "spec">("details");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);

  // Local quotation state to allow live in-grid editing
  const [localQuotations, setLocalQuotations] = useState<any[]>([]);
  const [dirtyQuotationIds, setDirtyQuotationIds] = useState<Set<string>>(new Set());

  // Editable form state
  const [showPrNo, setShowPrNo] = useState(true);
  const [docDate, setDocDate] = useState("");
  const [bacResNo, setBacResNo] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [dateAwarded, setDateAwarded] = useState("");

  // Signatories overrides: record of id -> { name, position, label, annotation }
  const [sigOverrides, setSigOverrides] = useState<
    Record<string, { name: string; position: string; label: string; annotation?: string }>
  >({});
  const [selectedSigIds, setSelectedSigIds] = useState<string[]>([]);
  const [editingSigId, setEditingSigId] = useState<string | null>(null);
  const [showAllSigs, setShowAllSigs] = useState(false);
  const [reqOfficerName, setReqOfficerName] = useState("");
  const [reqOfficerOffice, setReqOfficerOffice] = useState("");
  const [pageBreaks, setPageBreaks] = useState<(number | string)[]>([]);
  const [activeLeavesOnDate, setActiveLeavesOnDate] = useState<any[]>([]);

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);

  // Global Escape key and click-outside listeners to unselect cell & signatory
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const activeEl = document.activeElement as HTMLElement | null;
        const isInput =
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.isContentEditable;

        // If actively typing inside the right panel form, don't close panel
        if (isInput && rightPanelRef.current?.contains(activeEl)) {
          return;
        }

        setActiveItemIndex(null);
        setActiveSpecIndex(null);
        setPanelView("details");
        setEditingSigId(null);
      }
    };

    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not clear if clicking inside the right panel or a modal
      if (
        rightPanelRef.current?.contains(target) ||
        target.closest?.(".confirm-modal") ||
        target.closest?.("[role='dialog']")
      ) {
        return;
      }

      // Check if click was inside table grid
      const isInsideGrid = gridWrapperRef.current?.contains(target);
      if (!isInsideGrid) {
        setActiveItemIndex(null);
        setActiveSpecIndex(null);
        setPanelView("details");
      }

      // Check if click was on a signatory
      const isSignatory = target.closest?.(".signatory-interactive");
      if (!isSignatory) {
        setEditingSigId(null);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("mousedown", handleGlobalMouseDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener("mousedown", handleGlobalMouseDown);
    };
  }, []);

  const togglePageBreak = (idx: number | string) => {
    setPageBreaks((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const syncVerifiedLeaves = () => {
    if (activeLeavesOnDate.length === 0) {
      toast.info("No approved leaves found on this document date.");
      return;
    }
    let updatedCount = 0;
    setSigOverrides((prev) => {
      const next = { ...prev };
      activeLeavesOnDate.forEach((l) => {
        const sigId = l.signatoryId;
        if (next[sigId]) {
          next[sigId] = {
            ...next[sigId],
            annotation: "(ON LEAVE)",
          };
          updatedCount++;
        }
      });
      return next;
    });
    toast.success(`Synchronized ${updatedCount} verified leave annotation(s)`);
  };

  useEffect(() => {
    if (!dateAwarded) {
      setActiveLeavesOnDate([]);
      return;
    }
    async function fetchLeaves() {
      try {
        const res = await fetch(`/api/bac/leave?start=${dateAwarded}&end=${dateAwarded}`);
        if (res.ok) {
          const leaves = await res.json();
          setActiveLeavesOnDate(leaves);
        }
      } catch (e) {
        console.error("Failed to check leaves for award date", e);
      }
    }
    fetchLeaves();
  }, [dateAwarded]);

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
          if (d.rfq?.quotations) {
            setLocalQuotations(d.rfq.quotations);
          }
          if (d.updatedAt) setLastSaved(new Date(d.updatedAt));
          if (d.lastSavedBy) setLastSavedBy(d.lastSavedBy);
          if (d.rfq?.pr) {
            setReqOfficerName(d.reqOfficerName || d.rfq.pr.requestedBy || "");
            setReqOfficerOffice(d.reqOfficerOffice || d.rfq.pr.office?.name || "");
          }
          if (d.docDate) setDocDate(new Date(d.docDate).toISOString().split("T")[0]);
          if (d.bacResNo) setBacResNo(d.bacResNo);
          if (d.dateReceived)
            setDateReceived(new Date(d.dateReceived).toISOString().split("T")[0]);
          if (d.dateAwarded)
            setDateAwarded(new Date(d.dateAwarded).toISOString().split("T")[0]);
        }
        if (sigRes.ok) {
          const sigs = await sigRes.json();
          setAllSignatories(sigs);

          if (abstractRes.ok && abstractResData && abstractResData.signatoriesData) {
            const savedSigs = abstractResData.signatoriesData as any;
            setSelectedSigIds(savedSigs.selectedSigIds || []);
            setSigOverrides(savedSigs.sigOverrides || {});
          } else {
            const defaultRoles = [
              "HOPE",
              "BAC_CHAIRMAN",
              "BAC_VICE_CHAIRMAN",
              "BAC_MEMBER",
              "APPROVING_OFFICIAL",
            ];
            const activeAndRelevant = sigs.filter(
              (s: any) => s.isActive && defaultRoles.includes(s.role)
            );
            setSelectedSigIds(activeAndRelevant.map((s: any) => s.id));
            const overrides: Record<string, { name: string; position: string; label: string }> =
              {};
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

  const rfq = data?.rfq;
  const pr = rfq?.pr;
  const quotations: any[] =
    localQuotations.length > 0 ? localQuotations : rfq?.quotations || [];
  const lineItems: any[] = rfq?.lineItems || [];

  // Group line items into Main items and nested specification lines
  const mainItems = useMemo(() => {
    const list: {
      rawIndex: number;
      mainIndex: number;
      displayNo: number;
      item: any;
      specs: { rawIndex: number; item: any }[];
    }[] = [];
    let currentMain: any = null;
    let counter = 0;

    (lineItems || []).forEach((it: any, idx: number) => {
      const isBlank =
        !it.description?.trim() && (!it.quantity || Number(it.quantity) === 0);
      if (isBlank) return;

      const isMain = it.quantity && Number(it.quantity) > 0;
      if (isMain) {
        counter++;
        currentMain = {
          rawIndex: idx,
          mainIndex: list.length,
          displayNo: counter,
          item: it,
          specs: [],
        };
        list.push(currentMain);
      } else if (currentMain) {
        currentMain.specs.push({
          rawIndex: idx,
          item: it,
        });
      } else {
        counter++;
        currentMain = {
          rawIndex: idx,
          mainIndex: list.length,
          displayNo: counter,
          item: it,
          specs: [],
        };
        list.push(currentMain);
      }
    });

    return list;
  }, [lineItems]);

  const activeMain = useMemo(() => {
    if (activeItemIndex === null) return null;
    return (
      mainItems.find(
        (m) =>
          m.rawIndex === activeItemIndex ||
          m.specs.some((s) => s.rawIndex === activeItemIndex)
      ) || null
    );
  }, [mainItems, activeItemIndex]);

  const activeSpec = useMemo(() => {
    if (activeSpecIndex === null || !activeMain) return null;
    return activeMain.specs.find((s) => s.rawIndex === activeSpecIndex) || null;
  }, [activeMain, activeSpecIndex]);

  useEffect(() => {
    if (panelView === "item" && !activeMain) {
      setPanelView("details");
    } else if (panelView === "spec" && (!activeMain || activeSpecIndex === null)) {
      setPanelView(activeMain ? "item" : "details");
    }
  }, [panelView, activeMain, activeSpecIndex]);

  const sortedQuotations = useMemo(() => {
    return [...quotations].sort((a, b) => {
      if (a.totalAmount === 0 && b.totalAmount > 0) return 1;
      if (b.totalAmount === 0 && a.totalAmount > 0) return -1;
      return (a.totalAmount || 0) - (b.totalAmount || 0);
    });
  }, [quotations]);

  const displayQuotes = useMemo(() => {
    const list = [...sortedQuotations];
    const MAX_SUPPLIERS = 3;
    while (list.length < MAX_SUPPLIERS) list.push(null);
    return list;
  }, [sortedQuotations]);

  const validQuotes = quotations.filter((q) => q.totalAmount > 0);
  const lowestAmount =
    validQuotes.length > 0
      ? Math.min(...validQuotes.map((q: any) => q.totalAmount))
      : null;
  const recommendedQuote = validQuotes.find((q) => q.totalAmount === lowestAmount);

  const handlePriceChange = (
    quotationId: string,
    rfqLineItemId: string,
    newUnitPrice: number
  ) => {
    setLocalQuotations((prevQuotes) => {
      return prevQuotes.map((q) => {
        if (!q || q.id !== quotationId) return q;
        const existingLines = [...(q.lineItems || [])];
        const targetIdx = existingLines.findIndex(
          (l) => l.rfqLineItemId === rfqLineItemId
        );
        const rfqItem = (lineItems || []).find((it: any) => it.id === rfqLineItemId);
        const qty = Number(rfqItem?.quantity) || 0;
        const totalPrice = qty * newUnitPrice;

        if (targetIdx >= 0) {
          existingLines[targetIdx] = {
            ...existingLines[targetIdx],
            unitPrice: newUnitPrice,
            totalPrice,
          };
        } else {
          existingLines.push({
            rfqLineItemId,
            unitPrice: newUnitPrice,
            totalPrice,
          });
        }

        const totalAmount = existingLines.reduce(
          (sum, it) => sum + (it.totalPrice || 0),
          0
        );
        return { ...q, lineItems: existingLines, totalAmount };
      });
    });
    setDirtyQuotationIds((prev) => new Set(prev).add(quotationId));
  };

  const handleRowSelect = (index: number) => {
    if (isReadOnly) return;
    const item = lineItems[index];
    if (!item) {
      setActiveItemIndex(null);
      setActiveSpecIndex(null);
      setPanelView("details");
      return;
    }
    const isSpec = !item.quantity || Number(item.quantity) === 0;
    if (isSpec) {
      let parentRawIdx = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (lineItems[i]?.quantity && Number(lineItems[i].quantity) > 0) {
          parentRawIdx = i;
          break;
        }
      }
      if (parentRawIdx >= 0) {
        setActiveItemIndex(parentRawIdx);
        setActiveSpecIndex(index);
        setPanelView("spec");
      } else {
        setActiveItemIndex(index);
        setActiveSpecIndex(null);
        setPanelView("item");
      }
    } else {
      setActiveItemIndex(index);
      setActiveSpecIndex(null);
      setPanelView("item");
    }
  };

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

      // Save any updated quotation bids
      if (dirtyQuotationIds.size > 0) {
        const savePromises = Array.from(dirtyQuotationIds).map((qId) => {
          const q = localQuotations.find((lq) => lq?.id === qId);
          if (!q) return Promise.resolve();
          return fetch(`/api/quotations/${qId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "RETURNED",
              submittedAt: dateReceived,
              lineItems: q.lineItems,
            }),
          });
        });
        await Promise.all(savePromises);
        setDirtyQuotationIds(new Set());
      }

      const updated = await res.json();
      setData((prev: any) => ({ ...prev, ...updated }));
      setLastSaved(new Date());
      if (updated.lastSavedBy) {
        setLastSavedBy(updated.lastSavedBy);
      } else if (session?.user?.name) {
        setLastSavedBy(session.user.name);
      }
      toast.success(
        newStatus ? `Abstract ${newStatus.toLowerCase()} successfully!` : "Changes saved"
      );
      if (newStatus) setIsUnlocked(false);
    } catch (error) {
      toast.error("An error occurred while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockConfirm = async (password?: string) => {
    if (!password) {
      toast.error("Password is required");
      return;
    }
    setIsUnlocked(true);
    setUnlockModalOpen(false);
    toast.success("Document unlocked securely");
  };

  const handleSaveConfirm = () => {
    setSaveModalOpen(false);
    saveChanges();
  };

  if (loading) return <LoaderWave variant="page" label="Preparing document..." />;
  if (!data)
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
        Abstract not found
      </div>
    );

  const isReadOnly = data.status !== "DRAFT" && !isUnlocked;

  const fmt2 = (n: number) =>
    n > 0
      ? n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";
  const fmtDate = (iso: string) =>
    iso
      ? new Date(iso).toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "___________________";

  const selectedSigs = selectedSigIds
    .map((id) => allSignatories.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => ({ ...s, ...sigOverrides[s.id] }));

  const hope = selectedSigs.find(
    (s) => s.role === "HOPE" || s.role === "APPROVING_OFFICIAL"
  );
  const bacChairman = selectedSigs.find((s) => s.role === "BAC_CHAIRMAN");
  const bacMembers = selectedSigs.filter(
    (s) => s.id !== hope?.id && s.id !== bacChairman?.id
  );

  const getSignatoryAnnotation = (sig: any) => {
    if (!dateAwarded || !sig) return null;
    if (
      sig.annotation !== undefined &&
      sig.annotation !== null &&
      sig.annotation !== ""
    ) {
      return sig.annotation;
    }
    if (sig.annotation === "") {
      return null;
    }
    const onLeave = activeLeavesOnDate.some((l: any) => l.signatoryId === sig.id);
    if (onLeave) {
      return "(ON LEAVE)";
    }
    return null;
  };

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
    return `Saved on ${lastSaved.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    })}`;
  };

  return (
    <div
      className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none"
      style={{ height: "calc(var(--full-vh) - 88px)" }}
    >
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
                : data.bacResNo?.trim()
                ? `Res. ${data.bacResNo.trim()}`
                : "Abstract of Canvass"}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    data.status === "COMPLETED" || data.status === "SIGNED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {data.status === "COMPLETED" || data.status === "SIGNED" ? (
                    <CheckCircle2 size={12} className="text-emerald-700" />
                  ) : (
                    <Lock size={12} className="text-blue-700" />
                  )}
                  {data.status === "SIGNED" || data.status === "COMPLETED"
                    ? "COMPLETED"
                    : data.status || "FINAL"}
                </span>
                {getSavedTimeText() && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span>{getSavedTimeText()}</span>
                    {lastSavedBy && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium">
                          by <strong className="font-semibold text-slate-700">{lastSavedBy}</strong>
                        </span>
                      </>
                    )}
                  </span>
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
                    <span>{getSavedTimeText()}</span>
                    {lastSavedBy && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium">
                          by <strong className="font-semibold text-slate-700">{lastSavedBy}</strong>
                        </span>
                      </>
                    )}
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
              {data.status === "ISSUED" && (
                <button
                  type="button"
                  onClick={() => saveChanges("COMPLETED")}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  Mark as Completed
                </button>
              )}
              <button
                type="button"
                onClick={() => setUnlockModalOpen(true)}
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
                onClick={() => setSaveModalOpen(true)}
                disabled={submitting}
                className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{" "}
                Save
              </button>
              {data.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => saveChanges("ISSUED")}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  Finalize
                </button>
              )}
              {data.status === "ISSUED" && (
                <button
                  type="button"
                  onClick={() => saveChanges("COMPLETED")}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  Mark as Completed
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <CheckCircle2 size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">
              {data.status === "COMPLETED" || data.status === "SIGNED"
                ? "This Abstract of Canvass is completed."
                : "This Abstract of Canvass is finalized and locked."}
            </strong>{" "}
            {data.status === "COMPLETED" || data.status === "SIGNED"
              ? "All quotations, evaluations, and signatures are finalized."
              : "Unlock it to make changes."}
          </span>
        </div>
      )}

      <div className="flex flex-1 min-w-0 max-w-full w-full gap-4 overflow-hidden relative print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!w-full">
        {/* Left Side: Live Print Preview */}
        <div className="flex-1 w-0 min-w-0 max-w-full rounded-2xl bg-[#d8e1eb] overflow-hidden relative flex flex-col shadow-inner print:rounded-none print:!bg-white print:!overflow-visible print:!shadow-none print:!block print:!w-full print:!m-0 print:!p-0">
          {/* Zoom Controls */}
          <div className="no-print absolute bottom-6 left-6 flex items-center gap-1 bg-white p-1 rounded-full shadow-md border border-slate-200 z-10 text-slate-600">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.4))}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-3 hover:bg-slate-100 rounded-full font-bold text-xs h-full transition-colors"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
            <button
              type="button"
              onClick={() => setTargetRows((r) => Math.max(r - 1, 0))}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Remove Row"
            >
              <Minus size={18} />
            </button>
            <div
              className="px-2 font-bold text-xs flex flex-col items-center justify-center h-full"
              title="Target Table Rows"
            >
              <span className="leading-none">{targetRows}</span>
              <span className="text-[9px] leading-none text-slate-400">Rows</span>
            </div>
            <button
              type="button"
              onClick={() => setTargetRows((r) => r + 1)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Add Row"
            >
              <Plus size={18} />
            </button>
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
                    className="abstract-print-sheet print-area w-[1500px] shadow-xl min-h-[816px] p-[40px] print:!p-0 block print:shadow-none print:!w-full print:!max-w-none print:!m-0 print:!min-h-0"
                  >
                    <div style={{ border: "1px solid #000", padding: "10px 0" }}>
                      {/* Doc Header */}
                      <div style={{ textAlign: "center", marginBottom: "6px" }}>
                        <div>Republic of the Philippines</div>
                        <div>Province of Antique</div>
                        <div>Municipality of Pandan</div>
                      </div>
                      <div style={{ textAlign: "center", marginBottom: "8px" }}>
                        <div
                          style={{
                            fontSize: "20px",
                            fontWeight: "700",
                            letterSpacing: "0.05em",
                          }}
                        >
                          ABSTRACT OF CANVASS
                        </div>
                      </div>

                      {/* PR No & Date */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "48px",
                          marginBottom: "8px",
                          fontSize: "13px",
                        }}
                      >
                        <div>
                          Purchase Request No.:&nbsp;
                          <span
                            style={{
                              borderBottom: "1px solid #000",
                              display: "inline-block",
                              minWidth: "80px",
                              paddingBottom: "1px",
                            }}
                          >
                            &nbsp;{showPrNo ? pr?.prNumber : ""}&nbsp;
                          </span>
                        </div>
                        <div>
                          Dated:&nbsp;
                          <span
                            style={{
                              borderBottom: "1px solid #000",
                              display: "inline-block",
                              minWidth: "80px",
                              paddingBottom: "1px",
                            }}
                          >
                            &nbsp;{docDate ? fmtDate(docDate) : ""}&nbsp;
                          </span>
                        </div>
                      </div>

                      {/* Excel-style Main Table Grid */}
                      <div ref={gridWrapperRef}>
                        <AbstractExcelTableGrid
                          items={lineItems}
                          quotations={displayQuotes}
                          targetRows={targetRows}
                          isReadOnly={isReadOnly}
                          pageBreaks={pageBreaks}
                          onTogglePageBreak={togglePageBreak}
                          activeItemIndex={
                            activeSpecIndex !== null ? activeSpecIndex : activeItemIndex
                          }
                          onRowSelect={handleRowSelect}
                          onPriceChange={handlePriceChange}
                          onDeselect={() => {
                            setActiveItemIndex(null);
                            setActiveSpecIndex(null);
                            setPanelView("details");
                          }}
                        />
                      </div>

                      {/* Certification Paragraph */}
                      <div
                        className="print:break-inside-avoid"
                        style={{
                          margin: "0 24px 10px 24px",
                          fontSize: "13px",
                          lineHeight: "1.5",
                          textAlign: "justify",
                        }}
                      >
                        WE HEREBY CERTIFY that the above are true and correct results of bids
                        received in the return envelope sealed with our BAC sealing tape on or
                        before{" "}
                        <span style={{ fontWeight: "700" }}>{fmtDate(dateReceived)}</span> and
                        subsequently opened by the Committee on Bids and Awards on{" "}
                        <span style={{ fontWeight: "700" }}>{fmtDate(dateAwarded)}</span>, at
                        which time, date and place where{" "}
                        <span style={{ fontWeight: "700", textDecoration: "underline" }}>
                          {recommendedQuote
                            ? recommendedQuote.supplier?.name?.toUpperCase()
                            : "_________________________________"}
                        </span>{" "}
                        was recommended for award of the contract as being the lowest quotation
                        complying with the requirements and specifications.
                      </div>

                      {/* BAC Signatures Section */}
                      {(() => {
                        const hasAnySigAnnotation =
                          selectedSigs.some((s) => getSignatoryAnnotation(s) !== null) ||
                          (dateAwarded && activeLeavesOnDate.length > 0);
                        const reqAnnotation = dateAwarded ? null : null;

                        return (
                          <div
                            className="print:break-inside-avoid"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginTop: "10px",
                              padding: "0 24px",
                              gap: "8px",
                            }}
                          >
                            {bacChairman && (
                              <div
                                className="signatory-interactive"
                                onClick={() => {
                                  setEditingSigId(bacChairman.id);
                                  setShowAllSigs(false);
                                }}
                                style={{
                                  flex: "1 1 auto",
                                  textAlign: "center",
                                  padding: "4px",
                                  cursor: "pointer",
                                  borderRadius: "6px",
                                  backgroundColor:
                                    editingSigId === bacChairman.id
                                      ? "rgba(37,99,235,0.08)"
                                      : "transparent",
                                }}
                                title="Click to edit"
                              >
                                {hasAnySigAnnotation && (
                                  <div
                                    style={{
                                      fontWeight: "700",
                                      fontSize: "11px",
                                      color: "#64748b",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      marginBottom: "3px",
                                      minHeight: "15px",
                                      lineHeight: "15px",
                                      visibility: getSignatoryAnnotation(bacChairman)
                                        ? "visible"
                                        : "hidden",
                                    }}
                                  >
                                    {getSignatoryAnnotation(bacChairman) || "\u00A0"}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    textTransform: "uppercase",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {bacChairman.name}
                                </div>
                                <div style={{ fontSize: "12px" }}>{bacChairman.position}</div>
                                <div style={{ fontSize: "12px" }}>
                                  {bacChairman.label || "BAC Chairman"}
                                </div>
                              </div>
                            )}
                            {bacMembers.map((m: any) => (
                              <div
                                key={m.id}
                                className="signatory-interactive"
                                onClick={() => {
                                  setEditingSigId(m.id);
                                  setShowAllSigs(false);
                                }}
                                style={{
                                  flex: "1 1 auto",
                                  textAlign: "center",
                                  padding: "4px",
                                  cursor: "pointer",
                                  borderRadius: "6px",
                                  backgroundColor:
                                    editingSigId === m.id
                                      ? "rgba(37,99,235,0.08)"
                                      : "transparent",
                                }}
                                title="Click to edit"
                              >
                                {hasAnySigAnnotation && (
                                  <div
                                    style={{
                                      fontWeight: "700",
                                      fontSize: "11px",
                                      color: "#64748b",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      marginBottom: "3px",
                                      minHeight: "15px",
                                      lineHeight: "15px",
                                      visibility: getSignatoryAnnotation(m)
                                        ? "visible"
                                        : "hidden",
                                    }}
                                  >
                                    {getSignatoryAnnotation(m) || "\u00A0"}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    textTransform: "uppercase",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {m.name}
                                </div>
                                <div style={{ fontSize: "12px" }}>{m.position}</div>
                                <div style={{ fontSize: "12px" }}>
                                  {m.label || "BAC Member"}
                                </div>
                              </div>
                            ))}
                            <div
                              className="signatory-interactive"
                              onClick={() => {
                                setEditingSigId("req");
                                setShowAllSigs(false);
                              }}
                              style={{
                                flex: "1 1 auto",
                                textAlign: "center",
                                padding: "4px",
                                cursor: "pointer",
                                borderRadius: "6px",
                                backgroundColor:
                                  editingSigId === "req"
                                    ? "rgba(37,99,235,0.08)"
                                    : "transparent",
                              }}
                              title="Click to edit"
                            >
                              {hasAnySigAnnotation && (
                                <div
                                  style={{
                                    fontWeight: "700",
                                    fontSize: "11px",
                                    color: "#64748b",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    marginBottom: "3px",
                                    minHeight: "15px",
                                    lineHeight: "15px",
                                    visibility: reqAnnotation ? "visible" : "hidden",
                                  }}
                                >
                                  {reqAnnotation || "\u00A0"}
                                </div>
                              )}
                              <div
                                style={{
                                  fontWeight: "700",
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {reqOfficerName || "___________________"}
                              </div>
                              <div style={{ fontSize: "12px" }}>Requisitioning Officer</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Approved by */}
                      <div
                        className="print:break-inside-avoid"
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: "6px",
                          padding: "0 24px",
                          marginBottom: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ fontSize: "13px", marginBottom: "30px" }}>
                            Approved:
                          </div>
                          {hope ? (
                            <div style={{ textAlign: "center", minWidth: "180px" }}>
                              <div
                                style={{
                                  fontWeight: "700",
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                }}
                              >
                                {hope.name}
                              </div>
                              <div style={{ fontSize: "12px" }}>{hope.position}</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", minWidth: "180px" }}>
                              <div
                                style={{
                                  borderBottom: "1px solid #000",
                                  width: "180px",
                                  marginBottom: "2px",
                                }}
                              ></div>
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

        {/* Right Side: 3-Panel Architecture Sidebar */}
        <div ref={rightPanelRef} className="no-print w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-3 shrink-0">
            <h2 className="text-base font-bold text-slate-900">Abstract Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the document is finalized."
                : !data.bacResNo
                ? "Edit the details for the Abstract."
                : "Update the details and signatories for the Abstract."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-0">
            {/* VIEW 1: DOCUMENT DETAILS */}
            {panelView === "details" && (
              <div className="flex flex-col gap-3.5">
                {/* Hint banner */}
                <div className="p-3 bg-blue-50/70 border border-blue-100/90 rounded-xl text-center text-xs text-blue-900 font-medium">
                  Click a row in the document to view or edit supplier bids, or type directly in
                  the cells.
                </div>

                {/* Card 1: DOCUMENT DETAILS */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    DOCUMENT DETAILS
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-800">
                      BAC Resolution No.
                    </label>
                    <input
                      type="text"
                      value={bacResNo}
                      onChange={(e) => setBacResNo(e.target.value)}
                      disabled={isReadOnly}
                      placeholder="e.g. 2026-09-001"
                      className="form-input font-mono font-bold text-sm bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Leave blank if not yet assigned by custodian.
                    </p>
                  </div>

                  {/* Show/Hide PR Number on Document Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label
                      className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                      onClick={() => !isReadOnly && setShowPrNo(!showPrNo)}
                    >
                      Show PR Number on document
                    </label>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setShowPrNo(!showPrNo)}
                      style={{
                        width: "44px",
                        height: "24px",
                        borderRadius: "12px",
                        background: showPrNo ? "#10b981" : "#cbd5e1",
                        position: "relative",
                        border: "none",
                        cursor: isReadOnly ? "not-allowed" : "pointer",
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

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Document Date
                    </label>
                    <input
                      type="date"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Card 2: CERTIFICATION PARAGRAPH */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-500" />
                    CERTIFICATION PARAGRAPH
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Date Received
                    </label>
                    <input
                      type="date"
                      value={dateReceived}
                      onChange={(e) => setDateReceived(e.target.value)}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Date Opened / Awarded
                    </label>
                    <input
                      type="date"
                      value={dateAwarded}
                      onChange={(e) => setDateAwarded(e.target.value)}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>

                  {/* BAC Verified Leave Card */}
                  {dateAwarded && activeLeavesOnDate.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Calendar size={13} className="text-slate-500" />
                          <span>Attendance: {activeLeavesOnDate.length} on leave</span>
                        </span>
                        <button
                          type="button"
                          onClick={syncVerifiedLeaves}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> Re-sync
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 3: REQUISITIONING OFFICER */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={13} className="text-slate-500" />
                    REQUISITIONING OFFICER
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Officer Name
                    </label>
                    <input
                      type="text"
                      value={reqOfficerName}
                      onChange={(e) => setReqOfficerName(e.target.value)}
                      disabled={isReadOnly}
                      className="form-input uppercase"
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </div>
                </div>

                {/* Card 4: SIGNATORIES */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={13} className="text-slate-500" />
                      SIGNATORIES
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllSigs(!showAllSigs);
                        setEditingSigId(null);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      {showAllSigs ? "Hide list" : "Manage list"}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {allSignatories
                      .filter((s: any) => {
                        if (editingSigId) return s.id === editingSigId;
                        if (showAllSigs) return s.isActive;
                        return selectedSigIds.includes(s.id);
                      })
                      .map((sig: any) => {
                        const isSelected = selectedSigIds.includes(sig.id);
                        const isEditing = editingSigId === sig.id;
                        const override = sigOverrides[sig.id] || {
                          name: sig.name,
                          position: sig.position,
                          label: getRoleLabel(sig.role),
                          annotation: undefined,
                        };
                        const effectiveAnnotation = getSignatoryAnnotation({
                          ...sig,
                          ...override,
                        });

                        return (
                          <div
                            key={sig.id}
                            className={`p-2.5 rounded-xl border transition-colors ${
                              isSelected
                                ? "bg-slate-50/80 border-slate-200"
                                : "bg-white border-dashed border-slate-200 opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {showAllSigs && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isReadOnly}
                                  onChange={(e) => {
                                    setSelectedSigIds((ids) =>
                                      e.target.checked
                                        ? [...ids, sig.id]
                                        : ids.filter((id) => id !== sig.id)
                                    );
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {override.name}
                                  {effectiveAnnotation && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      {effectiveAnnotation}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {override.position} · {override.label}
                                </div>
                              </div>
                              {isSelected && !isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => setEditingSigId(isEditing ? null : sig.id)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                  title="Edit details"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}
                            </div>

                            {isSelected && isEditing && (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Name
                                  </label>
                                  <input
                                    type="text"
                                    value={override.name}
                                    onChange={(e) =>
                                      setSigOverrides((prev) => ({
                                        ...prev,
                                        [sig.id]: {
                                          ...prev[sig.id],
                                          name: e.target.value,
                                        },
                                      }))
                                    }
                                    className="form-input text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Position
                                  </label>
                                  <input
                                    type="text"
                                    value={override.position}
                                    onChange={(e) =>
                                      setSigOverrides((prev) => ({
                                        ...prev,
                                        [sig.id]: {
                                          ...prev[sig.id],
                                          position: e.target.value,
                                        },
                                      }))
                                    }
                                    className="form-input text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Annotation
                                  </label>
                                  <select
                                    value={
                                      override.annotation !== undefined
                                        ? override.annotation
                                        : ""
                                    }
                                    onChange={(e) =>
                                      setSigOverrides((prev) => ({
                                        ...prev,
                                        [sig.id]: {
                                          ...prev[sig.id],
                                          annotation: e.target.value,
                                        },
                                      }))
                                    }
                                    className="form-input text-xs"
                                  >
                                    <option value="">None (Physical Signature)</option>
                                    <option value="(ON LEAVE)">(ON LEAVE)</option>
                                    <option value="(EXCUSED)">(EXCUSED)</option>
                                    <option value="(OFFICIAL BUSINESS)">(OFFICIAL BUSINESS)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: ITEM EDITOR */}
            {panelView === "item" && activeMain && (
              <div className="flex flex-col gap-3.5">
                {/* Top subheader bar */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPanelView("details");
                      setActiveItemIndex(null);
                      setActiveSpecIndex(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={14} /> Details
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Item {activeMain.mainIndex + 1} of {mainItems.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={activeMain.mainIndex <= 0}
                        onClick={() => {
                          const prev = mainItems[activeMain.mainIndex - 1];
                          if (prev) {
                            setActiveItemIndex(prev.rawIndex);
                            setActiveSpecIndex(null);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={activeMain.mainIndex >= mainItems.length - 1}
                        onClick={() => {
                          const next = mainItems[activeMain.mainIndex + 1];
                          if (next) {
                            setActiveItemIndex(next.rawIndex);
                            setActiveSpecIndex(null);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ITEM {activeMain.displayNo}
                </div>

                {/* Description and Quantity */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {activeMain.item.description}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Quantity: {activeMain.item.quantity} {activeMain.item.unit}
                  </p>
                </div>

                {/* Supplier Bids Card */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    SUPPLIER BIDS
                  </div>

                  <div className="space-y-2.5">
                    {displayQuotes
                      .filter((q) => q !== null)
                      .map((q: any, i: number) => {
                        const li = q?.lineItems?.find(
                          (l: any) => l.rfqLineItemId === activeMain.item.id
                        );
                        const unitPrice = li?.unitPrice || 0;
                        const qty = Number(activeMain.item.quantity) || 0;
                        const lineTotal = qty * unitPrice;

                        return (
                          <div
                            key={q.id || i}
                            className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {q.supplier?.name?.toUpperCase() || `Supplier ${i + 1}`}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                ₱{fmt2(lineTotal)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                Unit Price:
                              </label>
                              <div className="relative flex-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">
                                  ₱
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={unitPrice || ""}
                                  disabled={isReadOnly}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const num =
                                      val === "" || isNaN(Number(val)) ? 0 : Number(val);
                                    handlePriceChange(q.id, activeMain.item.id, num);
                                  }}
                                  placeholder="0.00"
                                  className="form-input text-xs pl-6 text-right w-full"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Specification Lines */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    SPECIFICATION LINES · {activeMain.specs.length}
                  </div>

                  {activeMain.specs.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeMain.specs.map((spec) => (
                        <div
                          key={spec.rawIndex}
                          className="flex items-center justify-between p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs"
                        >
                          <span className="text-slate-800 font-medium truncate pr-2">
                            {spec.item.description || "(Empty specification)"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSpecIndex(spec.rawIndex);
                              setPanelView("spec");
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No specification lines under this item.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 3: SPEC LINE EDITOR */}
            {panelView === "spec" && activeMain && activeSpec && (
              <div className="flex flex-col gap-3.5">
                {/* Top subheader bar */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPanelView("item")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={14} /> Item {activeMain.displayNo}
                  </button>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const specIdx = activeMain.specs.findIndex(
                        (s) => s.rawIndex === activeSpec.rawIndex
                      );
                      return (
                        <>
                          <span className="text-xs font-semibold text-slate-600">
                            Spec {specIdx + 1} of {activeMain.specs.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={specIdx <= 0}
                              onClick={() => {
                                const prev = activeMain.specs[specIdx - 1];
                                if (prev) setActiveSpecIndex(prev.rawIndex);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={specIdx >= activeMain.specs.length - 1}
                              onClick={() => {
                                const next = activeMain.specs[specIdx + 1];
                                if (next) setActiveSpecIndex(next.rawIndex);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    SPEC LINE
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                    Item {activeMain.displayNo} · {activeMain.item.description || "Item"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <p className="text-sm text-slate-900 leading-snug">
                    {activeSpec.item.description}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prints under the item. Specification lines have no quotation price.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Pinned Footer */}
          {panelView === "details" && (
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 font-medium">
                  {mainItems.length} {mainItems.length === 1 ? "item" : "items"}
                </span>
                <span className="text-sm font-extrabold text-blue-700">
                  {recommendedQuote ? `Lowest: ₱${fmt2(recommendedQuote.totalAmount)}` : "No bids"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                disabled={submitting}
                className="btn btn-primary px-6 py-2 rounded-xl text-sm font-semibold shadow-xs"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {panelView === "item" && activeMain && (
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setPanelView("details");
                  setActiveItemIndex(null);
                  setActiveSpecIndex(null);
                }}
                className="btn btn-primary px-6 py-2 rounded-xl text-sm font-semibold shadow-xs"
              >
                Done
              </button>
            </div>
          )}

          {panelView === "spec" && (
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPanelView("item")}
                className="btn btn-primary px-6 py-2 rounded-xl text-sm font-semibold shadow-xs"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={handleSaveConfirm}
        title="Confirm Save"
        message="Are you sure you want to save these changes to the Abstract of Canvass?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document is finalized. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        requirePassword={true}
        isDestructive={true}
      />
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
