"use client";
import LoaderWave from "@/components/ui/loader-wave";
import CustomSelect from "@/components/ui/custom-select";
import ConfirmModal from "@/components/ui/confirm-modal";
import { ExcelTableGrid } from "@/components/documents/excel-table-grid";

import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { formatCurrency, normalizePrNumber, fiscalYearFromPrNumber } from "@/lib/utils";
import { Printer, Save, CheckCircle2, Plus, Minus, Trash2, ArrowLeft, Loader2, ZoomIn, ZoomOut, Lock, Unlock, FolderOpen, Calendar, MoveUp, MoveDown, CornerDownRight } from "lucide-react";
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

  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState<PrLineItem>({
    itemId: "",
    description: "",
    unit: "",
    quantity: "",
    unitCost: "",
  });

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

  const handleItemSelect = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setDraftItem({
        ...(draftItem || {}),
        itemId,
        description: item.description,
        unit: item.unit,
        unitCost: item.standardCost,
        quantity: (!draftItem || draftItem.quantity === "") ? 1 : draftItem.quantity
      });
    } else {
      setDraftItem({ ...(draftItem || {}), itemId: "" });
    }
  };

  const handleRowClick = (index: number) => {
    if (isReadOnly) return;
    setInsertAtIndex(null);
    const item = watchLineItems && watchLineItems[index];
    if (item) {
      setActiveItemIndex(index);
      setDraftItem({
        itemId: item.itemId || "",
        description: item.description || "",
        unit: item.unit || "",
        quantity: item.quantity ?? "",
        unitCost: item.unitCost ?? "",
      });
    } else {
      setActiveItemIndex(null);
      setDraftItem({
        itemId: "",
        description: "",
        unit: "",
        quantity: "",
        unitCost: "",
      });
    }
  };

  const handleStartInsert = (index: number) => {
    if (isReadOnly) return;
    setActiveItemIndex(null);
    setInsertAtIndex(index);
    setDraftItem({ itemId: "", description: "", unit: "", quantity: "", unitCost: "" });
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    if (isReadOnly) return;
    if (toIndex < 0 || toIndex >= watchLineItems.length) return;
    move(fromIndex, toIndex);
    setActiveItemIndex(toIndex);
    toast.success(`Moved to row ${toIndex + 1}`);
  };

  const handleAddOrUpdate = () => {
    if (!draftItem.description) {
      toast.error("Description is required");
      return;
    }
    if (Number(draftItem.quantity) < 0) {
      toast.error("Quantity cannot be negative");
      return;
    }

    const itemToAdd = {
      ...draftItem,
      quantity: Number(draftItem.quantity) || 0,
      unitCost: Number(draftItem.unitCost) || 0,
    };

    if (activeItemIndex !== null) {
      update(activeItemIndex, itemToAdd);
      toast.success("Item updated");
    } else if (insertAtIndex !== null) {
      insert(insertAtIndex, itemToAdd);
      toast.success(`Item inserted at row ${insertAtIndex + 1}`);
    } else {
      append(itemToAdd);
      toast.success("Item added");
    }
    handleClearDraft();
  };

  const handleClearDraft = () => {
    setActiveItemIndex(null);
    setInsertAtIndex(null);
    setDraftItem({ itemId: "", description: "", unit: "", quantity: "", unitCost: "" });
  };

  const handleDeleteItem = () => {
    if (activeItemIndex !== null) {
      remove(activeItemIndex);
      handleClearDraft();
      toast.success("Item deleted");
    }
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
        router.push(`/purchase-requests/${result.id}`);
      } else {
        setPrData(result);
        setLastSaved(new Date());
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
                        activeItemIndex={activeItemIndex}
                        totalAmount={totalAmount}
                      />

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
        <div className="no-print w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
          <div className="p-5 pb-3 shrink-0">
            <h2 className="text-base font-bold text-slate-900">
              {isJob ? "Job Request Details" : "Purchase Request Details"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isReadOnly
                ? "Read-only while the document is locked."
                : "Update the details for the purchase request."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-0">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              {/* Type Toggle: Purchase Request vs Job Request */}
              <div>
                <label className="form-label">Request Type</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setValue("requestType", "PURCHASE")}
                    disabled={isReadOnly}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${!isJob
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
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${isJob
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <span>Job Request</span>
                  </button>
                </div>
              </div>

              {/* Document Numbering */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      {isJob ? "JR Number" : "PR Number"}
                    </label>
                  </div>
                  <input
                    type="text"
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
                  <p className="text-[10px] text-slate-500 mt-1">
                    Leave blank if not yet assigned by custodian. Can be updated at any time.
                  </p>
                </div>

                {/* Show/Hide Document Number on Document Toggle */}
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

              <div>
                <label className="form-label">Requesting Office</label>
                <CustomSelect
                  value={watchAllFields.officeId || ""}
                  onChange={(val) => setValue("officeId", val, { shouldValidate: true, shouldDirty: true })}
                  options={offices.map((o) => ({ value: o.id, label: o.name }))}
                  placeholder="Select Office..."
                  disabled={isReadOnly}
                />
              </div>

              <div>
                <label className="form-label">Requested By (Signatory)</label>
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
                <label className="form-label">Purpose</label>
                <textarea
                  {...register("purpose")}
                  className="form-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Enter purpose of procurement..."
                  disabled={isReadOnly}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="isDirectAcquisition"
                  {...register("isDirectAcquisition")}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDirectAcquisition" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Direct Acquisition <span className="text-xs text-slate-500 font-normal">(Skips RFQ and abstract phases)</span>
                </label>
              </div>

              <div style={{ paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontWeight: "700", color: "#334155", fontSize: "0.9375rem" }}>
                    {activeItemIndex !== null
                      ? `Edit Item (Row ${activeItemIndex + 1})`
                      : insertAtIndex !== null
                        ? `Insert Item (Row ${insertAtIndex + 1})`
                        : "Add New Item"}
                  </h3>
                  {(activeItemIndex !== null || insertAtIndex !== null) && !isReadOnly && (
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isReadOnly && (
                  <>
                    {/* Action Toolbar when editing an existing row */}
                    {activeItemIndex !== null && (
                      <div className="flex flex-wrap items-center gap-1.5 p-2 mb-3 bg-slate-100/80 border border-slate-200 rounded-xl text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Insert / Reorder:</span>
                        <button
                          type="button"
                          onClick={() => handleStartInsert(activeItemIndex)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 shadow-2xs transition-colors"
                          title="Insert a new row immediately above this item"
                        >
                          <Plus size={12} className="text-blue-600" /> Insert Above
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartInsert(activeItemIndex + 1)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 shadow-2xs transition-colors"
                          title="Insert a new row immediately below this item"
                        >
                          <CornerDownRight size={12} className="text-blue-600" /> Insert Below
                        </button>
                        <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />
                        <button
                          type="button"
                          disabled={activeItemIndex === 0}
                          onClick={() => handleMoveItem(activeItemIndex, activeItemIndex - 1)}
                          className="inline-flex items-center gap-1 px-2 py-1 font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none shadow-2xs transition-colors"
                          title="Move this item up"
                        >
                          <MoveUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={activeItemIndex === watchLineItems.length - 1}
                          onClick={() => handleMoveItem(activeItemIndex, activeItemIndex + 1)}
                          className="inline-flex items-center gap-1 px-2 py-1 font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none shadow-2xs transition-colors"
                          title="Move this item down"
                        >
                          <MoveDown size={12} />
                        </button>
                      </div>
                    )}

                    {/* Highlight banner when in Insertion Mode */}
                    {insertAtIndex !== null && (
                      <div className="mb-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {insertAtIndex + 1}
                          </div>
                          <div>
                            <span className="font-bold">
                              Inserting at Row {insertAtIndex + 1}
                            </span>
                            <p className="text-[11px] text-blue-700">
                              {insertAtIndex === 0
                                ? "At the very top (before Row 1)"
                                : `Between Row ${insertAtIndex} and Row ${insertAtIndex + 1}`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearDraft}
                          className="text-xs font-semibold px-2 py-1 rounded bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
                        >
                          Reset to End
                        </button>
                      </div>
                    )}

                    {/* Position selector when adding new items */}
                    {activeItemIndex === null && insertAtIndex === null && watchLineItems.length > 0 && (
                      <div className="flex items-center justify-between mb-3 px-1 text-xs">
                        <span className="text-slate-500 font-medium">Position:</span>
                        <select
                          value="end"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "end") {
                              handleStartInsert(Number(val));
                            }
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold focus:outline-blue-500 cursor-pointer shadow-2xs max-w-[240px] truncate"
                        >
                          <option value="end">At the end (Row {watchLineItems.length + 1})</option>
                          <option value="0">At the top (before Row 1)</option>
                          {watchLineItems.map((it, i) => {
                            const isSpec = !it.quantity || it.quantity === 0;
                            const descPreview = it.description.length > 22 ? it.description.slice(0, 22) + "..." : it.description;
                            return (
                              <option key={i} value={i + 1}>
                                After Row {i + 1}: {isSpec ? `(Spec) ${descPreview}` : descPreview}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div style={{ borderRadius: "1rem", background: "var(--color-page-bg)", boxShadow: "inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.9)", padding: "1rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        <div>
                          <label className="form-label">Catalog Item <span style={{ fontWeight: "400", color: "#94a3b8" }}>(optional)</span></label>
                          <CustomSelect
                            value={draftItem?.itemId || ""}
                            onChange={(val) => handleItemSelect(val)}
                            options={[
                              { value: "", label: "-- Custom Item --" },
                              ...items.map((item) => ({
                                value: item.id,
                                label: item.description,
                                sublabel: item.unit ? `${item.unit} · ₱${Number(item.standardCost || 0).toLocaleString()}` : undefined,
                              })),
                            ]}
                            placeholder="-- Custom Item --"
                          />
                        </div>

                        <div>
                          <label className="form-label">Description</label>
                          <input
                            value={draftItem?.description || ""}
                            onChange={(e) => setDraftItem({ ...(draftItem || {}), description: e.target.value })}
                            className="form-input"
                            placeholder="Enter description..."
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                          <div>
                            <label className="form-label">Unit of Issue</label>
                            <input
                              value={draftItem?.unit || ""}
                              onChange={(e) => setDraftItem({ ...(draftItem || {}), unit: e.target.value })}
                              className="form-input"
                            />
                          </div>

                          <div>
                            <label className="form-label">Quantity</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={draftItem?.quantity ?? ""}
                              onChange={(e) => setDraftItem({ ...(draftItem || {}), quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                              className="form-input"
                              style={{ textAlign: "right" }}
                              placeholder="0"
                            />
                          </div>

                          <div>
                            <label className="form-label">Cost</label>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={draftItem?.unitCost ?? ""}
                              onChange={(e) => setDraftItem({ ...(draftItem || {}), unitCost: e.target.value === "" ? "" : Number(e.target.value) })}
                              className="form-input"
                              style={{ textAlign: "right" }}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "#059669" }}>
                          Est: {formatCurrency(Number(draftItem?.quantity || 0) * Number(draftItem?.unitCost || 0))}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {activeItemIndex !== null ? (
                            <button
                              type="button"
                              onClick={handleDeleteItem}
                              className="btn btn-danger btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleClearDraft}
                              className="btn btn-secondary btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              Clear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleAddOrUpdate}
                            className="btn btn-primary btn-sm"
                          >
                            {activeItemIndex !== null ? "Update" : insertAtIndex !== null ? "Insert Item" : "Add Item"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {isReadOnly && watchLineItems.length === 0 && (
                  <div style={{ textAlign: "center", padding: "1.5rem", border: "2px dashed #e2e8f0", borderRadius: "0.75rem", color: "#94a3b8", fontSize: "0.875rem" }}>
                    No line items added.
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Dedicated Pinned Footer: Grand Total */}
          <div className="shrink-0 p-4 px-5 border-t border-slate-200/80 bg-slate-50/90 rounded-b-2xl">
            <div className="flex justify-between items-center font-bold text-sm text-slate-800">
              <span className="text-slate-600">Grand Total:</span>
              <span className="text-emerald-600 text-lg font-extrabold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
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
        requirePassword={true}
        isDestructive={true}
      />
    </div>
  );
}
