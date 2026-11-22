"use client";
import LoaderWave from "@/components/ui/loader-wave";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Printer,
  Save,
  ArrowLeft,
  Loader2,
  ZoomIn,
  ZoomOut,
  Minus,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import ConfirmModal from "@/components/ui/confirm-modal";
import {
  AcceptanceExcelTableGrid,
  AcceptanceLineItemData,
} from "@/components/documents/acceptance-excel-table-grid";

interface AcceptanceFormValues {
  airNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dateReceived: string;
  dateInspected: string;
  lineItems: AcceptanceLineItemData[];
}

interface MainItemRef {
  rawIndex: number;
  mainIndex: number;
  displayNo: number;
  item: AcceptanceLineItemData;
  specs: { rawIndex: number; item: AcceptanceLineItemData }[];
}

export default function AcceptanceEditor() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id as string;

  const [acceptance, setAcceptance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [targetRows, setTargetRows] = useState(25);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [showAirNo, setShowAirNo] = useState(true);
  const [showPoNo, setShowPoNo] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);

  // 3-Panel Right Sidebar state
  const [panelView, setPanelView] = useState<"details" | "item" | "spec">("details");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);

  // Global Escape and click-outside listeners to unselect cell highlights
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

      // If clicking outside the grid table, clear cell highlight and reset to details
      if (gridWrapperRef.current && !gridWrapperRef.current.contains(target)) {
        setActiveItemIndex(null);
        setActiveSpecIndex(null);
        setPanelView("details");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("mousedown", handleGlobalMouseDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("mousedown", handleGlobalMouseDown);
    };
  }, []);

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

  const { register, handleSubmit, control, reset, watch, setValue } =
    useForm<AcceptanceFormValues>();
  useFieldArray({
    control,
    name: "lineItems",
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
      if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
      if (data.lastSavedBy) setLastSavedBy(data.lastSavedBy);

      reset({
        airNumber: data.airNumber || data.AIRNumber || "",
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate
          ? new Date(data.invoiceDate).toISOString().split("T")[0]
          : "",
        dateReceived: data.dateReceived
          ? new Date(data.dateReceived).toISOString().split("T")[0]
          : "",
        dateInspected: data.dateInspected
          ? new Date(data.dateInspected).toISOString().split("T")[0]
          : "",
        lineItems: (data.lineItems || []).map((item: any) => {
          let previouslyDelivered = 0;
          if (data.po?.acceptances) {
            const otherAcceptances = data.po.acceptances.filter(
              (a: any) => a.id !== data.id && a.status !== "DRAFT"
            );
            for (const oa of otherAcceptances) {
              const match = oa.lineItems.find(
                (oli: any) => oli.poLineItemId === item.poLineItemId
              );
              if (match) previouslyDelivered += match.quantityDelivered;
            }
          }

          return {
            id: item.id,
            description: item.poLineItem?.description || "",
            unit: item.poLineItem?.unit || "Unit",
            unitPrice: item.poLineItem?.unitPrice || 0,
            poQuantity: item.poLineItem?.quantity || 0,
            quantityDelivered: item.quantityDelivered || 0,
            previouslyDelivered,
            propertyNo: item.poLineItem?.propertyNo || "",
          };
        }),
      });
      setLoading(false);
    } catch (e) {
      toast.error("Failed to load acceptance report");
      setLoading(false);
    }
  };

  // Group line items into Main items and nested specification lines
  const rawLineItems: AcceptanceLineItemData[] = watchAll.lineItems || [];

  const mainItems: MainItemRef[] = useMemo(() => {
    const list: MainItemRef[] = [];
    let currentMain: MainItemRef | null = null;
    let mainCounter = 0;

    rawLineItems.forEach((it, idx) => {
      const isBlank =
        !it.description?.trim() &&
        (it.poQuantity === 0 || it.poQuantity === null || it.poQuantity === undefined);

      if (isBlank) return;

      const isMain =
        it.poQuantity !== undefined && it.poQuantity !== null && Number(it.poQuantity) > 0;

      if (isMain) {
        mainCounter++;
        currentMain = {
          rawIndex: idx,
          mainIndex: list.length,
          displayNo: mainCounter,
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
        mainCounter++;
        currentMain = {
          rawIndex: idx,
          mainIndex: list.length,
          displayNo: mainCounter,
          item: it,
          specs: [],
        };
        list.push(currentMain);
      }
    });

    return list;
  }, [rawLineItems]);

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

  const handleLineItemsChange = (newItems: AcceptanceLineItemData[]) => {
    setValue("lineItems", newItems, { shouldDirty: true, shouldValidate: true });
  };

  const updateItemAt = (index: number, updates: Partial<AcceptanceLineItemData>) => {
    const current = [...(watchAll.lineItems || [])];
    if (!current[index]) return;
    current[index] = { ...current[index], ...updates };
    setValue("lineItems", current, { shouldDirty: true, shouldValidate: true });
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    const items = watchAll.lineItems || [];
    const item = items[index];
    if (!item) {
      setActiveItemIndex(null);
      setActiveSpecIndex(null);
      setPanelView("details");
      return;
    }

    const isSpec = !item.poQuantity || Number(item.poQuantity) === 0;
    if (isSpec) {
      let parentRawIdx = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (items[i]?.poQuantity && Number(items[i].poQuantity) > 0) {
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

  const onSubmit = async (data: AcceptanceFormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/acceptances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save");
      }
      toast.success("Acceptance report saved successfully");
      fetchAcceptance();
      setLastSaved(new Date());
      if (session?.user?.name) setLastSavedBy(session.user.name);
      setIsUnlocked(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/acceptances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked as ${status}`);
      fetchAcceptance();
      setLastSaved(new Date());
      if (session?.user?.name) setLastSavedBy(session.user.name);
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const handleSaveConfirm = () => {
    setSaveModalOpen(false);
    handleSubmit(onSubmit)();
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

  if (loading) return <LoaderWave variant="page" label="Loading acceptance..." />;
  if (!acceptance) return <div className="p-8 text-center text-slate-500">Report not found</div>;

  const isReadOnly = acceptance.status !== "DRAFT" && !isUnlocked;

  // Computations for preview
  const totalAmount = (watchAll.lineItems || []).reduce(
    (sum, item) => sum + item.quantityDelivered * item.unitPrice,
    0
  );

  let isComplete = true;
  for (const item of watchAll.lineItems || []) {
    if (item.poQuantity > 0 && item.quantityDelivered < item.poQuantity) {
      isComplete = false;
      break;
    }
  }

  const deliveredItemsCount = (watchAll.lineItems || []).filter(
    (i) => i.poQuantity > 0 && i.quantityDelivered > 0
  ).length;

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
              href={`/acceptances/hub/${acceptance.po?.id}`}
              aria-label="Back to Delivery Hub"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Delivery Hub
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {watchAll.airNumber?.trim()
                ? `AIR: ${watchAll.airNumber.trim()}`
                : acceptance.airNumber?.trim() || acceptance.AIRNumber?.trim()
                ? `AIR: ${(acceptance.airNumber || acceptance.AIRNumber).trim()}`
                : "Acceptance & Inspection"}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  {acceptance.status || "FINAL"}
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
                  {acceptance.status || "DRAFT"}
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
          {acceptance.po?.id && (
            <Link
              href={`/acceptances/hub/${acceptance.po.id}`}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package size={17} className="text-emerald-600" />
              <span>Delivery Hub</span>
            </Link>
          )}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {acceptance.status !== "DRAFT" && (
            <button
              type="button"
              onClick={() => (isUnlocked ? setIsUnlocked(false) : setUnlockModalOpen(true))}
              className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {isUnlocked ? (
                <>
                  <Lock size={16} /> Lock
                </>
              ) : (
                <>
                  <Unlock size={16} /> Unlock
                </>
              )}
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

          {(!isReadOnly || isUnlocked) && (
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              disabled={submitting}
              className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{" "}
              {isUnlocked ? "Save Changes" : "Save"}
            </button>
          )}

          {acceptance.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => updateStatus("ISSUED")}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{" "}
              Finalize
            </button>
          )}
        </div>
      </div>

      {/* Lock Banner when finalized */}
      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This Acceptance & Inspection Report is finalized and locked.</strong>{" "}
            Unlock it to make changes.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-w-0 max-w-full w-full gap-4 overflow-hidden relative print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!w-full">
        {/* Left Side: Live Print Preview */}
        <div className="flex-1 w-0 min-w-0 max-w-full rounded-2xl bg-[#d8e1eb] overflow-hidden relative flex flex-col shadow-inner print:rounded-none print:!bg-white print:!overflow-visible print:!shadow-none print:!block print:!w-full print:!m-0 print:!p-0">
          {/* View Controls */}
          <div className="no-print absolute bottom-6 left-6 flex items-center gap-1 bg-white p-1 rounded-full shadow-md border border-slate-200 z-10 text-slate-600">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
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
              onClick={() => setTargetRows((r) => Math.min(r + 1, 40))}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Add Row"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="air-zoom-wrapper origin-top print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(980 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "980px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div
                    className="print-area shadow-xl text-[14px] leading-tight print:shadow-none print:max-w-none print:m-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_th]:!font-['Times_New_Roman',_Times,_serif]"
                    style={{
                      width: "980px",
                      minHeight: "1123px",
                      background: "white",
                      padding: "3rem",
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                  >
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
                          <div className="flex font-bold">
                            <span className="w-44">Supplier :</span>{" "}
                            <span className="flex-1 border-b border-black">
                              {acceptance.po?.supplier?.name}
                            </span>
                          </div>
                          <div className="flex font-bold">
                            <span className="w-44">
                              {acceptance.po?.orderType === "JOB" ||
                              acceptance.po?.pr?.requestType === "JOB" ||
                              acceptance.po?.abstract?.rfq?.pr?.requestType === "JOB"
                                ? "JO No. /Date:"
                                : "PO No. /Date:"}
                            </span>{" "}
                            <span className="flex-1 border-b border-black">
                              {showPoNo ? acceptance.po?.poNumber || "" : ""}
                              {showPoNo && acceptance.po?.createdAt
                                ? ` / ${new Date(acceptance.po.createdAt).toLocaleDateString()}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex font-bold">
                            <span className="w-44">Req. Office/Department:</span>{" "}
                            <span className="flex-1 border-b border-black ">
                              {acceptance.po?.abstract?.rfq?.pr?.office?.name ||
                                acceptance.po?.pr?.office?.name ||
                                ""}
                            </span>
                          </div>
                        </div>
                        <div className="w-2/5 p-2 flex flex-col gap-1 justify-center">
                          <div className="flex font-bold">
                            <span className="w-28">AIR No. :</span>{" "}
                            <span className="flex-1 border-b border-black">
                              {showAirNo
                                ? watchAll.airNumber ||
                                  acceptance.airNumber ||
                                  acceptance.AIRNumber ||
                                  ""
                                : ""}
                            </span>
                          </div>
                          <div className="flex font-bold">
                            <span className="w-28">Date :</span>{" "}
                            <span className="flex-1 border-b border-black"></span>
                          </div>
                          <div className="flex font-bold">
                            <span className="w-28">Invoice No. :</span>{" "}
                            <span className="flex-1 border-b border-black">
                              {watchAll.invoiceNumber}
                            </span>
                          </div>
                          <div className="flex font-bold">
                            <span className="w-28">Date :</span>{" "}
                            <span className="flex-1 border-b border-black">
                              {watchAll.invoiceDate
                                ? new Date(watchAll.invoiceDate).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Excel Grid Table */}
                      <div ref={gridWrapperRef}>
                        <AcceptanceExcelTableGrid
                          items={watchAll.lineItems || []}
                          targetRows={targetRows}
                          isReadOnly={isReadOnly}
                          totalAmount={totalAmount}
                          onChange={handleLineItemsChange}
                          onRowSelect={handleRowClick}
                          activeItemIndex={
                            activeSpecIndex !== null ? activeSpecIndex : activeItemIndex
                          }
                          onDeselect={() => {
                            setActiveItemIndex(null);
                            setActiveSpecIndex(null);
                            setPanelView("details");
                          }}
                        />
                      </div>

                      <div className="flex border-t-2 border-black">
                        <div
                          className="w-[45%] border-r-2 border-black flex flex-col h-full"
                          style={{ minHeight: "260px" }}
                        >
                          <div className="text-center font-bold py-2 border-b-2 border-black">
                            ACCEPTANCE
                          </div>
                          <div className="flex flex-col flex-1 p-4">
                            <div className="h-[70px]">
                              <div className="flex mb-3">
                                <span className="font-bold w-28 whitespace-nowrap mr-2">
                                  Date Received:
                                </span>
                                <span className="w-48 border-b border-black text-center">
                                  {watchAll.dateReceived
                                    ? new Date(watchAll.dateReceived).toLocaleDateString()
                                    : ""}
                                </span>
                              </div>

                              <div className="pl-6">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-4 h-4 border border-black flex items-center justify-center font-bold text-xs">
                                    {isComplete ? "/" : ""}
                                  </div>
                                  <span>Complete</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 border border-black flex items-center justify-center font-bold text-xs">
                                    {!isComplete ? "/" : ""}
                                  </div>
                                  <span>Partial (pls. Specify)</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 flex mt-6">
                              <div className="w-1/2 flex items-center">
                                <span className="text-sm">Received By:</span>
                              </div>
                              <div className="w-1/2 flex flex-col justify-between text-center">
                                <div className="flex flex-col items-center">
                                  <div className="font-bold underline uppercase whitespace-nowrap">
                                    HON. TOMAS U. ESTOPEREZ JR.
                                  </div>
                                  <div className="text-[10px] mt-1">Requisitioning Officer</div>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="font-bold underline uppercase whitespace-nowrap">
                                    FLORIME Y. OLANDRES
                                  </div>
                                  <div className="text-[10px] mt-1">Requisitioning Officer</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className="w-[55%] flex flex-col h-full"
                          style={{ minHeight: "260px" }}
                        >
                          <div className="text-center font-bold py-2 border-b-2 border-black">
                            INSPECTION
                          </div>
                          <div className="flex flex-col flex-1 p-4">
                            <div className="h-[70px]">
                              <div className="flex mb-3">
                                <span className="font-bold w-28 whitespace-nowrap mr-2">
                                  Date Inspected:
                                </span>
                                <span className="w-48 border-b border-black text-center">
                                  {watchAll.dateInspected
                                    ? new Date(watchAll.dateInspected).toLocaleDateString()
                                    : ""}
                                </span>
                              </div>

                              <div className="pl-6 flex gap-2">
                                <div className="w-4 h-4 border border-black flex flex-shrink-0 items-center justify-center font-bold text-xs mt-1">
                                  /
                                </div>
                                <div className="leading-tight">
                                  Inspected, verified and found <span className="font-bold">OK</span>
                                  <br />
                                  as to quantity and specifications
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-between text-center mt-6">
                              <div className="flex justify-between gap-2 items-start">
                                <div className="flex-1">
                                  <div className="font-bold underline uppercase whitespace-normal leading-tight">
                                    EDSEL J. AMBUBUYOG
                                  </div>
                                  <div className="text-[10px] leading-tight mt-1">
                                    Chairman, Committee on
                                    <br />
                                    Inspection/Acting Mun. Treasurer
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold underline uppercase whitespace-normal leading-tight">
                                    HON. TOMAS U.
                                    <br />
                                    ESTOPEREZ JR.
                                  </div>
                                  <div className="text-[10px] leading-tight mt-1">
                                    Requisitioning Officer
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between gap-2 items-start">
                                <div className="flex-1">
                                  <div className="font-bold underline uppercase whitespace-nowrap">
                                    CARLOS O. SUAN JR.
                                  </div>
                                  <div className="text-[10px] leading-tight mt-1">Member/ PDO II</div>
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold underline uppercase whitespace-nowrap">
                                    RUEL E. CASIDSID
                                  </div>
                                  <div className="text-[10px] leading-tight mt-1">
                                    Member/Draftsman III
                                  </div>
                                </div>
                              </div>
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
            </div>

            {/* Guaranteed scroll spacer */}
            <div
              style={{ height: "80px", minHeight: "80px", width: "100%", flexShrink: 0 }}
              className="no-print pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Right Side: 3-Panel Right Sidebar */}
        <div
          ref={rightPanelRef}
          className="no-print w-[360px] lg:w-[400px] xl:w-[440px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden"
        >
          {/* Scrollable Panel Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* VIEW 1: DOCUMENT DETAILS */}
            {panelView === "details" && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="mb-2">
                  <h2 className="text-base font-bold text-slate-900">Acceptance Details</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {isReadOnly
                      ? "Read-only while the report is finalized."
                      : "Update the details and delivered quantities."}
                  </p>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900">
                  Click a row in the document to edit it, or enter delivered quantities directly in the
                  cells.
                </div>

                {/* Document Numbering */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800">AIR Number</label>
                    </div>
                    <input
                      type="text"
                      {...register("airNumber")}
                      disabled={isReadOnly}
                      placeholder="e.g. 26-01-001"
                      className="form-input font-mono font-bold text-sm bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Leave blank if not yet assigned by custodian. Can be updated at any time.
                    </p>
                  </div>

                  {/* Show/Hide AIR Number on Document Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label
                      className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                      onClick={() => setShowAirNo(!showAirNo)}
                    >
                      Print AIR Number on document
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAirNo(!showAirNo)}
                      style={{
                        width: "44px",
                        height: "24px",
                        borderRadius: "12px",
                        background: showAirNo ? "#10b981" : "#cbd5e1",
                        position: "relative",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.3s",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                      }}
                      title={showAirNo ? "Hide from document" : "Show on document"}
                    >
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "2px",
                          left: showAirNo ? "22px" : "2px",
                          transition: "left 0.3s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </button>
                  </div>

                  {/* Show/Hide PO/JO Number on Document Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label
                      className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                      onClick={() => setShowPoNo(!showPoNo)}
                    >
                      Print{" "}
                      {acceptance.po?.orderType === "JOB" ||
                      acceptance.po?.pr?.requestType === "JOB" ||
                      acceptance.po?.abstract?.rfq?.pr?.requestType === "JOB"
                        ? "JO Number"
                        : "PO Number"}{" "}
                      on document
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Invoice No.</label>
                    <input
                      type="text"
                      {...register("invoiceNumber")}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Invoice Date</label>
                    <input
                      type="date"
                      {...register("invoiceDate")}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Date Received</label>
                    <input
                      type="date"
                      {...register("dateReceived")}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Date Inspected</label>
                    <input
                      type="date"
                      {...register("dateInspected")}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Delivery Summary Status */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Delivery Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${
                        isComplete
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isComplete ? "Complete Delivery" : "Partial Delivery"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Delivered Items:</span>
                    <span className="font-semibold text-slate-800">
                      {deliveredItemsCount} of {mainItems.length} items
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Details save automatically with the document.</span>
                </div>
              </form>
            )}

            {/* VIEW 2: ITEM EDITOR */}
            {panelView === "item" && activeMain && (
              <div className="space-y-4">
                {/* Navigation Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPanelView("details");
                      setActiveItemIndex(null);
                      setActiveSpecIndex(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    <span>Details</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">
                      Item {activeMain.mainIndex + 1} of {mainItems.length}
                    </span>
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
                      className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Previous Item"
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
                      className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Next Item"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Header */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    EDITING ITEM {activeMain.mainIndex + 1}
                  </h3>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description</label>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed">
                    {activeMain.item.description}
                  </div>
                </div>

                {/* PO Order Info */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Unit:</span>
                    <span className="font-semibold text-slate-800">{activeMain.item.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ordered in PO:</span>
                    <span className="font-bold text-slate-900">{activeMain.item.poQuantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Previously Delivered:</span>
                    <span className="font-semibold text-orange-600">
                      {activeMain.item.previouslyDelivered || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-bold">
                    <span className="text-slate-700">Remaining to Deliver:</span>
                    <span className="text-blue-700">
                      {Math.max(
                        0,
                        activeMain.item.poQuantity - (activeMain.item.previouslyDelivered || 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Quantity Delivered input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label mb-0">Delivered in this Report</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = Math.max(
                            0,
                            activeMain.item.poQuantity - (activeMain.item.previouslyDelivered || 0)
                          );
                          updateItemAt(activeMain.rawIndex, { quantityDelivered: remaining });
                        }}
                        disabled={isReadOnly}
                        className="text-[11px] px-2 py-0.5 rounded font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Deliver All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateItemAt(activeMain.rawIndex, { quantityDelivered: 0 })
                        }
                        disabled={isReadOnly}
                        className="text-[11px] px-2 py-0.5 rounded font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        Reset 0
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={Math.max(
                      0,
                      activeMain.item.poQuantity - (activeMain.item.previouslyDelivered || 0)
                    )}
                    value={activeMain.item.quantityDelivered}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                      const remaining = Math.max(
                        0,
                        activeMain.item.poQuantity - (activeMain.item.previouslyDelivered || 0)
                      );
                      const clamped = Math.max(0, Math.min(val, remaining > 0 ? remaining : val));
                      updateItemAt(activeMain.rawIndex, { quantityDelivered: clamped });
                    }}
                    className="form-input text-sm font-bold text-slate-900"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Delivered Line Total */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Line Delivered Total:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ₱
                    {formatCurrency(
                      activeMain.item.quantityDelivered * (activeMain.item.unitPrice || 0)
                    ).replace("₱", "")}
                  </span>
                </div>

                {/* Specification Lines section */}
                {activeMain.specs.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-800">
                      SPECIFICATION LINES · {activeMain.specs.length}
                    </label>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {activeMain.specs.map((sp, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <span className="truncate pr-2 font-medium text-slate-700">
                            {sp.item.description || (
                              <em className="text-slate-400">Empty specification</em>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSpecIndex(sp.rawIndex);
                              setPanelView("spec");
                            }}
                            className="text-blue-600 font-semibold hover:underline shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: SPEC LINE VIEWER */}
            {panelView === "spec" && activeSpec && (
              <div className="space-y-4">
                {/* Navigation Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPanelView("item")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    <span>Item {activeMain ? activeMain.mainIndex + 1 : ""}</span>
                  </button>
                  {activeMain && activeMain.specs.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">
                        Spec{" "}
                        {activeMain.specs.findIndex((s) => s.rawIndex === activeSpec.rawIndex) + 1}{" "}
                        of {activeMain.specs.length}
                      </span>
                      <button
                        type="button"
                        disabled={
                          activeMain.specs.findIndex((s) => s.rawIndex === activeSpec.rawIndex) <= 0
                        }
                        onClick={() => {
                          const currIdx = activeMain.specs.findIndex(
                            (s) => s.rawIndex === activeSpec.rawIndex
                          );
                          if (currIdx > 0) {
                            setActiveSpecIndex(activeMain.specs[currIdx - 1].rawIndex);
                          }
                        }}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Previous Spec"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={
                          activeMain.specs.findIndex((s) => s.rawIndex === activeSpec.rawIndex) >=
                          activeMain.specs.length - 1
                        }
                        onClick={() => {
                          const currIdx = activeMain.specs.findIndex(
                            (s) => s.rawIndex === activeSpec.rawIndex
                          );
                          if (currIdx < activeMain.specs.length - 1) {
                            setActiveSpecIndex(activeMain.specs[currIdx + 1].rawIndex);
                          }
                        }}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Next Spec"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Header */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    SPEC LINE
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                    Item {activeMain ? activeMain.mainIndex + 1 : ""} ·{" "}
                    {activeMain?.item.description || "Untitled item"}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description</label>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {activeSpec.item.description}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prints under the item. Spec lines have no price or quantity.
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
                  {deliveredItemsCount} of {mainItems.length} delivered
                </span>
                <span className="text-sm font-extrabold text-blue-700">
                  Total: {formatCurrency(totalAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                disabled={submitting || isReadOnly}
                className="btn btn-primary px-6 py-2 rounded-xl text-sm font-semibold shadow-xs"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {panelView === "item" && activeMain && (
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-between">
              <button
                type="button"
                onClick={() => updateItemAt(activeMain.rawIndex, { quantityDelivered: 0 })}
                disabled={isReadOnly}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Reset Qty
              </button>
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
        message="Are you sure you want to save these changes to the acceptance report?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document has been issued. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        requirePassword={true}
        isDestructive={true}
      />
    </div>
  );
}
