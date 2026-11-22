"use client";
import LoaderWave from "@/components/ui/loader-wave";
import CustomSelect from "@/components/ui/custom-select";
import ConfirmModal from "@/components/ui/confirm-modal";
import { EditablePreviewInput } from "@/components/documents/editable-preview-input";
import { PoExcelTableGrid, PoLineItem } from "@/components/documents/po-excel-table-grid";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import {
  Printer,
  Save,
  ArrowLeft,
  Loader2,
  Send,
  ZoomIn,
  ZoomOut,
  Minus,
  Plus,
  Package,
  CheckCircle2,
  Lock,
  Unlock,
  Truck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  modeOfProcurement: string;
  orderType: string;
  requestingOffice?: string;
}

interface MainItemRef {
  rawIndex: number;
  mainIndex: number;
  displayNo: number;
  item: PoLineItem;
  specs: { rawIndex: number; item: PoLineItem }[];
}

const quickUnits = ["Unit", "Pc", "Set", "Box", "Ream", "Lot", "Pack", "Roll", "Meter"];

export default function PurchaseOrderEditor() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  const [zoom, setZoom] = useState(0.85);
  const [targetRows, setTargetRows] = useState(10);
  const [showPoNo, setShowPoNo] = useState(false);
  const [showPrNo, setShowPrNo] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState<string>("");
  const [customTin, setCustomTin] = useState<string>("");

  // 3-Panel Right Sidebar state
  const [panelView, setPanelView] = useState<"details" | "item" | "spec">("details");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);
  const [deletedLineItemIds, setDeletedLineItemIds] = useState<string[]>([]);

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
    handleSubmit(onSubmit)();
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
    },
  });

  const watchAll = watch();
  const watchOrderType =
    watch("orderType") ||
    poData?.orderType ||
    poData?.abstract?.rfq?.pr?.requestType ||
    poData?.pr?.requestType ||
    "PURCHASE";
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
          if (data.lastSavedBy) setLastSavedBy(data.lastSavedBy);
          const allSups = await supRes.json();
          setSuppliers(allSups);

          // Find awarded quote if supplierId is not yet saved on po
          const validQuotes =
            data.abstract?.rfq?.quotations?.filter((q: any) => (q.totalAmount || 0) > 0) || [];
          const winningQuote =
            validQuotes.length > 0
              ? validQuotes.reduce((prev: any, curr: any) =>
                  prev.totalAmount < curr.totalAmount ? prev : curr
                )
              : null;

          const resolvedSupplierId = data.supplierId || winningQuote?.supplierId || "";
          const initialOrderType =
            data.orderType ||
            data.abstract?.rfq?.pr?.requestType ||
            data.pr?.requestType ||
            "PURCHASE";
          const defaultOffice =
            data.remarks ||
            data.abstract?.rfq?.pr?.office?.name ||
            data.pr?.office?.name ||
            "Municipal Civil Registrar";

          reset({
            poNumber: data.poNumber || "",
            supplierId: resolvedSupplierId,
            deliveryDate: data.deliveryDate
              ? new Date(data.deliveryDate).toISOString().split("T")[0]
              : "",
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

  // Group line items into Main items and nested specification lines
  const rawLineItems: PoLineItem[] = poData?.lineItems || [];

  const mainItems: MainItemRef[] = useMemo(() => {
    const list: MainItemRef[] = [];
    let currentMain: MainItemRef | null = null;
    let mainCounter = 0;

    rawLineItems.forEach((it, idx) => {
      const isBlank =
        !it.description?.trim() &&
        (it.quantity === "" || it.quantity === 0 || it.quantity === null || it.quantity === undefined);

      if (isBlank) return;

      const isMain =
        it.quantity !== "" &&
        it.quantity !== null &&
        it.quantity !== undefined &&
        Number(it.quantity) > 0;

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

  const handleLineItemsChange = (newItems: PoLineItem[]) => {
    setPoData((prev: any) => {
      if (!prev) return prev;
      return { ...prev, lineItems: newItems };
    });
  };

  const updateItemAt = (index: number, updates: Partial<PoLineItem>) => {
    setPoData((prev: any) => {
      if (!prev || !prev.lineItems) return prev;
      const current = [...prev.lineItems];
      if (!current[index]) return prev;
      const merged = { ...current[index], ...updates };
      const qty = merged.quantity !== "" && merged.quantity !== null && merged.quantity !== undefined ? Number(merged.quantity) : 0;
      const price = merged.unitPrice !== "" && merged.unitPrice !== null && merged.unitPrice !== undefined ? Number(merged.unitPrice) : 0;
      merged.totalPrice = qty * price;
      current[index] = merged;
      return { ...prev, lineItems: current };
    });
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    const items = poData?.lineItems || [];
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
    const newItem: PoLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    setPoData((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.push(newItem);
      return { ...prev, lineItems: current };
    });
    const newLen = (poData?.lineItems?.length || 0) + 1;
    setActiveItemIndex(newLen - 1);
    setActiveSpecIndex(null);
    setPanelView("item");
  };

  const handleAddSpecLine = (main: MainItemRef) => {
    if (isReadOnly) return;
    const lastSpecRawIdx =
      main.specs.length > 0 ? main.specs[main.specs.length - 1].rawIndex : main.rawIndex;
    const insertAt = lastSpecRawIdx + 1;
    const newSpec: PoLineItem = {
      description: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      totalPrice: 0,
    };
    setPoData((prev: any) => {
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
    setPoData((prev: any) => {
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
    setPoData((prev: any) => {
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
    const newItem: PoLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    setPoData((prev: any) => {
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
    const newItem: PoLineItem = {
      description: "",
      unit: "Unit",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    setPoData((prev: any) => {
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
    setPoData((prev: any) => {
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
    setPoData((prev: any) => {
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
    const newSpec: PoLineItem = {
      description: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      totalPrice: 0,
    };
    setPoData((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(specRawIndex, 0, newSpec);
      return { ...prev, lineItems: current };
    });
    setActiveSpecIndex(specRawIndex);
    toast.success("Specification line inserted above");
  };

  const handleInsertSpecBelow = (specRawIndex: number) => {
    if (isReadOnly) return;
    const newSpec: PoLineItem = {
      description: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      totalPrice: 0,
    };
    const targetIndex = specRawIndex + 1;
    setPoData((prev: any) => {
      const current = [...(prev?.lineItems || [])];
      current.splice(targetIndex, 0, newSpec);
      return { ...prev, lineItems: current };
    });
    setActiveSpecIndex(targetIndex);
    toast.success("Specification line inserted below");
  };

  const onSubmit = async (data: POFormValues) => {
    setSubmitting(true);
    try {
      const payload: any = {
        poNumber: data.poNumber,
        supplierId: data.supplierId,
        deliveryDate: data.deliveryDate,
        placeOfDelivery: data.placeOfDelivery,
        deliveryTerms: data.deliveryTerms,
        paymentTerms: data.paymentTerms,
        orderType: data.orderType || "PURCHASE",
        requestingOffice: data.requestingOffice,
      };

      if (poData?.lineItems && Array.isArray(poData.lineItems)) {
        payload.lineItems = poData.lineItems.map((li: any) => ({
          id: li.id,
          description: li.description,
          descriptionEdited: !!li.descriptionEdited,
          quantity: li.quantity === "" ? 0 : li.quantity,
          unit: li.unit || "Unit",
          unitPrice: li.unitPrice === "" ? 0 : li.unitPrice,
          totalPrice: li.totalPrice || 0,
          propertyNo: li.propertyNo,
        }));
      }

      if (deletedLineItemIds.length > 0) {
        payload.deletedLineItemIds = deletedLineItemIds;
      }

      const res = await fetch(`/api/purchase-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setPoData((prev: any) => ({ ...prev, ...updated }));
        setDeletedLineItemIds([]);
        setLastSaved(new Date());
        if (updated.lastSavedBy) {
          setLastSavedBy(updated.lastSavedBy);
        } else if (session?.user?.name) {
          setLastSavedBy(session.user.name);
        }
        toast.success(
          isJob ? "Job Order saved successfully" : "Purchase Order saved successfully"
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(
          errorData.error || (isJob ? "Failed to save Job Order" : "Failed to save Purchase Order")
        );
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
        body: JSON.stringify({ status }),
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

  if (loading) return <LoaderWave variant="page" label="Loading purchase order..." />;
  if (!poData) return <div className="p-8 text-center text-slate-500">PO not found</div>;

  const isReadOnly = poData.status === "COMPLETED" && !isUnlocked;

  // Resolve awarded quote from abstract as fallback if po has not saved supplier yet
  const validQuotes =
    poData.abstract?.rfq?.quotations?.filter((q: any) => (q.totalAmount || 0) > 0) || [];
  const winningQuote =
    validQuotes.length > 0
      ? validQuotes.reduce((prev: any, curr: any) =>
          prev.totalAmount < curr.totalAmount ? prev : curr
        )
      : null;

  const selectedSupplier =
    suppliers.find((s) => s.id === watchAll.supplierId) || poData.supplier || winningQuote?.supplier;

  // Dynamically calculate total amount from line items
  const calculatedItemsTotal = (poData?.lineItems || []).reduce((acc: number, item: any) => {
    const qty = item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : 0;
    let price = item.unitPrice && Number(item.unitPrice) > 0 ? Number(item.unitPrice) : 0;
    if (price === 0 && winningQuote?.lineItems) {
      const qLine = winningQuote.lineItems.find(
        (qli: any) =>
          qli.rfqLineItemId === item.id ||
          qli.rfqLineItem?.description?.trim().toLowerCase() === item.description?.trim().toLowerCase()
      );
      if (qLine?.unitPrice) price = Number(qLine.unitPrice);
    }
    return acc + qty * price;
  }, 0);

  const poTotalAmount =
    calculatedItemsTotal > 0
      ? calculatedItemsTotal
      : poData.totalAmount && poData.totalAmount > 0
      ? poData.totalAmount
      : winningQuote?.totalAmount || 0;

  const supplierName = selectedSupplier?.name || "";
  const supplierFontSize =
    supplierName.length > 55
      ? "text-[10px]"
      : supplierName.length > 42
      ? "text-[11.5px]"
      : supplierName.length > 30
      ? "text-[13px]"
      : "text-[15px]";

  const supplierAddress = selectedSupplier?.address || "";
  let addressLine1 = supplierAddress;
  let addressLine2 = "";
  if (supplierAddress.length > 40) {
    const lastSpace = supplierAddress.lastIndexOf(" ", 40);
    const splitIdx = lastSpace > 20 ? lastSpace : 40;
    addressLine1 = supplierAddress.substring(0, splitIdx).trim();
    addressLine2 = supplierAddress.substring(splitIdx).trim();
  }

  const linkedPrNumber = poData.abstract?.rfq?.pr?.prNumber || poData.pr?.prNumber || "PENDING";

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
              {poData.poNumber?.trim()
                ? poData.poNumber.trim()
                : isJob
                ? "Job Order"
                : "Purchase Order"}
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
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(poData.status === "SIGNED" ||
            poData.status === "PARTIALLY_DELIVERED" ||
            poData.status === "COMPLETED") && (
            <Link
              href={`/acceptances/hub/${poData.id}`}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package size={17} className="text-emerald-600" />
              <span>Delivery Hub</span>
            </Link>
          )}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {poData.status === "COMPLETED" && (
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

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
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

      {/* Status Banners */}
      {poData.status === "SIGNED" && (
        <div className="no-print bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-2.5 flex items-center justify-between gap-2.5 text-xs text-indigo-900 shadow-sm font-medium shrink-0">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
            <span>
              <strong className="font-bold">This {isJob ? "Job Order" : "Purchase Order"} is signed.</strong> Conforme has been accepted. You can now record deliveries in the Delivery Hub.
            </span>
          </div>
          <Link
            href={`/acceptances/hub/${poData.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors shadow-2xs shrink-0"
          >
            <Package size={14} className="text-indigo-600" />
            Go to Delivery Hub &rarr;
          </Link>
        </div>
      )}

      {poData.status === "PARTIALLY_DELIVERED" && (
        <div className="no-print bg-blue-50 border border-blue-200 rounded-2xl px-5 py-2.5 flex items-center justify-between gap-2.5 text-xs text-blue-900 shadow-sm font-medium shrink-0">
          <div className="flex items-center gap-2.5">
            <Truck size={15} className="text-blue-600 shrink-0" />
            <span>
              <strong className="font-bold">Partially Delivered.</strong> Some line items have been accepted. Deliveries are still ongoing in the Delivery Hub.
            </span>
          </div>
          <Link
            href={`/acceptances/hub/${poData.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors shadow-2xs shrink-0"
          >
            <Package size={14} className="text-blue-600" />
            Delivery Hub &rarr;
          </Link>
        </div>
      )}

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
              onClick={() => setTargetRows((r) => Math.min(r + 1, 30))}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="Add Row"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full print:!m-0 print:!p-0">
              <div
                className="po-zoom-wrapper origin-top print:!block print:!w-full print:!min-w-0 print:!max-w-none print:!transform-none print:!m-0 print:!p-0 print:!h-auto"
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
                  className="print:!transform-none print:!w-full print:!max-w-none print:!min-w-0 print:!m-0 print:!p-0 print:!mb-0"
                >
                  <div
                    className="print-area text-black shadow-xl text-[14px] leading-tight print:shadow-none print:!w-full print:!max-w-none print:!min-w-0 print:!m-0 print:!p-0 print:!min-h-0 [&_td]:!font-['Times_New_Roman',_Times,_serif] [&_td]:!text-[14px] [&_th]:!font-['Times_New_Roman',_Times,_serif] [&_th]:!text-[14px] [&_th]:!text-black [&_th]:!normal-case [&_th]:!tracking-normal [&_th]:!font-bold w-[830px] min-h-[1123px] bg-white p-10"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    <div className="border-[3px] border-black">
                      <div className="text-right italic pt-2 pr-2 text-sm">Appendix 49</div>

                      <div className="text-center font-bold mb-4">
                        <div className="text-xl font-black font-serif">
                          {isJob ? "JOB ORDER" : "PURCHASE ORDER"}
                        </div>
                        <div className="uppercase underline mt-1 text-[15px]">
                          MUNICIPAL GOVERNMENT OF PANDAN
                        </div>
                        <div className="text-[15px]">LGU</div>
                      </div>

                      <div
                        className="border-t-[2px] border-black grid text-[15px]"
                        style={{ gridTemplateColumns: "15% 10% 36.79% 10% 12% 14%" }}
                      >
                        <div className="col-span-3 border-r-[2px] border-black p-0 px-1 flex flex-col justify-between">
                          {/* Row 1: Supplier */}
                          <div className="flex items-end">
                            <span className="font-bold whitespace-nowrap mr-2 pt-2">Supplier :</span>
                            <span
                              className={`flex-1 font-bold border-b border-black text-left whitespace-nowrap overflow-hidden leading-tight ${supplierFontSize}`}
                              title={supplierName}
                            >
                              {supplierName}
                            </span>
                          </div>

                          {/* Row 2: Address line 1 */}
                          <div className="flex items-end mt-1">
                            <span className="font-bold whitespace-nowrap mr-2">Address :</span>
                            <EditablePreviewInput
                              value={customAddress || addressLine1}
                              onChange={setCustomAddress}
                              disabled={isReadOnly}
                              className="flex-1 font-bold text-left leading-tight"
                            />
                          </div>

                          {/* Row 3: Address line 2 */}
                          <div className="flex items-end mt-1">
                            <span className="w-6 shrink-0"></span>
                            <span className="flex-1 font-bold border-b border-black text-left leading-tight min-h-[1.1rem]">
                              {addressLine2 || "\u00A0"}
                            </span>
                          </div>

                          {/* Row 4: TIN */}
                          <div className="flex items-end mt-1">
                            <span className="font-bold whitespace-nowrap mr-2">TIN :</span>
                            <EditablePreviewInput
                              value={customTin}
                              onChange={setCustomTin}
                              disabled={isReadOnly}
                              className="flex-1 font-bold text-left leading-tight"
                            />
                          </div>
                        </div>
                        <div className="col-span-3 p-1 px-2 flex flex-col justify-between">
                          <div className="flex items-end">
                            <span className="font-bold whitespace-nowrap mr-2 pt-1">
                              {isJob ? "J.O. No. :" : "P.O. No. :"}
                            </span>
                            <EditablePreviewInput
                              value={showPoNo ? watchAll.poNumber || "" : ""}
                              onChange={(val) =>
                                setValue("poNumber", val, { shouldValidate: true, shouldDirty: true })
                              }
                              disabled={isReadOnly}
                              align="center"
                              className="flex-1 font-bold"
                            />
                          </div>
                          <div className="flex items-end mt-1">
                            <span className="font-bold whitespace-nowrap mr-2">Date :</span>
                            <span className="flex-1 font-bold border-b border-black text-center leading-tight">
                              {watchAll.deliveryDate
                                ? new Date(watchAll.deliveryDate).toLocaleDateString("en-PH")
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-end mt-1">
                            <span className="font-bold whitespace-nowrap mr-2">Mode of Procurement :</span>
                            <span className="flex-1 font-bold border-b border-black text-center leading-tight">
                              {watchAll.modeOfProcurement}
                            </span>
                          </div>
                          <div className="flex items-end mt-1">
                            <span className="font-bold whitespace-nowrap mr-2">
                              {isJob ? "JR No./s :" : "PR No./s :"}
                            </span>
                            <span className="flex-1 font-bold text-center leading-tight">
                              {showPrNo && linkedPrNumber !== "PENDING" ? linkedPrNumber : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-[2px] border-black p-1 px-2 text-[15px]">
                        <div>Gentlemen:</div>
                        <div className="pl-8">
                          Please furnish this Office the following articles subject to the terms and
                          conditions contained herein:
                        </div>
                      </div>

                      <div
                        className="border-t-[2px] border-black grid text-[15px]"
                        style={{ gridTemplateColumns: "15% 10% 36.79% 12% 16% 16%" }}
                      >
                        <div className="col-span-3 border-r-[2px] border-black">
                          <div className="flex items-center border-b border-black p-0 px-1">
                            <span className="font-bold w-36 whitespace-nowrap">Place of Delivery :</span>
                            <EditablePreviewInput
                              value={watchAll.placeOfDelivery || ""}
                              onChange={(val) =>
                                setValue("placeOfDelivery", val, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                              disabled={isReadOnly}
                              underline={false}
                              className="font-bold flex-1"
                            />
                          </div>
                          <div className="flex items-center p-0 px-1">
                            <span className="font-bold w-36 whitespace-nowrap">Date of Delivery :</span>
                            <span className="font-bold flex-1 pl-1">
                              {watchAll.deliveryDate
                                ? new Date(watchAll.deliveryDate).toLocaleDateString("en-PH")
                                : ""}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center p-0 px-1">
                            <span className="font-bold w-32 whitespace-nowrap">Delivery Term :</span>
                            <EditablePreviewInput
                              value={watchAll.deliveryTerms || ""}
                              onChange={(val) =>
                                setValue("deliveryTerms", val, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                              disabled={isReadOnly}
                              underline={false}
                              className="font-bold flex-1"
                            />
                          </div>
                          <div className="flex items-center p-0 px-1">
                            <span className="font-bold w-32 whitespace-nowrap">Payment Term :</span>
                            <EditablePreviewInput
                              value={watchAll.paymentTerms || ""}
                              onChange={(val) =>
                                setValue("paymentTerms", val, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                              disabled={isReadOnly}
                              underline={false}
                              className="font-bold flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Interactive Excel Grid Table */}
                      <div ref={gridWrapperRef}>
                        <PoExcelTableGrid
                          items={poData.lineItems || []}
                          targetRows={targetRows}
                          isReadOnly={isReadOnly}
                          requestingOffice={
                            watchAll.requestingOffice ||
                            poData?.remarks ||
                            poData?.abstract?.rfq?.pr?.office?.name ||
                            poData?.pr?.office?.name ||
                            "Municipal Civil Registrar"
                          }
                          totalAmount={poTotalAmount}
                          winningQuote={winningQuote}
                          onChange={handleLineItemsChange}
                          onRowSelect={handleRowClick}
                          onStartInsert={(pos) => {
                            if (isReadOnly) return;
                            const newItem: PoLineItem = {
                              description: "",
                              unit: "Unit",
                              quantity: 1,
                              unitPrice: 0,
                              totalPrice: 0,
                            };
                            setPoData((prev: any) => {
                              const current = [...(prev?.lineItems || [])];
                              current.splice(pos, 0, newItem);
                              return { ...prev, lineItems: current };
                            });
                            setActiveItemIndex(pos);
                            setActiveSpecIndex(null);
                            setPanelView("item");
                          }}
                          activeItemIndex={activeSpecIndex !== null ? activeSpecIndex : activeItemIndex}
                          onDeselect={() => {
                            setActiveItemIndex(null);
                            setActiveSpecIndex(null);
                            setPanelView("details");
                          }}
                        />
                      </div>

                      <div className="border-t-[2px] border-black">
                        <div className="p-2 pb-4 indent-8 text-justify">
                          In case of failure to make the full delivery within the time specified above, a
                          penalty of one-tenth (1/10) of one percent for every day of delay shall be
                          imposed on the undelivered item/s.
                        </div>

                        <div
                          className="grid pb-2"
                          style={{ gridTemplateColumns: "15% 10% 36.79% 10% 12% 14%" }}
                        >
                          <div className="col-span-3 pl-4 pr-2">
                            <div className="mb-8">Conforme:</div>
                            <div className="text-center w-72 mx-auto">
                              <div className="border-b border-black h-4 mb-1"></div>
                              <div>Signature over Printed Name of Supplier</div>
                              <div className="border-b border-black h-8 mb-1 w-3/4 mx-auto"></div>
                              <div>Date</div>
                            </div>
                          </div>
                          <div className="col-span-3 p-1 px-2">
                            <div className="mb-8">Very truly yours,</div>
                            <div className="text-center w-64 mx-auto font-bold mt-4">
                              HON. TOMAS U. ESTOPEREZ, JR.
                              <div className="font-normal">Municipal Mayor</div>
                            </div>
                            <div className="flex items-end justify-start mt-14">
                              <span className="mr-2">Resolution No:</span>
                              <span className="border-b border-black w-20"></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-[2px] border-black p-4 text-center">
                        <div className="mb-4">
                          (In case of Negotiated Purchase pursuant to Section 369 (a) of RA 7160, this
                          portion must be accomplished.)
                        </div>
                        <div className="flex items-end justify-start mb-6">
                          <span className="mr-2">Approved per Sanggunian Resolution No.:</span>
                          <span className="border-b border-black flex-1 max-w-[400px]"></span>
                        </div>
                        <div className="text-left mb-3 pl-4">Certified Correct:</div>
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
                  <h2 className="text-base font-bold text-slate-900">
                    {isJob ? "Job Order Details" : "Purchase Order Details"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {isReadOnly
                      ? "Read-only while the order is completed."
                      : `Update the details for the ${isJob ? "Job Order" : "Purchase Order"}.`}
                  </p>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleAddNewMainItem}
                    className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus size={15} />
                    <span>Add item</span>
                  </button>
                )}

                <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900">
                  Click a row in the document to edit it, or type directly in the cells.
                </div>

                {/* Order Type Toggle */}
                <div>
                  <label className="form-label">Order Type</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => !isReadOnly && setValue("orderType", "PURCHASE")}
                      disabled={isReadOnly}
                      className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        !isJob
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
                      className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        isJob
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
                    Shown in the table footer. Defaults from the requesting office in the PR and can be
                    changed anytime.
                  </p>
                </div>

                <div>
                  <label className="form-label">Awarded Supplier</label>
                  <CustomSelect
                    value={watchAll.supplierId || ""}
                    onChange={(val) =>
                      setValue("supplierId", val, { shouldValidate: true, shouldDirty: true })
                    }
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: s.name,
                      sublabel: s.address || undefined,
                    }))}
                    placeholder="-- Select Supplier --"
                    disabled={isReadOnly}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ideally set during abstract, but can be forced here.
                  </p>
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

                <div className="pt-3 border-t border-slate-200">
                  <h4
                    style={{
                      fontWeight: "800",
                      color: "#0f172a",
                      marginBottom: "0.75rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    Terms & Delivery
                  </h4>

                  <div className="space-y-3">
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
                  <label className="form-label">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={activeMain.item.description || ""}
                    onChange={(e) =>
                      updateItemAt(activeMain.rawIndex, {
                        description: e.target.value,
                        descriptionEdited: true,
                      })
                    }
                    className="form-input text-xs"
                    placeholder="Item name / general description"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Unit of issue with quick pills */}
                <div>
                  <label className="form-label">Unit of issue</label>
                  <input
                    type="text"
                    value={activeMain.item.unit || ""}
                    onChange={(e) => updateItemAt(activeMain.rawIndex, { unit: e.target.value })}
                    className="form-input text-xs"
                    placeholder="Unit, Pc, Set, Box..."
                    disabled={isReadOnly}
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {quickUnits.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => !isReadOnly && updateItemAt(activeMain.rawIndex, { unit: u })}
                        disabled={isReadOnly}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                          activeMain.item.unit?.toLowerCase() === u.toLowerCase()
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Qty and Unit Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      step="any"
                      value={activeMain.item.quantity ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const qty = val === "" ? "" : isNaN(Number(val)) ? 0 : Number(val);
                        updateItemAt(activeMain.rawIndex, { quantity: qty });
                      }}
                      className="form-input text-xs"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="form-label">Unit Cost (₱)</label>
                    <input
                      type="number"
                      step="any"
                      value={activeMain.item.unitPrice ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const price = val === "" ? "" : isNaN(Number(val)) ? 0 : Number(val);
                        updateItemAt(activeMain.rawIndex, { unitPrice: price });
                      }}
                      className="form-input text-xs"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Line Total */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Line total:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ₱
                    {formatCurrency(
                      (typeof activeMain.item.quantity === "number" ? activeMain.item.quantity : 0) *
                        (typeof activeMain.item.unitPrice === "number" ? activeMain.item.unitPrice : 0)
                    ).replace("₱", "")}
                  </span>
                </div>

                {/* Stock / Property No */}
                <div>
                  <label className="form-label">Stock / Property No. (Optional)</label>
                  <input
                    type="text"
                    value={activeMain.item.propertyNo || ""}
                    onChange={(e) => updateItemAt(activeMain.rawIndex, { propertyNo: e.target.value })}
                    className="form-input text-xs"
                    placeholder={`e.g. ${activeMain.displayNo} or PR-001`}
                    disabled={isReadOnly}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Defaults to item number if blank.
                  </p>
                </div>

                {/* Specification Lines section */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      SPECIFICATION LINES · {activeMain.specs.length}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddSpecLine(activeMain)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      + Add spec line
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {activeMain.specs.map((sp, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <span className="truncate pr-2 font-medium text-slate-700">
                          {sp.item.description || <em className="text-slate-400">Empty specification</em>}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSpecIndex(sp.rawIndex);
                            setPanelView("spec");
                          }}
                          className="text-blue-600 font-semibold hover:underline shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions: Insert Above/Below & Move Up/Down */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={activeMain.mainIndex <= 0}
                      onClick={() => handleMoveMainUp(activeMain)}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors disabled:opacity-40"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={activeMain.mainIndex >= mainItems.length - 1}
                      onClick={() => handleMoveMainDown(activeMain)}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors disabled:opacity-40"
                    >
                      Move down
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: SPEC LINE EDITOR */}
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
                  <textarea
                    rows={3}
                    value={activeSpec.item.description || ""}
                    onChange={(e) =>
                      updateItemAt(activeSpec.rawIndex, {
                        description: e.target.value,
                        descriptionEdited: true,
                      })
                    }
                    className="form-input text-xs"
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
                  Total: {formatCurrency(poTotalAmount)}
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
        message="Are you sure you want to save these changes to the Purchase Order?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document is locked. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        requirePassword={true}
        isDestructive={true}
      />
    </div>
  );
}
