"use client";

import LoaderWave from "@/components/ui/loader-wave";
import CustomSelect from "@/components/ui/custom-select";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import {
  Printer,
  Save,
  ArrowLeft,
  Loader2,
  ZoomIn,
  ZoomOut,
  Send,
  Lock,
  Unlock,
  Minus,
  Plus,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import ConfirmModal from "@/components/ui/confirm-modal";
import { EditablePreviewInput } from "@/components/documents/editable-preview-input";
import { RfqExcelTableGrid, RfqLineItem } from "@/components/documents/rfq-excel-table-grid";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";
import { handleTextFormattingKeyDown } from "@/lib/format-text-helpers";

interface MainItemRef {
  rawIndex: number;
  mainIndex: number;
  displayNo: number;
  item: RfqLineItem;
  specs: { rawIndex: number; item: RfqLineItem }[];
}

export default function RfqLivePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rfq, setRfq] = useState<any>(null);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [targetRows, setTargetRows] = useState(8);
  const [showRfqNo, setShowRfqNo] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // 3-Panel Right Sidebar state
  const [panelView, setPanelView] = useState<"details" | "item" | "spec">("details");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);

  // Live Sheet Direct Editing States (Excel-like Sheet Inputs)
  const [company, setCompany] = useState<string>("");
  const [companyAddress, setCompanyAddress] = useState<string>("");
  const [projectRefNo, setProjectRefNo] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [projectLocation, setProjectLocation] = useState<string>("");
  const [deliveryPeriod, setDeliveryPeriod] = useState<string>("");
  const [supplierContactPerson, setSupplierContactPerson] = useState<string>("");
  const [supplierContactNo, setSupplierContactNo] = useState<string>("");

  // Line item deletion tracking
  const [deletedLineItemIds, setDeletedLineItemIds] = useState<string[]>([]);

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);

  // Global Escape key and click-outside listeners to unselect cell
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

      // Check if click was inside table grid
      const isInsideGrid = gridWrapperRef.current?.contains(target);
      if (!isInsideGrid) {
        setActiveItemIndex(null);
        setActiveSpecIndex(null);
        setPanelView("details");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("mousedown", handleGlobalMouseDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener("mousedown", handleGlobalMouseDown);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      rfqNumber: "",
      signatoryId: "",
      deadline: "",
    },
  });

  const watchRfqNumber = watch("rfqNumber");
  const watchSignatoryId = watch("signatoryId");
  const watchDeadline = watch("deadline");

  const selectedSignatory =
    signatories.find((s) => s.id === watchSignatoryId) ||
    rfq?.signatory ||
    signatories.find((s) => s.name?.toUpperCase().includes("JEFFY"));

  useEffect(() => {
    async function loadData() {
      try {
        const [rfqRes, sigRes] = await Promise.all([
          fetch(`/api/rfqs/${params.id}`),
          fetch("/api/signatories"),
        ]);

        let loadedSignatories: any[] = [];
        if (sigRes.ok) {
          loadedSignatories = await sigRes.json();
          setSignatories(loadedSignatories);
        }

        if (rfqRes.ok) {
          const data = await rfqRes.json();
          setRfq(data);
          if (data.updatedAt) {
            setLastSaved(new Date(data.updatedAt));
          } else if (data.createdAt) {
            setLastSaved(new Date(data.createdAt));
          } else {
            setLastSaved(new Date());
          }
          if (data.lastSavedBy) {
            setLastSavedBy(data.lastSavedBy);
          }

          const defaultSig = loadedSignatories.find((s) =>
            s.name?.toUpperCase().includes("JEFFY")
          );
          const activeSigId = data.signatoryId || (defaultSig ? defaultSig.id : "");

          reset({
            rfqNumber: data.rfqNumber || "",
            signatoryId: activeSigId,
            deadline: data.deadline ? data.deadline.substring(0, 10) : "",
          });
        }
      } catch (err) {
        toast.error("Failed to load RFQ");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, reset]);

  // Group line items into Main items and nested specification lines
  const rawLineItems: RfqLineItem[] = rfq?.lineItems || [];

  const mainItems: MainItemRef[] = useMemo(() => {
    const list: MainItemRef[] = [];
    let currentMain: MainItemRef | null = null;
    let mainCounter = 0;

    rawLineItems.forEach((it, idx) => {
      const isBlank =
        !it.description?.trim() &&
        (it.quantity === "" || it.quantity === 0 || it.quantity === null || it.quantity === undefined);

      if (isBlank) return;

      const isMain = it.quantity !== "" && Number(it.quantity) > 0;

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

  const handleLineItemsChange = (newItems: RfqLineItem[]) => {
    setRfq((prev: any) => {
      if (!prev) return prev;
      return { ...prev, lineItems: newItems };
    });
  };

  const updateItemAt = (index: number, updates: Partial<RfqLineItem>) => {
    setRfq((prev: any) => {
      if (!prev || !prev.lineItems) return prev;
      const current = [...prev.lineItems];
      if (!current[index]) return prev;
      current[index] = { ...current[index], ...updates };
      return { ...prev, lineItems: current };
    });
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    const items = rfq?.lineItems || [];
    const item = items[index];
    const isEmpty =
      !item ||
      (!item.description?.trim() &&
        (item.quantity === "" || item.quantity === 0 || item.quantity === null || item.quantity === undefined));

    if (isEmpty) {
      setActiveItemIndex(null);
      setActiveSpecIndex(null);
      setPanelView("details");
      return;
    }

    const isSpec = !item.quantity || Number(item.quantity) === 0;
    if (isSpec) {
      let parentRawIdx = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (items[i]?.quantity && Number(items[i].quantity) > 0) {
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

  const handleAddNewMainItem = () => {
    if (isReadOnly) return;
    const newItem: RfqLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
    };
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.push(newItem);
      return { ...prev, lineItems: current };
    });
    const newLen = (rfq?.lineItems?.length || 0) + 1;
    setActiveItemIndex(newLen - 1);
    setActiveSpecIndex(null);
    setPanelView("item");
  };

  const handleAddSpecLine = (main: MainItemRef) => {
    if (isReadOnly) return;
    const lastSpecRawIdx =
      main.specs.length > 0 ? main.specs[main.specs.length - 1].rawIndex : main.rawIndex;
    const insertAt = lastSpecRawIdx + 1;
    const newSpec: RfqLineItem = {
      description: "",
      unit: "",
      quantity: "",
    };
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(insertAt, 0, newSpec);
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(main.rawIndex);
    setActiveSpecIndex(insertAt);
    setPanelView("spec");
    toast.success("Specification line added");
  };

  const handleDeleteMainItem = (main: MainItemRef) => {
    if (isReadOnly) return;
    setRfq((prev: any) => {
      if (!prev || !prev.lineItems) return prev;
      const current = [...prev.lineItems];
      const countToRemove = 1 + main.specs.length;
      const removed = current.splice(main.rawIndex, countToRemove);
      const removedIds = removed.map((r: any) => r.id).filter(Boolean);
      if (removedIds.length > 0) {
        setDeletedLineItemIds((p) => [...p, ...removedIds]);
      }
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(null);
    setActiveSpecIndex(null);
    setPanelView("details");
    toast.success("Item deleted");
  };

  const handleDeleteSpecLine = (specRawIndex: number | null) => {
    if (isReadOnly || specRawIndex === null) return;
    setRfq((prev: any) => {
      if (!prev || !prev.lineItems) return prev;
      const current = [...prev.lineItems];
      const removed = current.splice(specRawIndex, 1);
      if (removed[0]?.id) {
        setDeletedLineItemIds((p) => [...p, removed[0].id]);
      }
      return { ...prev, lineItems: current };
    });
    setActiveSpecIndex(null);
    setPanelView("item");
    toast.success("Specification line deleted");
  };

  const handleInsertAboveMain = (main: MainItemRef) => {
    if (isReadOnly) return;
    const newItem: RfqLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
    };
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(main.rawIndex, 0, newItem);
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(main.rawIndex);
    setActiveSpecIndex(null);
    toast.success("Item inserted above");
  };

  const handleInsertBelowMain = (main: MainItemRef) => {
    if (isReadOnly) return;
    const insertPos = main.rawIndex + main.specs.length + 1;
    const newItem: RfqLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
    };
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(insertPos, 0, newItem);
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(insertPos);
    setActiveSpecIndex(null);
    toast.success("Item inserted below");
  };

  const handleMoveMainUp = (main: MainItemRef) => {
    if (isReadOnly || main.mainIndex <= 0) return;
    const prevMain = mainItems[main.mainIndex - 1];
    if (!prevMain) return;
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      const blockLength = 1 + main.specs.length;
      const extracted = current.splice(main.rawIndex, blockLength);
      current.splice(prevMain.rawIndex, 0, ...extracted);
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(prevMain.rawIndex);
    setActiveSpecIndex(null);
    toast.success("Moved up");
  };

  const handleMoveMainDown = (main: MainItemRef) => {
    if (isReadOnly || main.mainIndex >= mainItems.length - 1) return;
    const nextMain = mainItems[main.mainIndex + 1];
    if (!nextMain) return;
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      const blockLength = 1 + main.specs.length;
      const nextBlockLength = 1 + nextMain.specs.length;
      const extracted = current.splice(main.rawIndex, blockLength);
      current.splice(main.rawIndex + nextBlockLength, 0, ...extracted);
      return { ...prev, lineItems: current };
    });
    setActiveItemIndex(main.rawIndex + nextMain.specs.length + 1);
    setActiveSpecIndex(null);
    toast.success("Moved down");
  };

  const handleInsertSpecAbove = (specRawIndex: number) => {
    if (isReadOnly) return;
    const newSpec: RfqLineItem = {
      description: "",
      unit: "",
      quantity: "",
    };
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(specRawIndex, 0, newSpec);
      return { ...prev, lineItems: current };
    });
    setActiveSpecIndex(specRawIndex);
    toast.success("Specification line inserted above");
  };

  const handleInsertSpecBelow = (specRawIndex: number) => {
    if (isReadOnly) return;
    const newSpec: RfqLineItem = {
      description: "",
      unit: "",
      quantity: "",
    };
    const targetIndex = specRawIndex + 1;
    setRfq((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(targetIndex, 0, newSpec);
      return { ...prev, lineItems: current };
    });
    setActiveSpecIndex(targetIndex);
    toast.success("Specification line inserted below");
  };

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const payload: any = {
        rfqNumber: data.rfqNumber?.trim() || null,
        signatoryId: data.signatoryId || null,
        deadline: data.deadline || null,
      };

      if (rfq?.lineItems && Array.isArray(rfq.lineItems)) {
        payload.lineItems = rfq.lineItems.map((li: any) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
        }));
      }

      if (deletedLineItemIds.length > 0) {
        payload.deletedLineItemIds = deletedLineItemIds;
      }

      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save RFQ details");
      }

      const updated = await res.json();
      setRfq(updated);
      setDeletedLineItemIds([]);
      setLastSaved(new Date(updated.updatedAt || Date.now()));
      if (updated.lastSavedBy) {
        setLastSavedBy(updated.lastSavedBy);
      } else if (session?.user?.name) {
        setLastSavedBy(session.user.name);
      }
      toast.success("RFQ details saved successfully");
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    const currentSigId = watchSignatoryId || rfq?.signatoryId;
    if ((status === "ISSUED" || status === "COMPLETED") && !currentSigId) {
      toast.error("Please select a signatory before issuing");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { status };
      if (currentSigId) {
        payload.signatoryId = currentSigId;
      }
      if (watchRfqNumber !== undefined) {
        payload.rfqNumber = watchRfqNumber?.trim() || null;
      }
      if (watchDeadline) {
        payload.deadline = watchDeadline;
      }
      if (rfq?.lineItems && Array.isArray(rfq.lineItems)) {
        payload.lineItems = rfq.lineItems.map((li: any) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
        }));
      }

      if (deletedLineItemIds.length > 0) {
        payload.deletedLineItemIds = deletedLineItemIds;
      }

      const res = await fetch(`/api/rfqs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }

      const updated = await res.json();
      setRfq(updated);
      setDeletedLineItemIds([]);
      setLastSaved(new Date(updated.updatedAt || Date.now()));
      if (updated.lastSavedBy) {
        setLastSavedBy(updated.lastSavedBy);
      } else if (session?.user?.name) {
        setLastSavedBy(session.user.name);
      }
      toast.success(
        `RFQ ${status === "ISSUED" ? "issued" : status.toLowerCase().replace(/_/g, " ")} successfully`
      );
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockConfirm = () => {
    setIsUnlocked(true);
    setUnlockModalOpen(false);
    toast.success("Editing enabled");
  };

  const handleSaveConfirm = () => {
    setSaveModalOpen(false);
    handleSubmit(onSubmit)();
  };

  if (loading) return <LoaderWave variant="page" label="Loading RFQ..." />;
  if (!rfq) return <div>Error loading data</div>;

  const isReadOnly = rfq.status !== "DRAFT" && !isUnlocked;

  const getSavedTimeText = () => {
    if (!lastSaved) return "Saved just now";
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

  const getIssuedTimeText = () => {
    const dateStr = rfq?.updatedAt || rfq?.createdAt;
    if (!dateStr) return "Issued today · Locked for editing";
    const issuedDate = new Date(dateStr);
    const today = new Date();
    const isToday =
      issuedDate.getDate() === today.getDate() &&
      issuedDate.getMonth() === today.getMonth() &&
      issuedDate.getFullYear() === today.getFullYear();
    if (isToday) return "Issued today · Locked for editing";
    return `Issued on ${issuedDate.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    })} · Locked for editing`;
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
              href="/rfqs"
              aria-label="Back to Requests for Quotation"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Requests for Quotation
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {rfq.rfqNumber?.trim()
                ? rfq.rfqNumber.trim().toUpperCase().startsWith("RFQ")
                  ? rfq.rfqNumber.trim()
                  : `${rfq.rfqNumber.trim()}`
                : "Untitled RFQ"}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  {rfq.status}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span>{getIssuedTimeText()}</span>
                  {lastSavedBy && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-medium">
                        by <strong className="font-semibold text-slate-700">{lastSavedBy}</strong>
                      </span>
                    </>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {rfq.status || "DRAFT"}
                </span>
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
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Abstract Hub Button */}
          <Link
            href={rfq.abstract ? `/abstract/${rfq.abstract.id}` : `/abstract`}
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
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
              </button>
              {rfq.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => updateStatus("ISSUED")}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Issue
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lock Banner when issued */}
      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This RFQ is issued and locked.</strong> Unlock it to make changes. Unlocking returns it to Draft.
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
              onClick={() => setTargetRows((r) => r + 1)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Add Row"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="shrink-0 print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(890 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "890px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area rfq-print-sheet text-black w-[890px] bg-white shadow-xl min-h-[1123px] p-10 pb-16 print:shadow-none print:!w-[890px] print:!min-w-[890px] print:!max-w-[890px] print:!p-10 print:!mx-auto print:!my-0 print:min-h-0 font-sans text-[11px]">
                    {/* Header Layout per Template */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold italic text-[12px]">LGU of PANDAN, ANTIQUE</div>
                      <div className="w-[290px] mr-[16%]">
                        <div className="flex mt-4 mb-1 items-end">
                          <span className="shrink-0 italic">Project Reference Number</span>
                          <EditablePreviewInput
                            value={projectRefNo}
                            onChange={setProjectRefNo}
                            disabled={isReadOnly}
                            className="flex-1 text-[11px] ml-1 h-[17px] py-0 px-0.5"
                          />
                        </div>
                        <div className="flex mb-1 items-end">
                          <span className="shrink-0 italic">Name of the Project</span>
                          <EditablePreviewInput
                            value={projectName}
                            onChange={setProjectName}
                            disabled={isReadOnly}
                            className="flex-1 text-[11px] ml-1 h-[17px] py-0 px-0.5"
                          />
                        </div>
                        <div className="flex mb-1 items-end">
                          <span className="shrink-0 italic">Location of the Project</span>
                          <EditablePreviewInput
                            value={projectLocation}
                            onChange={setProjectLocation}
                            disabled={isReadOnly}
                            className="flex-1 text-[11px] ml-1 h-[17px] py-0 px-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div>Standard Form Number: SF-GOOD-60</div>
                      <div>Revised on: May 24, 2004</div>
                      <h2 className="text-[25px]">
                        Standard Form Title:{" "}
                        <span className="font-bold text-[25px] italic">REQUEST FOR QUOTATION</span>
                      </h2>
                    </div>

                    <div className="flex justify-end mb-4 text-[13px] mr-[16%]">
                      <div className="w-[290px]">
                        <div className="flex mb-1">
                          <span className="w-20">Date:</span>
                          <span className="border-b border-black flex-1 text-center"></span>
                        </div>
                        <div className="flex mb-1">
                          <span className="w-20">Quotation:</span>
                          <EditablePreviewInput
                            value={showRfqNo ? watchRfqNumber || rfq.rfqNumber || "" : ""}
                            onChange={(val) =>
                              setValue("rfqNumber", val, { shouldValidate: true, shouldDirty: true })
                            }
                            disabled={isReadOnly}
                            align="center"
                            className="flex-1 font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 text-[13px]">
                      <div className="flex mb-1 w-[400px]">
                        <span className="w-16">Company</span>
                        <EditablePreviewInput
                          value={company}
                          onChange={setCompany}
                          disabled={isReadOnly}
                          className="flex-1 uppercase font-bold"
                        />
                      </div>
                      <div className="flex mb-1 w-[400px]">
                        <span className="w-16">Address</span>
                        <EditablePreviewInput
                          value={companyAddress}
                          onChange={setCompanyAddress}
                          disabled={isReadOnly}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="mb-8 indent-[42px] text-[13px]">
                      Please quote your lowest price on the item(s) listed below, subject to the
                      General Conditions <br />
                      on the last page, stating the shortest time of the delivery and submit your
                      quotation duly signed by your <br />
                      representative not later than{" "}
                      <span className="font-bold underline">
                        {watchDeadline
                          ? formatDate(watchDeadline)
                          : rfq.deadline
                            ? formatDate(rfq.deadline)
                            : "______________________________________"}
                      </span>{" "}
                      in the return envelope attached herewith. <br />
                    </div>

                    <div className="flex justify-end mb-6 text-center">
                      <div className="w-[550px]">
                        <div className="font-bold px-4 text-[16px] uppercase">
                          {selectedSignatory?.name || "JEFFY S. CANGAYDA"}
                        </div>
                        <div className="text-[13px]">BAC Chairman</div>
                      </div>
                    </div>

                    <div className="mb-4 text-xs font-bold leading-tight text-[13px]">
                      NOTE:
                      <br />
                      <span className="ml-7 inline-block w-4">1</span> DELIVERY PERIOD WITHIN{" "}
                      <EditablePreviewInput
                        value={deliveryPeriod}
                        onChange={setDeliveryPeriod}
                        disabled={isReadOnly}
                        align="center"
                        className="w-24 font-bold text-center inline-block"
                      />{" "}
                      CALENDAR DAYS.
                      <br />
                      <span className="ml-7 inline-block w-4">2</span> WARRANTY SHALL BE FOR A PERIOD
                      OF SIX (6) MONTHS FOR SUPPLIES & MATERIALS,
                      <br />
                      <span className="ml-7 inline-block w-4"></span> ONE (1) YEAR FOR EQUIPMENT, FROM
                      DATE OF ACCEPTANCE BY THE PROCURING
                      <br />
                      <span className="ml-7 inline-block w-4"></span> ENTITY.
                      <br />
                      <span className="ml-7 inline-block w-4">3</span> PRICE VALIDITY SHALL BE FOR A
                      PERIOD OF <span className="underline">THIRTY (30)</span> CALENDAR DAYS.
                      <br />
                      <span className="ml-7 inline-block w-4">4</span> G-EPS REGISTRATION CERTIFICATE
                      SHALL BE ATTACHED UPON SUBMISSION OF THE
                      <br />
                      <span className="ml-7 inline-block w-4"></span> QUOTATION.
                      <br />
                      <span className="ml-7 inline-block w-4">5</span> BIDDER SHALL SUBMIT ORIGINAL
                      BROCHURES SHOWING CERTIFICATIONS OF THE <br />
                      <span className="ml-7 inline-block w-4"></span> PRODUCT BEING OFFERED.
                      <br />
                      <div className="flex" style={{ marginLeft: "0.5px" }}>
                        <span className="ml-7 inline-block w-4 font-bold">6</span>
                        <span className="font-bold">
                          Approved Budget for the Contract (ABC)
                          <span className="ml-33 w-36 border-b border-black text-center pr-8">
                            P{" "}
                            <span className="ml-4">
                              {formatCurrency(rfq.pr?.totalAmount || 0).replace("₱", "")}
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* SF-GOOD-60 Excel Table Grid */}
                    <div ref={gridWrapperRef}>
                      <RfqExcelTableGrid
                        items={rfq.lineItems || []}
                        targetRows={targetRows}
                        isReadOnly={isReadOnly}
                        onChange={handleLineItemsChange}
                        onRowSelect={handleRowClick}
                        activeItemIndex={activeSpecIndex !== null ? activeSpecIndex : activeItemIndex}
                        prItems={rfq.pr?.lineItems}
                        onDeselect={() => {
                          setActiveItemIndex(null);
                          setActiveSpecIndex(null);
                          setPanelView("details");
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-end mb-2">
                      <div className="font-bold text-[14px]">GRAND TOTAL</div>
                      <div className="w-32 border-b-2 border-black pb-0.5 mt-4 mb-1 text-base text-right font-bold">
                        <div className="border-b-2 border-black w-full mt-0.5"></div>
                      </div>
                    </div>

                    <div className="pl-13 mb-10 text-[13px] leading-tight">
                      {rfq.pr?.purpose}
                    </div>

                    <div className="mb-8 text-[13px] indent-[50px]">
                      After having carefully read and accepted your General Conditions, I/We quote you
                      on the item
                      <br />
                      at prices noted above.
                      <br />
                    </div>

                    <div className="flex justify-end text-center mt-8 pb-4">
                      <div className="w-[250px]">
                        <EditablePreviewInput
                          value={supplierContactPerson}
                          onChange={setSupplierContactPerson}
                          disabled={isReadOnly}
                          align="center"
                          className="w-full text-[13px] font-bold"
                        />
                        <div className="mb-4 text-[13px]">Printed Name/Signature</div>
                        <EditablePreviewInput
                          value={supplierContactNo}
                          onChange={setSupplierContactNo}
                          disabled={isReadOnly}
                          align="center"
                          className="w-full text-[13px]"
                        />
                        <div className="text-[13px]">Tel No./ Cell phone No.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Guaranteed scroll spacer that accounts for zoom scale and floating controls */}
            <div
              style={{
                height: "80px",
                minHeight: "80px",
                width: "100%",
                flexShrink: 0,
              }}
              className="no-print pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Right Side: Data Entry Form with 3-Panel Architecture */}
        <div ref={rightPanelRef} className="no-print w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-3 shrink-0">
            <h2 className="text-base font-bold text-slate-900">RFQ Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the RFQ is issued."
                : !rfq.rfqNumber
                  ? "Edit the details for the Request for Quotation."
                  : "Update the details for the Request for Quotation."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-0">
            {/* VIEW 1: DOCUMENT DETAILS */}
            {panelView === "details" && (
              <div className="flex flex-col gap-3.5">
                {/* + Add item Button */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleAddNewMainItem}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} className="stroke-[2.5]" /> Add item
                  </button>
                )}

                {/* Hint banner */}
                <div className="p-3 bg-blue-50/70 border border-blue-100/90 rounded-xl text-center text-xs text-blue-900 font-medium">
                  Click a row in the document to edit it, or type directly in the cells.
                </div>

                {/* Card 1: REQUEST INFO */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    REQUEST INFO
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-800">
                      RFQ Number
                    </label>
                    <input
                      type="text"
                      {...register("rfqNumber")}
                      disabled={isReadOnly}
                      placeholder="e.g. 26-01-001"
                      className="form-input font-mono font-bold text-sm bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Leave blank if not yet assigned by custodian. Can be updated at any time.
                    </p>
                  </div>

                  {/* Show/Hide Document Number on Document Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label
                      className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                      onClick={() => setShowRfqNo(!showRfqNo)}
                    >
                      Show RFQ Number on document
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRfqNo(!showRfqNo)}
                      style={{
                        width: "44px",
                        height: "24px",
                        borderRadius: "12px",
                        background: showRfqNo ? "#10b981" : "#cbd5e1",
                        position: "relative",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.3s",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                      }}
                      title={showRfqNo ? "Hide from document" : "Show on document"}
                    >
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "2px",
                          left: showRfqNo ? "22px" : "2px",
                          transition: "left 0.3s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Card 2: SIGNATORY & DEADLINE */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    SIGNATORY & DEADLINE
                  </div>
                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Signatory (BAC Chairman)
                    </label>
                    <CustomSelect
                      value={watchSignatoryId || ""}
                      onChange={(val) =>
                        setValue("signatoryId", val, { shouldValidate: true, shouldDirty: true })
                      }
                      options={signatories.map((s) => ({
                        value: s.id,
                        label: s.name,
                        sublabel: s.position,
                      }))}
                      placeholder="Select Signatory..."
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">
                      Submission Deadline
                    </label>
                    <input
                      type="date"
                      {...register("deadline")}
                      disabled={isReadOnly}
                      className="form-input"
                    />
                    {!isReadOnly && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Required before the RFQ can be issued.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card 3: PROJECT & DELIVERY DETAILS */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    PROJECT & DELIVERY DETAILS
                  </div>

                  <div>
                    <label className="form-label text-xs">Company Name</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Supplier / Company name"
                      disabled={isReadOnly}
                      className="form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs">Company Address</label>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="Address"
                      disabled={isReadOnly}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label text-xs">Project Ref No.</label>
                      <input
                        type="text"
                        value={projectRefNo}
                        onChange={(e) => setProjectRefNo(e.target.value)}
                        placeholder="Ref No."
                        disabled={isReadOnly}
                        className="form-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Delivery (Days)</label>
                      <input
                        type="text"
                        value={deliveryPeriod}
                        onChange={(e) => setDeliveryPeriod(e.target.value)}
                        placeholder="e.g. 15"
                        disabled={isReadOnly}
                        className="form-input text-xs text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-xs">Project Name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Name of project"
                      disabled={isReadOnly}
                      className="form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs">Project Location</label>
                    <input
                      type="text"
                      value={projectLocation}
                      onChange={(e) => setProjectLocation(e.target.value)}
                      placeholder="Location"
                      disabled={isReadOnly}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <label className="form-label text-xs">Supplier Contact Person</label>
                      <input
                        type="text"
                        value={supplierContactPerson}
                        onChange={(e) => setSupplierContactPerson(e.target.value)}
                        placeholder="Printed Name / Signature"
                        disabled={isReadOnly}
                        className="form-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Supplier Tel / Cell No.</label>
                      <input
                        type="text"
                        value={supplierContactNo}
                        onChange={(e) => setSupplierContactNo(e.target.value)}
                        placeholder="Tel No. / Cell phone No."
                        disabled={isReadOnly}
                        className="form-input text-xs"
                      />
                    </div>
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
                  EDITING ITEM {activeMain.displayNo}
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="form-label text-xs">Description *</label>

                  </div>
                  <textarea
                    rows={3}
                    value={activeMain.item.description || ""}
                    onChange={(e) =>
                      updateItemAt(activeMain.rawIndex, {
                        description: e.target.value,
                        descriptionEdited: true,
                      })
                    }
                    onKeyDown={(e) =>
                      handleTextFormattingKeyDown(e, (newVal) =>
                        updateItemAt(activeMain.rawIndex, {
                          description: newVal,
                          descriptionEdited: true,
                        })
                      )
                    }
                    className="form-input text-sm"
                    placeholder="Enter item description..."
                    disabled={isReadOnly}
                  />
                </div>

                {/* Unit of issue */}
                <div>
                  <label className="form-label text-xs">Unit of issue</label>
                  <input
                    type="text"
                    value={activeMain.item.unit || ""}
                    onChange={(e) => updateItemAt(activeMain.rawIndex, { unit: e.target.value })}
                    className="form-input text-sm"
                    placeholder="e.g. Unit, Pc, Set..."
                    disabled={isReadOnly}
                  />
                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["Unit", "Pc", "Set", "Box", "Ream", "Lot"].map((u) => {
                      const isSelected =
                        (activeMain.item.unit || "").toLowerCase() === u.toLowerCase();
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => !isReadOnly && updateItemAt(activeMain.rawIndex, { unit: u })}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                          {u}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Qty */}
                <div>
                  <label className="form-label text-xs">Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={activeMain.item.quantity ?? ""}
                    onChange={(e) =>
                      updateItemAt(activeMain.rawIndex, {
                        quantity: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="form-input text-sm"
                    placeholder="0"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Specification Lines */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    SPECIFICATION LINES · {activeMain.specs.length}
                  </div>

                  {activeMain.specs.length > 0 && (
                    <div className="space-y-1.5">
                      {activeMain.specs.map((spec) => (
                        <div
                          key={spec.rawIndex}
                          className="flex items-center justify-between p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs"
                        >
                          <span className="text-slate-800 font-medium truncate pr-2">
                            <FormattedCellText text={spec.item.description} fallback="(Empty specification)" />
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSpecIndex(spec.rawIndex);
                              setPanelView("spec");
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAddSpecLine(activeMain)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 py-1 transition-colors"
                  >
                    <Plus size={13} className="stroke-[2.5]" /> Add spec line
                  </button>
                </div>

                {/* Actions 2x2 grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleInsertAboveMain(activeMain)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    Insert above
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBelowMain(activeMain)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    Insert below
                  </button>
                  <button
                    type="button"
                    disabled={activeMain.mainIndex === 0}
                    onClick={() => handleMoveMainUp(activeMain)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={activeMain.mainIndex >= mainItems.length - 1}
                    onClick={() => handleMoveMainDown(activeMain)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Move down
                  </button>
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

                <div>
                  <div className="flex items-center justify-between">
                    <label className="form-label text-xs">Description</label>

                  </div>
                  <textarea
                    rows={3}
                    value={activeSpec.item.description || ""}
                    onChange={(e) =>
                      updateItemAt(activeSpec.rawIndex, {
                        description: e.target.value,
                        descriptionEdited: true,
                      })
                    }
                    onKeyDown={(e) =>
                      handleTextFormattingKeyDown(e, (newVal) =>
                        updateItemAt(activeSpec.rawIndex, {
                          description: newVal,
                          descriptionEdited: true,
                        })
                      )
                    }
                    className="form-input text-sm"
                    placeholder="Enter specification details..."
                    disabled={isReadOnly}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prints under the item. Spec lines have no price or quantity.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleInsertSpecAbove(activeSpec.rawIndex)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    Insert above
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertSpecBelow(activeSpec.rawIndex)}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    Insert below
                  </button>
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
                  ABC: ₱{formatCurrency(rfq.pr?.totalAmount || 0).replace("₱", "")}
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
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteMainItem(activeMain)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Delete item
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
            <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteSpecLine(activeSpecIndex)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Delete line
              </button>
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
        message="Are you sure you want to save these changes to the Request for Quotation?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document has been finalized. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        isDestructive={true}
      />
    </div>
  );
}
