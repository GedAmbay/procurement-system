"use client";
import LoaderWave from "@/components/ui/loader-wave";
import CustomSelect from "@/components/ui/custom-select";
import ConfirmModal from "@/components/ui/confirm-modal";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { ExcelTableGrid } from "@/components/documents/excel-table-grid";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";
import { handleTextFormattingKeyDown } from "@/lib/format-text-helpers";

import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { formatCurrency, normalizePrNumber, fiscalYearFromPrNumber } from "@/lib/utils";
import { Printer, Save, CheckCircle2, Plus, Minus, Trash2, ArrowLeft, Loader2, ZoomIn, ZoomOut, Lock, Unlock, FolderOpen, Calendar, MoveUp, MoveDown, CornerDownRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface PrLineItem {
  itemId: string | null;
  description: string;
  unit: string;
  quantity: number | "";
  unitCost: number | "";
}

interface PRFormValues {
  prNumber: string;
  fiscalYear?: number | "";
  officeId: string;
  fundSourceId: string;
  purpose: string;
  chargeToAccount: string;
  requestedBySignatoryId: string;
  isDirectAcquisition?: boolean;
  requestType?: string;
  lineItems: PrLineItem[];
}

export default function PurchaseRequestEditor() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isNew = params.id === "new";
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prData, setPrData] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [targetRows, setTargetRows] = useState(21);
  const [showPrNo, setShowPrNo] = useState(false);

  const handleUnlockConfirm = () => {
    setIsUnlocked(true);
    setUnlockModalOpen(false);
    toast.success("Editing enabled");
  };

  const handleSaveConfirm = () => {
    setSaveModalOpen(false);
    handleSubmit(onSubmit)();
  };

  // Options
  const [offices, setOffices] = useState<any[]>([]);
  const [fundSources, setFundSources] = useState<any[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<PRFormValues>({
    defaultValues: {
      prNumber: "",
      fiscalYear: new Date().getFullYear(),
      officeId: user?.officeId || "",
      fundSourceId: "",
      purpose: "",
      chargeToAccount: "",
      requestedBySignatoryId: "",
      requestType: "PURCHASE",
      lineItems: [],
    }
  });

  const watchAllFields = watch();

  // Multi-line responsive Purpose support for Annex 30 live preview & inline editing
  const line0Ref = useRef<HTMLInputElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const line2Ref = useRef<HTMLInputElement>(null);

  const splitPurposeIntoLines = (text: string): [string, string, string] => {
    if (!text) return ["", "", ""];

    // 1. If explicit newlines exist, strictly follow them
    if (text.includes("\n")) {
      const raw = text.split("\n");
      return [
        raw[0] || "",
        raw[1] || "",
        raw.slice(2).join(" ") || "",
      ];
    }

    // 2. If no newline exists, but text exceeds single-line capacity (~72 chars),
    // soft-wrap at word boundary so it doesn't get truncated
    const MAX_LINE_CHARS = 72;
    if (text.length > MAX_LINE_CHARS) {
      const breakLine = (str: string, maxLen: number) => {
        if (str.length <= maxLen) return { first: str, rest: "" };
        const lastSpace = str.lastIndexOf(" ", maxLen);
        const splitIdx = lastSpace > 25 ? lastSpace : maxLen;
        return {
          first: str.slice(0, splitIdx).trim(),
          rest: str.slice(splitIdx).trim(),
        };
      };

      const l1 = breakLine(text, MAX_LINE_CHARS);
      const l2 = breakLine(l1.rest, MAX_LINE_CHARS);
      return [l1.first, l2.first, l2.rest];
    }

    return [text, "", ""];
  };

  const purposeLines = useMemo(() => {
    return splitPurposeIntoLines(watchAllFields.purpose || "");
  }, [watchAllFields.purpose]);

  const handlePurposeLineChange = (lineIndex: number, newText: string) => {
    const currentLines = splitPurposeIntoLines(watchAllFields.purpose || "");
    const updatedLines: [string, string, string] = [currentLines[0], currentLines[1], currentLines[2]];
    updatedLines[lineIndex] = newText;

    let result = "";
    if (updatedLines[2].trim()) {
      result = `${updatedLines[0]}\n${updatedLines[1]}\n${updatedLines[2]}`;
    } else if (updatedLines[1].trim()) {
      result = `${updatedLines[0]}\n${updatedLines[1]}`;
    } else {
      result = updatedLines[0];
    }

    setValue("purpose", result, { shouldDirty: true, shouldTouch: true });
  };

  const handlePurposeLineKeyDown = (
    lineIndex: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (lineIndex === 0) {
        line1Ref.current?.focus();
        line1Ref.current?.select();
      } else if (lineIndex === 1) {
        line2Ref.current?.focus();
        line2Ref.current?.select();
      }
    } else if (e.key === "Backspace") {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        if (lineIndex === 1 && !purposeLines[1]) {
          e.preventDefault();
          line0Ref.current?.focus();
        } else if (lineIndex === 2 && !purposeLines[2]) {
          e.preventDefault();
          line1Ref.current?.focus();
        }
      }
    } else if (e.key === "ArrowDown") {
      if (lineIndex === 0) {
        e.preventDefault();
        line1Ref.current?.focus();
      } else if (lineIndex === 1) {
        e.preventDefault();
        line2Ref.current?.focus();
      }
    } else if (e.key === "ArrowUp") {
      if (lineIndex === 1) {
        e.preventDefault();
        line0Ref.current?.focus();
      } else if (lineIndex === 2) {
        e.preventDefault();
        line1Ref.current?.focus();
      }
    }
  };
  const watchLineItems = watch("lineItems");
  const watchRequestType = watch("requestType") || prData?.requestType || "PURCHASE";
  const isJob = watchRequestType === "JOB";
  const { fields, append, remove, update, insert, move } = useFieldArray({
    control,
    name: "lineItems",
  });

  const [panelView, setPanelView] = useState<"details" | "item" | "spec">("details");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

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

  const totalAmount = watchLineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost) || 0), 0);

  useEffect(() => {
    async function loadData() {
      try {
        const fetchSafe = async (url: string) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
          } catch {
            return [];
          }
        };

        const [officesRes, fundsRes, itemsRes, signatoriesRes] = await Promise.all([
          fetchSafe("/api/offices"),
          fetchSafe("/api/fund-sources"),
          fetchSafe("/api/items"),
          fetchSafe("/api/signatories")
        ]);

        setOffices(Array.isArray(officesRes) ? officesRes : []);
        setFundSources(Array.isArray(fundsRes) ? fundsRes : []);
        setItems(Array.isArray(itemsRes) ? itemsRes : []);
        setSignatories(Array.isArray(signatoriesRes) ? signatoriesRes : []);

        if (!isNew) {
          const prRes = await fetch(`/api/purchase-requests/${params.id}`);
          if (prRes.ok) {
            const pr = await prRes.json();
            setPrData(pr);
            if (pr.updatedAt) {
              setLastSaved(new Date(pr.updatedAt));
            }
            if (pr.lastSavedBy) {
              setLastSavedBy(pr.lastSavedBy);
            }
            reset({
              prNumber: pr.prNumber || "",
              fiscalYear: pr.fiscalYear || new Date().getFullYear(),
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: pr.purpose || "",
              chargeToAccount: pr.chargeToAccount || "",
              isDirectAcquisition: pr.isDirectAcquisition || false,
              requestType: pr.requestType || "PURCHASE",
              requestedBySignatoryId: pr.requestedBySignatoryId || "",
              lineItems: pr.lineItems.map((li: any) => ({
                itemId: li.itemId,
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitCost: li.unitCost
              }))
            });
          } else {
            toast.error("Failed to load PR");
            router.push("/purchase-requests");
          }
        } else if (searchParams.get("duplicateFrom")) {
          const duplicateId = searchParams.get("duplicateFrom");
          const prRes = await fetch(`/api/purchase-requests/${duplicateId}`);
          if (prRes.ok) {
            const pr = await prRes.json();
            reset({
              prNumber: "",
              fiscalYear: pr.fiscalYear || new Date().getFullYear(),
              officeId: pr.officeId || "",
              fundSourceId: pr.fundSourceId || "",
              purpose: `[COPY] ${pr.purpose || ""}`,
              chargeToAccount: pr.chargeToAccount || "",
              isDirectAcquisition: pr.isDirectAcquisition || false,
              requestType: pr.requestType || "PURCHASE",
              requestedBySignatoryId: pr.requestedBySignatoryId || "",
              lineItems: pr.lineItems.map((li: any) => ({
                itemId: li.itemId,
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitCost: li.unitCost
              }))
            });
            toast.success("Loaded PR data for duplication");
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load reference data");
      } finally {
        setLoading(false);
      }
    }

    if (session) loadData();
  }, [isNew, params.id, reset, router, session]);

  interface SpecItemRef {
    rawIndex: number;
    item: PrLineItem;
  }

  interface MainItemRef {
    mainIndex: number;
    rawIndex: number;
    displayNo: number;
    item: PrLineItem;
    specs: SpecItemRef[];
  }

  const mainItems = useMemo<MainItemRef[]>(() => {
    const list: MainItemRef[] = [];
    let currentMain: MainItemRef | null = null;
    let counter = 0;

    (watchLineItems || []).forEach((it, idx) => {
      const isEmpty =
        !it.description?.trim() &&
        (!it.quantity || Number(it.quantity) === 0) &&
        (!it.unitCost || Number(it.unitCost) === 0);

      if (isEmpty) {
        // Completely empty rows are NOT specification lines and NOT items!
        return;
      }

      const isSpec = !it.quantity || Number(it.quantity) === 0;
      if (!isSpec || !currentMain) {
        counter++;
        currentMain = {
          mainIndex: list.length,
          rawIndex: idx,
          displayNo: counter,
          item: it,
          specs: [],
        };
        list.push(currentMain);
      } else {
        currentMain.specs.push({
          rawIndex: idx,
          item: it,
        });
      }
    });

    return list;
  }, [watchLineItems]);

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

  const updateItemAt = (index: number, updates: Partial<PrLineItem>) => {
    const current = [...(watchLineItems || [])];
    if (!current[index]) return;
    current[index] = { ...current[index], ...updates };
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    setInsertAtIndex(null);
    const item = watchLineItems && watchLineItems[index];
    const isEmpty =
      !item ||
      (!item.description?.trim() &&
        (!item.quantity || Number(item.quantity) === 0) &&
        (!item.unitCost || Number(item.unitCost) === 0));

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
        if (watchLineItems[i]?.quantity && Number(watchLineItems[i].quantity) > 0) {
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
    const current = [...(watchLineItems || [])];
    const newItem: PrLineItem = {
      itemId: null,
      description: "",
      unit: "Unit",
      quantity: 1,
      unitCost: "",
    };
    current.push(newItem);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(current.length - 1);
    setActiveSpecIndex(null);
    setPanelView("item");
  };

  const handleAddSpecLine = (main: MainItemRef) => {
    if (isReadOnly) return;
    const current = [...(watchLineItems || [])];
    const lastSpecRawIdx = main.specs.length > 0 ? main.specs[main.specs.length - 1].rawIndex : main.rawIndex;
    const insertAt = lastSpecRawIdx + 1;
    const newSpec: PrLineItem = {
      itemId: null,
      description: "",
      unit: "",
      quantity: "",
      unitCost: "",
    };
    current.splice(insertAt, 0, newSpec);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(main.rawIndex);
    setActiveSpecIndex(insertAt);
    setPanelView("spec");
    toast.success("Specification line added");
  };

  const handleDeleteMainItem = (main: MainItemRef) => {
    if (isReadOnly) return;
    const current = [...(watchLineItems || [])];
    const countToRemove = 1 + main.specs.length;
    current.splice(main.rawIndex, countToRemove);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(null);
    setActiveSpecIndex(null);
    setPanelView("details");
    toast.success("Item deleted");
  };

  const handleDeleteSpecLine = (specRawIndex: number | null) => {
    if (isReadOnly || specRawIndex === null) return;
    const current = [...(watchLineItems || [])];
    current.splice(specRawIndex, 1);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveSpecIndex(null);
    setPanelView("item");
    toast.success("Specification line deleted");
  };

  const handleInsertAboveMain = (main: MainItemRef) => {
    if (isReadOnly) return;
    const current = [...(watchLineItems || [])];
    const newItem: PrLineItem = {
      itemId: null,
      description: "",
      unit: "Unit",
      quantity: 1,
      unitCost: "",
    };
    current.splice(main.rawIndex, 0, newItem);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(main.rawIndex);
    setActiveSpecIndex(null);
    toast.success("Item inserted above");
  };

  const handleInsertBelowMain = (main: MainItemRef) => {
    if (isReadOnly) return;
    const current = [...(watchLineItems || [])];
    const insertPos = main.rawIndex + main.specs.length + 1;
    const newItem: PrLineItem = {
      itemId: null,
      description: "",
      unit: "Unit",
      quantity: 1,
      unitCost: "",
    };
    current.splice(insertPos, 0, newItem);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(insertPos);
    setActiveSpecIndex(null);
    toast.success("Item inserted below");
  };

  const handleMoveMainUp = (main: MainItemRef) => {
    if (isReadOnly || main.mainIndex <= 0) return;
    const prevMain = mainItems[main.mainIndex - 1];
    if (!prevMain) return;
    const current = [...(watchLineItems || [])];
    const blockLength = 1 + main.specs.length;
    const extracted = current.splice(main.rawIndex, blockLength);
    current.splice(prevMain.rawIndex, 0, ...extracted);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(prevMain.rawIndex);
    setActiveSpecIndex(null);
    toast.success("Moved up");
  };

  const handleMoveMainDown = (main: MainItemRef) => {
    if (isReadOnly || main.mainIndex >= mainItems.length - 1) return;
    const nextMain = mainItems[main.mainIndex + 1];
    if (!nextMain) return;
    const current = [...(watchLineItems || [])];
    const blockLength = 1 + main.specs.length;
    const nextBlockLength = 1 + nextMain.specs.length;
    const extracted = current.splice(main.rawIndex, blockLength);
    current.splice(main.rawIndex + nextBlockLength, 0, ...extracted);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveItemIndex(main.rawIndex + nextBlockLength);
    setActiveSpecIndex(null);
    toast.success("Moved down");
  };

  const handleInsertSpecAbove = (specRawIndex: number | null) => {
    if (isReadOnly || specRawIndex === null) return;
    const current = [...(watchLineItems || [])];
    const newSpec: PrLineItem = {
      itemId: null,
      description: "",
      unit: "",
      quantity: "",
      unitCost: "",
    };
    current.splice(specRawIndex, 0, newSpec);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveSpecIndex(specRawIndex);
    toast.success("Specification line inserted");
  };

  const handleInsertSpecBelow = (specRawIndex: number | null) => {
    if (isReadOnly || specRawIndex === null) return;
    const current = [...(watchLineItems || [])];
    const newSpec: PrLineItem = {
      itemId: null,
      description: "",
      unit: "",
      quantity: "",
      unitCost: "",
    };
    current.splice(specRawIndex + 1, 0, newSpec);
    setValue("lineItems", current, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setActiveSpecIndex(specRawIndex + 1);
    toast.success("Specification line inserted");
  };

  const handleStartInsert = (index: number) => {
    if (isReadOnly) return;
    setActiveItemIndex(null);
    setInsertAtIndex(index);
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    if (isReadOnly) return;
    if (toIndex < 0 || toIndex >= watchLineItems.length) return;
    move(fromIndex, toIndex);
    setActiveItemIndex(toIndex);
    toast.success(`Moved to row ${toIndex + 1}`);
  };

  const onSubmit = async (data: PRFormValues) => {
    if (!data.officeId) {
      toast.error("Please select a Requesting Office");
      return;
    }
    if (!data.purpose?.trim()) {
      toast.error("Purpose is required");
      return;
    }
    // Clean up empty lines before validating/saving
    const cleanedLineItems = (data.lineItems || [])
      .map(item => ({
        ...item,
        quantity: item.quantity === "" ? 0 : Number(item.quantity) || 0,
        unitCost: item.unitCost === "" ? 0 : Number(item.unitCost) || 0,
      }))
      .filter(item => (item.description && item.description.trim() !== "") || item.quantity > 0 || item.unitCost > 0);

    if (cleanedLineItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const rawPrNumber = data.prNumber?.trim();
    const normalizedPrNumber = rawPrNumber ? normalizePrNumber(rawPrNumber) : null;
    const payload = {
      ...data,
      lineItems: cleanedLineItems,
      prNumber: normalizedPrNumber,
      fiscalYear: Number(data.fiscalYear) || (normalizedPrNumber ? fiscalYearFromPrNumber(normalizedPrNumber) : null) || new Date().getFullYear(),
      officeId: data.officeId,
      purpose: data.purpose.trim(),
      fundSourceId: data.fundSourceId || null,
      requestedBySignatoryId: data.requestedBySignatoryId || null,
      chargeToAccount: data.chargeToAccount || null,
    };

    setSubmitting(true);
    try {
      const url = isNew ? "/api/purchase-requests" : `/api/purchase-requests/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errMsg = errorData.error || "Failed to save";
        if (errorData.details) {
          const fieldErrors: string[] = [];
          for (const [key, val] of Object.entries(errorData.details)) {
            if (key !== "_errors" && (val as any)?._errors?.length) {
              fieldErrors.push(`${key}: ${(val as any)._errors.join(", ")}`);
            }
          }
          if (fieldErrors.length > 0) {
            errMsg = fieldErrors.join(" | ");
          }
        }
        throw new Error(errMsg);
      }

      const result = await res.json();
      toast.success(isNew ? "PR created successfully" : "PR updated successfully");

      if (isNew) {
        markClean();
        router.push(`/purchase-requests/${result.id}`);
      } else {
        setPrData(result);
        setLastSaved(new Date());
        markClean();
        if (result.lastSavedBy) {
          setLastSavedBy(result.lastSavedBy);
        } else if (session?.user?.name) {
          setLastSavedBy(session.user.name);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/purchase-requests/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      const result = await res.json();
      setPrData(result);
      toast.success(`Status updated to ${status}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handlePrint = async () => {
    if (!isNew) {
      await fetch(`/api/purchase-requests/${params.id}/print`, { method: "POST" });
    }
    window.print();
  };

  const isReadOnly = isViewMode || (!isNew && !isUnlocked);
  const { markClean, UnsavedChangesModal } = useUnsavedChanges(
    JSON.stringify(watchAllFields),
    !loading,
    isReadOnly
  );

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

  if (loading) return <LoaderWave variant="page" label="Loading purchase request..." />;

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 bg-[#e9edf4] w-full max-w-full min-w-0 overflow-hidden flex-1 print:!block print:!h-auto print:!overflow-visible print:!m-0 print:!p-0 print:!bg-white print:!w-full print:!max-w-none" style={{ height: 'calc(var(--full-vh) - 88px)' }}>
      {/* Header Card */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-200/60 px-5 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/back">
            <Link
              href="/purchase-requests"
              aria-label="Back to Purchase Requests"
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft size={18} />
            </Link>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/back:block group-focus-within/back:block z-30 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap"
            >
              Back to Purchase Requests
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {isNew
                ? (isJob ? "New Job Request" : "New Purchase Request")
                : (prData?.prNumber?.trim()
                  ? prData.prNumber.trim()
                  : (isJob ? "Untitled JR" : "Untitled PR"))}
            </h2>
            {isReadOnly ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="text-emerald-700" />
                  LOCKED
                </span>
                {getSavedTimeText() && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span>{getSavedTimeText()}</span>
                    {lastSavedBy && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium">by <strong className="font-semibold text-slate-700">{lastSavedBy}</strong></span>
                      </>
                    )}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  {isNew ? "NEW" : "DRAFT"}
                </span>
                {getSavedTimeText() && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>{getSavedTimeText()}</span>
                    {lastSavedBy && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium">by <strong className="font-semibold text-slate-700">{lastSavedBy}</strong></span>
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Link
                href={`/procurement-folders/${params.id}`}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FolderOpen size={17} className="text-slate-600" />
                <span>Folder</span>
              </Link>
              <div className="h-5 w-px bg-slate-200 mx-1" />
            </>
          )}

          {!isViewMode && !isNew && (
            <button
              type="button"
              onClick={() => isUnlocked ? setIsUnlocked(false) : setUnlockModalOpen(true)}
              className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {isUnlocked ? <><Lock size={16} /> Lock</> : <><Unlock size={16} /> Unlock</>}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
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
        </div>
      </div>

      {prData?.isDirectAcquisition && (
        <div className="no-print bg-[#f0fdfa] border border-[#99f6e4] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#115e59] shadow-sm font-medium shrink-0">
          <CheckCircle2 size={15} className="text-[#0d9488] shrink-0" />
          <span>
            <strong className="font-bold">Direct Acquisition:</strong> This Purchase Request is marked as a direct acquisition. It will bypass the RFQ and abstract steps and proceed directly to Purchase Order generation.
          </span>
        </div>
      )}

      {prData?.calendarEvents?.find((e: any) => e.eventType === "Award Date") && (
        <div className="no-print bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#166534] shadow-sm font-medium shrink-0">
          <Calendar size={15} className="text-[#16a34a] shrink-0" />
          <span>
            <strong className="font-bold">Award Scheduled:</strong> The Award Date for this procurement is scheduled for <strong>{new Date(prData.calendarEvents.find((e: any) => e.eventType === "Award Date").eventDate).toLocaleDateString("en-PH", { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
          </span>
        </div>
      )}

      {isReadOnly && (
        <div className="no-print bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl px-5 py-2.5 flex items-center gap-2.5 text-xs text-[#065f46] shadow-sm font-medium shrink-0">
          <Lock size={15} className="text-[#059669] shrink-0" />
          <span>
            <strong className="font-bold">This Purchase Request is locked.</strong> Unlock it to make changes.
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
            <button type="button" onClick={() => setTargetRows(r => r + 1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Add Row"><Plus size={18} /></button>
          </div>

          <div className="flex-1 w-full min-w-0 max-w-full overflow-auto p-4 sm:p-6 md:p-8 print:!p-0 print:!m-0 print:!bg-white print:!block print:!overflow-visible print:!h-auto print:!w-full">
            <div className="w-fit min-w-full flex justify-center print:!block print:!w-full">
              <div
                className="shrink-0 print:!block print:!w-full print:min-w-0 print:!transform-none print:!m-0 print:!p-0"
                style={{
                  width: `${Math.round(794 * zoom + 64)}px`,
                  minHeight: `${Math.round(1123 * zoom + 64)}px`,
                  display: "flex",
                  justifyContent: "center",
                  padding: "1.5rem 2rem 3rem 2rem",
                }}
              >
                <div
                  style={{
                    width: "794px",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease-out",
                    marginBottom: `${Math.max(0, (zoom - 1) * 1123)}px`,
                  }}
                  className="print:!transform-none print:!w-full print:!mb-0"
                >
                  <div className="print-area text-black w-[794px] bg-white shadow-xl min-h-[1123px] p-10 print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0 print:min-h-0">
                    {/* PR Standard Form Layout */}
                    <div className="text-right font-bold text-lg mb-2">Annex 30</div>

                    <div className="border-3 border-black">
                      {/* Title Block */}
                      <div className="text-center p-4 border-b-4 border-double border-black">
                        <h2 className="font-extrabold text-3xl uppercase tracking-wide mb-1">{isJob ? "Job Request" : "Purchase Request"}</h2>
                        <div className="text-sm font-semibold underline decoration-black">
                          Municipality of Pandan, Antique
                        </div>
                        <div className="text-sm italic font-medium">
                          LGU
                        </div>
                      </div>

                      {/* Grid Block */}
                      <div className="grid grid-cols-2 text-sm border-b-4 border-double border-black">
                        <div className="border-r-2 border-black p-2 flex flex-col justify-center">
                          <div className="flex mb-2"><span className="w-24 whitespace-nowrap">Department :</span> <span className="border-b border-black flex-1 text-left">{offices.find(o => o.id === watchAllFields.officeId)?.name || "Office of the Mayor"}</span></div>
                          <div className="flex"><span className="w-24 whitespace-nowrap">Section :</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                        </div>
                        <div className="p-2 flex flex-col justify-between">
                          <div className="flex mb-2"><span className="w-20">{isJob ? "JR No.:" : "PR No.:"}</span> <span className="border-b border-black flex-1 text-center">{showPrNo ? (watchAllFields.prNumber || prData?.prNumber || "") : ""}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center"></span></div>
                          <div className="flex mb-2"><span className="w-20">SAI No.:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                          <div className="flex"><span className="w-20">ALOBS No.:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span> <span className="w-12 ml-2">Date:</span> <span className="border-b border-black flex-1 text-center">{"\u00A0"}</span></div>
                        </div>
                      </div>

                      {/* Excel-style Live Table Grid */}
                      <div ref={gridWrapperRef}>
                        <ExcelTableGrid
                          items={watchLineItems}
                          targetRows={targetRows}
                          isReadOnly={isReadOnly}
                          onChange={(newItems) => {
                            setValue("lineItems", newItems, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                          }}
                          onRowSelect={(idx) => {
                            handleRowClick(idx);
                          }}
                          onStartInsert={(idx) => {
                            handleStartInsert(idx);
                          }}
                          insertAtIndex={insertAtIndex}
                          activeItemIndex={activeSpecIndex !== null ? activeSpecIndex : activeItemIndex}
                          totalAmount={totalAmount}
                          onDeselect={() => {
                            setActiveItemIndex(null);
                            setActiveSpecIndex(null);
                            setPanelView("details");
                          }}
                        />
                      </div>

                      {/* Purpose Block - Multi-line responsive and inline-editable */}
                      <div className="p-3 text-sm flex gap-2 border-b-4 border-double border-black">
                        <span className="shrink-0 italic font-semibold">Purpose: </span>
                        <div className="flex-1 flex flex-col gap-1 mt-0.5">
                          {/* Line 1 */}
                          <div className="border-b border-black text-left min-h-[1.5rem] relative flex items-center">
                            <input
                              ref={line0Ref}
                              type="text"
                              value={purposeLines[0]}
                              onChange={(e) => handlePurposeLineChange(0, e.target.value)}
                              onKeyDown={(e) => handlePurposeLineKeyDown(0, e)}
                              disabled={isReadOnly}
                              placeholder={isReadOnly ? "" : "Enter purpose..."}
                              className="w-full bg-transparent border-none outline-none text-left px-1 text-sm font-normal text-black placeholder:text-slate-300 placeholder:italic print:hidden cursor-text"
                              style={{ lineHeight: "1.2rem", height: "1.3rem" }}
                            />
                            <span className="hidden print:block absolute left-0 right-0 -top-1 whitespace-nowrap overflow-hidden text-ellipsis px-1 text-sm text-black">
                              {purposeLines[0] || "\u00A0"}
                            </span>
                          </div>

                          {/* Line 2 */}
                          <div className="border-b border-black text-left min-h-[1.5rem] relative flex items-center">
                            <input
                              ref={line1Ref}
                              type="text"
                              value={purposeLines[1]}
                              onChange={(e) => handlePurposeLineChange(1, e.target.value)}
                              onKeyDown={(e) => handlePurposeLineKeyDown(1, e)}
                              disabled={isReadOnly}
                              placeholder={isReadOnly ? "" : "Click to enter 2nd line..."}
                              className="w-full bg-transparent border-none outline-none text-left px-1 text-sm font-normal text-black placeholder:text-slate-300 placeholder:italic print:hidden cursor-text"
                              style={{ lineHeight: "1.2rem", height: "1.3rem" }}
                            />
                            <span className="hidden print:block absolute left-0 right-0 -top-1 whitespace-nowrap overflow-hidden text-ellipsis px-1 text-sm text-black">
                              {purposeLines[1] || "\u00A0"}
                            </span>
                          </div>

                          {/* Line 3 */}
                          <div className="border-b border-black text-left min-h-[1.5rem] relative flex items-center">
                            <input
                              ref={line2Ref}
                              type="text"
                              value={purposeLines[2]}
                              onChange={(e) => handlePurposeLineChange(2, e.target.value)}
                              onKeyDown={(e) => handlePurposeLineKeyDown(2, e)}
                              disabled={isReadOnly}
                              placeholder={isReadOnly ? "" : "Click to enter 3rd line..."}
                              className="w-full bg-transparent border-none outline-none text-left px-1 text-sm font-normal text-black placeholder:text-slate-300 placeholder:italic print:hidden cursor-text"
                              style={{ lineHeight: "1.2rem", height: "1.3rem" }}
                            />
                            <span className="hidden print:block absolute left-0 right-0 -top-1 whitespace-nowrap overflow-hidden text-ellipsis px-1 text-sm text-black">
                              {purposeLines[2] || "\u00A0"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Signatures Block */}
                      <table className="w-full border-collapse text-xs text-center border-t-0 table-fixed">
                        <colgroup>
                          <col className="w-[16%]" />
                          <col className="w-[27.33%]" />
                          <col className="w-[24%]" />
                          <col className="w-[27.33%]" />
                        </colgroup>
                        <tbody>
                          <tr>
                            <td className="border border-black border-l-0 border-t-0 py-0 px-1"></td>
                            <td className="border border-black border-t-0 py-0 px-1 leading-tight font-bold sign-text">Requested by:</td>
                            <td className="border border-black border-t-0 py-0 px-1 leading-tight font-bold sign-text">Cash availability:</td>
                            <td className="border border-black border-t-0 border-r-0 py-0 px-1 leading-tight font-bold sign-text">Approved by:</td>
                          </tr>
                          <tr className="border-none">
                            <td className="border border-black border-l-0 border-b-0 py-0 px-1 pl-2 italic text-left align-top h-[30px] text-[13px]">Signature:</td>
                            <td className="border border-black py-0 px-1"></td>
                            <td className="border border-black py-0 px-1"></td>
                            <td className="border border-black border-r-0 py-0 px-1"></td>
                          </tr>
                          <tr className="border-none">
                            <td className="border border-black border-l-0 border-y-0 py-0 px-1 pl-2 italic text-left text-[13px] leading-tight">Printed Name:</td>
                            <td className="border border-black py-1 px-1 font-bold uppercase text-[12px] leading-tight">
                              {signatories.find(s => s.id === watchAllFields.requestedBySignatoryId)?.name || ""}
                            </td>
                            <td className="border border-black py-1 px-1 font-bold uppercase text-[12px] leading-tight">EDSEL J. AMBUBUYOG</td>
                            <td className="border border-black border-r-0 py-1 px-1 font-bold uppercase text-[12px] leading-tight">HON. TOMAS U. ESTOPEREZ JR.</td>
                          </tr>
                          <tr className="border-none">
                            <td className="border border-black border-l-0 border-t-0 border-b-0 py-0 px-1 pl-2 italic text-left h-[30px] text-[13px] leading-tight">Designation:</td>
                            <td className="border border-black border-b-0 py-0 px-1 text-[13px] leading-tight">
                              {signatories.find(s => s.id === watchAllFields.requestedBySignatoryId)?.position || ""}
                            </td>
                            <td className="border border-black border-b-0 py-0 px-1 text-[13px] leading-tight">Municipal Treasurer</td>
                            <td className="border border-black border-b-0 border-r-0 py-0 px-1 text-[13px] leading-tight">Municipal Mayor</td>
                          </tr>
                        </tbody>
                      </table>
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
                flexShrink: 0
              }}
              className="no-print pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Right Side: Data Entry Form */}
        <div ref={rightPanelRef} className="no-print w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-3 shrink-0">
            <h2 className="text-base font-bold text-slate-900">
              {isJob ? "Job Request Details" : "Purchase Request Details"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the document is locked."
                : isNew
                  ? `Edit the details for the ${isJob ? "job request" : "purchase request"}.`
                  : `Update the details for the ${isJob ? "job request" : "purchase request"}.`}
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
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => !isReadOnly && setValue("requestType", "PURCHASE")}
                        disabled={isReadOnly}
                        className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center ${!isJob
                          ? "bg-white text-blue-600 shadow-sm border border-slate-200/60"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        <span>Purchase Request</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !isReadOnly && setValue("requestType", "JOB")}
                        disabled={isReadOnly}
                        className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center ${isJob
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        <span>Job Request</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-xs">
                      {isJob ? "JR Number" : "PR Number"}
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      {...register("prNumber")}
                      disabled={isReadOnly}
                      onBlur={(e) => {
                        const val = e.target.value?.trim();
                        if (val) {
                          const normalized = normalizePrNumber(val);
                          setValue("prNumber", normalized);
                          const derivedYear = fiscalYearFromPrNumber(normalized);
                          if (derivedYear) {
                            setValue("fiscalYear", derivedYear);
                          }
                        }
                      }}
                      placeholder="e.g. 26-01-001"
                      className="form-input font-mono font-bold text-sm bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Leave blank if not yet assigned by custodian.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <input
                      type="checkbox"
                      id="showPrNoCheckbox"
                      checked={showPrNo}
                      onChange={(e) => setShowPrNo(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="showPrNoCheckbox" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                      Print {isJob ? "JR" : "PR"} number on the document
                    </label>
                  </div>
                </div>

                {/* Card 2: OFFICE AND SIGNATORY */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    OFFICE AND SIGNATORY
                  </div>
                  <div>
                    <label className="form-label text-xs">Requesting office *</label>
                    <CustomSelect
                      value={watchAllFields.officeId || ""}
                      onChange={(val) => setValue("officeId", val, { shouldValidate: true, shouldDirty: true })}
                      options={offices.map((o) => ({ value: o.id, label: o.name }))}
                      placeholder="Select Office..."
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs">Requested by *</label>
                    <CustomSelect
                      value={watchAllFields.requestedBySignatoryId || ""}
                      onChange={(val) => setValue("requestedBySignatoryId", val, { shouldValidate: true, shouldDirty: true })}
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
                    <label className="form-label text-xs">Purpose *</label>
                    <textarea
                      {...register("purpose")}
                      className="form-input text-xs"
                      style={{ minHeight: "70px", resize: "vertical" }}
                      placeholder="Enter purpose of procurement..."
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Card 3: PROCUREMENT METHOD */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    PROCUREMENT METHOD
                  </div>
                  <div className="space-y-1.5">
                    <label
                      onClick={() => !isReadOnly && setValue("isDirectAcquisition", false)}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${!watchAllFields.isDirectAcquisition
                          ? "border-blue-400 bg-blue-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                      <input
                        type="radio"
                        checked={!watchAllFields.isDirectAcquisition}
                        onChange={() => !isReadOnly && setValue("isDirectAcquisition", false)}
                        disabled={isReadOnly}
                        className="w-4 h-4 text-blue-600 mt-0.5 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Standard</div>
                        <div className="text-[11px] text-slate-500">RFQ and Abstract of Canvass.</div>
                      </div>
                    </label>

                    <label
                      onClick={() => !isReadOnly && setValue("isDirectAcquisition", true)}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${watchAllFields.isDirectAcquisition
                          ? "border-blue-400 bg-blue-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                      <input
                        type="radio"
                        checked={!!watchAllFields.isDirectAcquisition}
                        onChange={() => !isReadOnly && setValue("isDirectAcquisition", true)}
                        disabled={isReadOnly}
                        className="w-4 h-4 text-blue-600 mt-0.5 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Direct Acquisition</div>
                        <div className="text-[11px] text-slate-500">Skips RFQ and abstract phases.</div>
                      </div>
                    </label>
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

                {/* Catalog Item */}
                <div>
                  <label className="form-label text-xs">Catalog item <span className="font-normal text-slate-400">(optional)</span></label>
                  <CustomSelect
                    value={activeMain.item.itemId || ""}
                    onChange={(val) => {
                      const found = items.find(i => i.id === val);
                      if (found) {
                        updateItemAt(activeMain.rawIndex, {
                          itemId: val,
                          description: found.description,
                          unit: found.unit || "Unit",
                          unitCost: found.standardCost || 0,
                          quantity: (!activeMain.item.quantity || activeMain.item.quantity === 0) ? 1 : activeMain.item.quantity,
                        });
                      } else {
                        updateItemAt(activeMain.rawIndex, { itemId: null });
                      }
                    }}
                    options={[
                      { value: "", label: "-- Custom Item --" },
                      ...items.map((item) => ({
                        value: item.id,
                        label: item.description,
                        sublabel: item.unit ? `${item.unit} · ₱${Number(item.standardCost || 0).toLocaleString()}` : undefined,
                      })),
                    ]}
                    placeholder="Search catalog..."
                    disabled={isReadOnly}
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="form-label text-xs">Description *</label>

                  </div>
                  <textarea
                    rows={2}
                    value={activeMain.item.description || ""}
                    onChange={(e) => updateItemAt(activeMain.rawIndex, { description: e.target.value })}
                    onKeyDown={(e) =>
                      handleTextFormattingKeyDown(e, (newVal) =>
                        updateItemAt(activeMain.rawIndex, { description: newVal })
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
                      const isSelected = (activeMain.item.unit || "").toLowerCase() === u.toLowerCase();
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

                {/* Qty & Unit cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-xs">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={activeMain.item.quantity ?? ""}
                      onChange={(e) => updateItemAt(activeMain.rawIndex, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="form-input text-sm"
                      placeholder="0"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs">Unit cost</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-xs">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={activeMain.item.unitCost ?? ""}
                        onChange={(e) => updateItemAt(activeMain.rawIndex, { unitCost: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="form-input text-sm pl-7 text-right"
                        placeholder="0.00"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                </div>

                {/* Line total */}
                <div className="flex items-center justify-between py-2.5 border-y border-slate-100 text-xs">
                  <span className="text-slate-600 font-medium">Line total</span>
                  <span className="text-slate-900 font-bold text-sm">
                    {formatCurrency((Number(activeMain.item.quantity) || 0) * (Number(activeMain.item.unitCost) || 0))}
                  </span>
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
                      const specIdx = activeMain.specs.findIndex((s) => s.rawIndex === activeSpec.rawIndex);
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
                    rows={2}
                    value={activeSpec.item.description || ""}
                    onChange={(e) => updateItemAt(activeSpec.rawIndex, { description: e.target.value })}
                    onKeyDown={(e) =>
                      handleTextFormattingKeyDown(e, (newVal) =>
                        updateItemAt(activeSpec.rawIndex, { description: newVal })
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
                <span className="text-base font-extrabold text-emerald-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
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
        message="Are you sure you want to save these changes to the Purchase Request?"
        confirmText="Save Changes"
      />

      <ConfirmModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        title="Unlock Document"
        message="This document is locked. Are you sure you want to unlock it for editing?"
        confirmText="Unlock Document"
        isDestructive={true}
      />

      {UnsavedChangesModal}
    </div>
  );
}
