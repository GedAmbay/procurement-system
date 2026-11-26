"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ModalPortal } from "@/components/ui/modal-portal";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ProcurementStage,
  ProcurementDoc,
  ProcurementFolderData,
  ProcurementAuditLog,
} from "@/lib/procurement-folder";
import {
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  Tag,
  Building2,
  Coins,
  Info,
  Zap,
  Clock,
  FileText,
  ClipboardList,
  ShoppingCart,
  Package,
  CheckSquare,
  Plus,
  Eye,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";

interface FolderViewProps {
  folderData: ProcurementFolderData;
  stages: ProcurementStage[];
}

interface TimelineItem {
  id: string;
  title: string;
  actor: string;
  timestamp: string;
  status: "done" | "active" | "next";
}

const STAGE_META: Record<
  string,
  {
    fullTitle: string;
    subtitle: string;
    createHref: string;
    createLabel: string;
    waitingText: string;
  }
> = {
  PR: {
    fullTitle: "Purchase Request (PR)",
    subtitle: "Initial request for the procurement.",
    createHref: "/purchase-requests",
    createLabel: "Open Purchase Requests",
    waitingText: "Waiting for PR Completion",
  },
  JR: {
    fullTitle: "Job Request (JR)",
    subtitle: "Initial job request for the procurement.",
    createHref: "/purchase-requests",
    createLabel: "Open Job Requests",
    waitingText: "Waiting for JR Completion",
  },
  RFQ: {
    fullTitle: "Request for Quotation (RFQ)",
    subtitle: "Request for price quotations from suppliers.",
    createHref: "/rfqs",
    createLabel: "Create RFQ",
    waitingText: "Waiting for RFQ Finalization",
  },
  Abstract: {
    fullTitle: "Abstract of Canvass",
    subtitle: "Consolidation and comparison of supplier quotations.",
    createHref: "/abstract",
    createLabel: "Create Abstract",
    waitingText: "Waiting for Abstract Finalization",
  },
  PO: {
    fullTitle: "Purchase Order (PO)",
    subtitle: "Official order issued to the selected supplier.",
    createHref: "/purchase-orders",
    createLabel: "Create PO",
    waitingText: "Waiting for PO Finalization",
  },
  JO: {
    fullTitle: "Job Order (JO)",
    subtitle: "Official job order issued to the selected supplier.",
    createHref: "/purchase-orders",
    createLabel: "Create JO",
    waitingText: "Waiting for JO Finalization",
  },
  AIR: {
    fullTitle: "Acceptance & Inspection (AIR)",
    subtitle: "Inspection and acceptance of delivered items.",
    createHref: "/acceptances",
    createLabel: "Create AIR",
    waitingText: "Waiting for Acceptance & Inspection",
  },
};

function getStageIcon(key: string) {
  switch (key) {
    case "PR":
    case "JR":
      return ShoppingCart;
    case "RFQ":
      return FileText;
    case "Abstract":
      return ClipboardList;
    case "PO":
    case "JO":
      return Package;
    case "AIR":
      return CheckSquare;
    default:
      return FileText;
  }
}

function getDocMeta(stageKey: string, doc: ProcurementDoc, folderData: ProcurementFolderData) {
  switch (stageKey) {
    case "PR":
    case "JR":
      return {
        title: stageKey === "JR" ? "Job Request" : "Purchase Request",
        editPath: `/purchase-requests/${doc.id}`,
        numberStr: doc.prNumber || "Draft PR",
      };
    case "RFQ":
      return {
        title: "Request for Quotation",
        editPath: `/rfqs/${doc.id}`,
        numberStr: doc.rfqNumber || "Draft RFQ",
      };
    case "Abstract":
      return {
        title: "Abstract of Canvass",
        editPath: `/abstract/${doc.id}`,
        numberStr: folderData.prNumber || doc.abstractNumber || "Draft Abstract",
      };
    case "PO":
    case "JO":
      return {
        title: stageKey === "JO" ? "Job Order" : "Purchase Order",
        editPath: `/purchase-orders/${doc.id}`,
        numberStr: doc.poNumber || "No. not yet assigned",
      };
    case "AIR":
      return {
        title: "Acceptance and Inspection Report (AIR)",
        editPath: `/acceptances/${doc.id}`,
        numberStr: doc.airNumber || doc.AIRNumber || "No. not yet assigned",
      };
    default:
      return {
        title: stageKey,
        editPath: "#",
        numberStr: "",
      };
  }
}

function formatDateTimeShort(value?: string | Date | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FolderView({ folderData, stages }: FolderViewProps) {
  const totalAmount = folderData.totalAmount || 0;
  const activeStageIndex = stages.findIndex((s) => s.state === "active");
  const currentStep = activeStageIndex === -1 ? stages.length : activeStageIndex + 1;
  const activeStage = activeStageIndex !== -1 ? stages[activeStageIndex] : stages[stages.length - 1];
  const allCompleted = stages.every((s) => s.state === "done");
  const itemsCount = folderData.lineItems?.length ?? 0;

  // Accordion expansion state: expand active stage by default
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    stages.forEach((s) => {
      initial[s.key] = s.state === "active";
    });
    return initial;
  });

  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allExpanded = stages.every((s) => expandedStages[s.key]);

  const toggleAllStages = () => {
    const nextValue = !allExpanded;
    const updated: Record<string, boolean> = {};
    stages.forEach((s) => {
      updated[s.key] = nextValue;
    });
    setExpandedStages(updated);
  };

  const toggleStage = (key: string) => {
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Primary CTA in Actions card
  const primaryAction = useMemo(() => {
    if (allCompleted) {
      const airDoc = stages[stages.length - 1]?.docs?.[0];
      return {
        label: "View Acceptance Report",
        href: airDoc ? `/acceptances/${airDoc.id}` : `/purchase-requests/${folderData.id}`,
      };
    }
    if (!activeStage) {
      return {
        label: "Open Purchase Request",
        href: `/purchase-requests/${folderData.id}`,
      };
    }
    if (activeStage.docs.length > 0) {
      const doc = activeStage.docs[0];
      const meta = getDocMeta(activeStage.key, doc, folderData);
      return {
        label: `Finalize ${activeStage.key}`,
        href: meta.editPath,
      };
    }
    const stageMeta = STAGE_META[activeStage.key];
    return {
      label: stageMeta?.createLabel || `Create ${activeStage.key}`,
      href: `${stageMeta?.createHref || "/purchase-requests"}?prId=${folderData.id}`,
    };
  }, [activeStage, allCompleted, folderData, stages]);

  // Activity Timeline items (combine audit logs + milestones)
  const timelineItems: TimelineItem[] = useMemo(() => {
    const logs: ProcurementAuditLog[] = folderData.auditLogs || [];
    if (logs.length > 0) {
      const mapped: TimelineItem[] = logs.slice(0, 6).map((log, idx) => ({
        id: log.id,
        title: log.notes || `${log.documentType} ${log.action.toLowerCase()}`,
        actor: log.user?.name || "System",
        timestamp: formatDateTimeShort(log.createdAt),
        status: idx === 0 && !allCompleted ? "active" : "done",
      }));
      if (!allCompleted && activeStage) {
        mapped.push({
          id: "next-step",
          title:
            activeStage.docs.length > 0
              ? `${activeStage.key} for finalization`
              : `Create ${activeStage.key}`,
          actor: "Next step",
          timestamp: "",
          status: "next",
        });
      }
      return mapped;
    }

    // Fallback synthesized milestones when no audit log rows exist yet
    const items: TimelineItem[] = [
      {
        id: "pr-created",
        title: `${folderData.requestType === "JOB" ? "Job" : "Purchase"} Request created`,
        actor: `by ${folderData.requestedBy?.name || "Requester"}`,
        timestamp: formatDateTimeShort(folderData.createdAt),
        status: "done",
      },
    ];

    if (activeStage && activeStage.key !== "PR" && activeStage.key !== "JR") {
      items.push({
        id: "moved-stage",
        title: `Moved to ${activeStage.label}`,
        actor: "System",
        timestamp: formatDateTimeShort(folderData.updatedAt || folderData.createdAt),
        status: "active",
      });
      items.push({
        id: "next-step",
        title:
          activeStage.docs.length > 0
            ? `${activeStage.key} for finalization`
            : `Create ${activeStage.key}`,
        actor: "Next step",
        timestamp: "",
        status: "next",
      });
    }

    return items;
  }, [folderData, activeStage, allCompleted]);

  const waitingText = allCompleted
    ? "All procurement steps completed"
    : STAGE_META[activeStage?.key || ""]?.waitingText || "In Progress";

  return (
    <div className="w-full space-y-5">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
        <Link href="/archives" className="transition hover:text-blue-600">
          Archives
        </Link>
        <ChevronRight size={14} className="text-slate-400" />
        <Link
          href={`/archives/${folderData.officeId}`}
          className="transition hover:text-blue-600"
        >
          {folderData.office?.name || "Department"}
        </Link>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="font-semibold text-slate-900">{folderData.prNumber || "Draft PR"}</span>
      </nav>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column */}
        <div className="space-y-5 lg:col-span-8">
          {/* Hero Folder Card + 5-Step Progress Stepper */}
          <div
            className="relative isolate overflow-hidden rounded-2xl border border-slate-200/90 p-6 shadow-xs"
            style={{
              backgroundImage:
                "linear-gradient(110deg, #F8FAFC 0%, #F1F5F9 40%, #EFF6FF 60%, #DBEAFE 85%, #BFDBFE 100%)",
            }}
          >
            {/* Decorative Layered Curved Ribbons */}
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 320"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-50 sm:opacity-80 md:opacity-100"
            >
              <defs>
                <linearGradient id="folder-ribbon-1" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.12" />
                  <stop offset="55%" stopColor="#93C5FD" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.28" />
                </linearGradient>
                <linearGradient id="folder-ribbon-2" x1="10%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EFF6FF" stopOpacity="0.08" />
                  <stop offset="50%" stopColor="#BFDBFE" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.26" />
                </linearGradient>
                <linearGradient id="folder-ribbon-3" x1="20%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.10" />
                  <stop offset="60%" stopColor="#93C5FD" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.16" />
                </linearGradient>
              </defs>
              {/* Broad lower-middle to upper-right sweeping ribbon */}
              <path
                d="M 480 320 C 660 285, 810 155, 1020 0 L 1200 0 L 1200 185 C 1020 220, 860 285, 700 320 Z"
                fill="url(#folder-ribbon-1)"
              />
              {/* Mid translucent overlapping wave */}
              <path
                d="M 590 320 C 740 250, 900 135, 1135 0 L 1200 0 L 1200 120 C 1045 170, 910 255, 790 320 Z"
                fill="url(#folder-ribbon-2)"
              />
              {/* Upper-right soft accent ribbon */}
              <path
                d="M 730 320 C 855 245, 985 160, 1200 55 L 1200 240 C 1055 268, 945 298, 860 320 Z"
                fill="url(#folder-ribbon-3)"
              />
            </svg>

            {/* Subtle White Fade Toward Bottom */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-white/95 via-white/55 to-transparent"
            />

            {/* Header Row */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  }}
                >
                  <Folder size={28} fill="currentColor" className="text-white/95" />
                </div>

                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                    PROCUREMENT FOLDER &bull; FY {folderData.fiscalYear}
                  </div>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {folderData.purpose}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400" />
                      {folderData.requestType === "JOB" ? "JR No." : "PR No."}{" "}
                      <strong className="text-slate-800">{folderData.prNumber || "Draft"}</strong>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      {folderData.office?.name || "Unassigned Office"}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Coins size={13} className="text-slate-400" />
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 sm:text-right">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Total Amount
                </div>
                <div className="mt-0.5 text-2xl font-extrabold text-emerald-600 sm:text-[1.75rem]">
                  {formatCurrency(totalAmount)}
                </div>
              </div>
            </div>

            {/* Horizontal Stepper */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex flex-1 items-start justify-between gap-2">
                  {/* Connecting line */}
                  <div className="absolute top-4 right-8 left-8 h-0.5 bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${Math.max(0, (currentStep - 1) / Math.max(1, stages.length - 1)) * 100}%`,
                      }}
                    />
                  </div>

                  {stages.map((stage, idx) => {
                    const isDone = stage.state === "done";
                    const isActive = stage.state === "active";

                    return (
                      <div
                        key={stage.key}
                        className="relative z-10 flex flex-1 flex-col items-center text-center"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${isDone
                            ? "bg-emerald-500 text-white shadow-xs"
                            : isActive
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "border border-slate-200 bg-slate-100 text-slate-400"
                            }`}
                        >
                          {isDone ? <Check size={15} strokeWidth={3} /> : idx + 1}
                        </div>

                        <div
                          className={`mt-2 rounded-lg px-2.5 py-1 transition ${isActive ? "bg-blue-50/90 ring-1 ring-blue-200/80" : ""
                            }`}
                        >
                          <div
                            className={`text-xs font-bold ${isActive
                              ? "text-blue-700"
                              : isDone
                                ? "text-slate-800"
                                : "text-slate-400"
                              }`}
                          >
                            {stage.key}
                          </div>
                          <div
                            className={`mt-0.5 hidden text-[10px] leading-tight sm:block ${isActive
                              ? "font-medium text-blue-600"
                              : isDone
                                ? "text-slate-500"
                                : "text-slate-400"
                              }`}
                          >
                            {stage.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Step Counter & Waiting Status */}
                <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 xl:flex-col xl:items-end xl:border-t-0 xl:pt-0">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    Step {currentStep} of {stages.length}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 xl:text-right">
                    <Info size={13} className="shrink-0 text-slate-400" />
                    <span>{waitingText}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Procurement Documents Accordion Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Procurement Documents</h2>
                  <p className="text-xs text-slate-500">
                    Manage and track all documents for this {folderData.requestType === "JOB" ? "JR" : "PR"}.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAllStages}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                {allExpanded ? "Collapse All" : "Expand All"}
                {allExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div className="space-y-3">
              {stages.map((stage) => {
                const isDone = stage.state === "done";
                const isActive = stage.state === "active";
                const isExpanded = Boolean(expandedStages[stage.key]);
                const meta = STAGE_META[stage.key] || {
                  fullTitle: stage.label,
                  subtitle: "",
                  createHref: "/purchase-requests",
                  createLabel: `Create ${stage.key}`,
                };
                const StageIcon = getStageIcon(stage.key);

                return (
                  <div
                    key={stage.key}
                    className={`overflow-hidden rounded-xl border transition ${isActive
                      ? "border-blue-400 bg-white ring-2 ring-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                  >
                    {/* Stage Header Row */}
                    <button
                      type="button"
                      onClick={() => toggleStage(stage.key)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/70"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDone
                            ? "bg-emerald-50 text-emerald-600"
                            : isActive
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-100 text-slate-400"
                            }`}
                        >
                          <StageIcon size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {meta.fullTitle}
                            </span>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 size={11} /> Completed
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                                <Clock size={11} /> In Progress
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{meta.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
                          <FileText size={12} className="text-slate-400" />
                          {stage.docs.length} {stage.docs.length === 1 ? "document" : "documents"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Stage Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3.5">
                        {stage.docs.length === 0 ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3">
                            <span className="text-xs text-slate-500">
                              {isActive
                                ? `No ${stage.key} document created yet. Ready to proceed.`
                                : "Waiting for previous procurement step to complete."}
                            </span>
                            {isActive && (
                              <Link
                                href={`${meta.createHref}?prId=${folderData.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                              >
                                <Plus size={13} />
                                {meta.createLabel}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {stage.docs.map((doc: ProcurementDoc) => {
                              const docMeta = getDocMeta(stage.key, doc, folderData);
                              const authorName =
                                doc.createdBy?.name ||
                                (stage.key === "PR" || stage.key === "JR"
                                  ? folderData.requestedBy?.name
                                  : null);

                              return (
                                <div
                                  key={doc.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                                >
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-bold text-slate-900">
                                        {docMeta.numberStr}
                                      </span>
                                      {doc.status && (
                                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase">
                                          {doc.status}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                      Created {formatDate(doc.createdAt)}
                                      {authorName ? ` by ${authorName}` : ""}
                                      {stage.key === "PR" || stage.key === "JR"
                                        ? ` • ${itemsCount} item${itemsCount === 1 ? "" : "s"} • ${formatCurrency(doc.totalAmount || 0)}`
                                        : ""}
                                      {stage.key === "RFQ"
                                        ? ` • ${(doc.quotations || []).length} supplier quotation${(doc.quotations || []).length === 1 ? "" : "s"}`
                                        : ""}
                                    </div>
                                  </div>

                                  <Link
                                    href={docMeta.editPath}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <Eye size={13} />
                                    Open
                                  </Link>
                                </div>
                              );
                            })}

                            {stage.key === "RFQ" &&
                              isActive &&
                              stage.docs.some((d: ProcurementDoc) => (d.quotations?.length || 0) < 3) && (
                                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800">
                                  <AlertCircle size={15} className="shrink-0 text-amber-600" />
                                  <span>
                                    <strong>Before you finalize:</strong> add at least 3 suppliers
                                    and assign a fund source.
                                  </span>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5 lg:col-span-4">
          {/* Request Details Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Info size={16} className="text-blue-600" />
              Request Details
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">
                  {folderData.requestType === "JOB" ? "JR Number" : "PR Number"}
                </dt>
                <dd className="font-bold text-slate-900">{folderData.prNumber || "Draft"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Requesting Office</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {folderData.office?.name || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Fund Source</dt>
                <dd className="text-right">
                  {folderData.fundSource ? (
                    <span className="font-semibold text-slate-900">
                      {folderData.fundSource.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      Not assigned &bull;
                      <Link
                        href={`/purchase-requests/${folderData.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Assign
                      </Link>
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Total Amount</dt>
                <dd className="font-bold text-slate-900">{formatCurrency(totalAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Created By</dt>
                <dd className="font-semibold text-slate-800">
                  {folderData.requestedBy?.name || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Date Created</dt>
                <dd className="font-semibold text-slate-800">
                  {formatDate(folderData.createdAt)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Zap size={16} className="text-blue-600" />
              Actions
            </h2>

            <div className="space-y-2.5">
              <Link
                href={primaryAction.href}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
              >
                <CheckCircle2 size={16} />
                {primaryAction.label}
              </Link>

              <div className="relative flex items-center gap-2" ref={actionsMenuRef}>
                <Link
                  href={`${STAGE_META[activeStage?.key || "RFQ"]?.createHref || "/rfqs"}?prId=${folderData.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus size={15} className="text-slate-500" />
                  Add Document
                </Link>
                <button
                  type="button"
                  onClick={() => setShowActionsMenu((prev) => !prev)}
                  aria-label="More document actions"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronDown size={15} />
                </button>

                {showActionsMenu && (
                  <div className="absolute top-11 right-0 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <Link
                      href={`/purchase-requests/${folderData.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open Purchase Request
                      <ArrowRight size={12} className="text-slate-400" />
                    </Link>
                    <Link
                      href={`/rfqs?prId=${folderData.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go to RFQs
                      <ArrowRight size={12} className="text-slate-400" />
                    </Link>
                    <Link
                      href={`/abstract?prId=${folderData.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go to Abstract of Canvass
                      <ArrowRight size={12} className="text-slate-400" />
                    </Link>
                    <Link
                      href={`/purchase-orders?prId=${folderData.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go to Purchase Orders
                      <ArrowRight size={12} className="text-slate-400" />
                    </Link>
                    <Link
                      href={`/acceptances?prId=${folderData.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go to Acceptances (AIR)
                      <ArrowRight size={12} className="text-slate-400" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Clock size={16} className="text-blue-600" />
                Activity Timeline
              </h2>
              <button
                type="button"
                onClick={() => setShowTimelineModal(true)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>

            <div className="relative space-y-5 pl-6">
              {/* Vertical rail */}
              <div className="absolute top-2 bottom-2 left-[9px] w-px bg-slate-200" />

              {timelineItems.slice(0, 4).map((item) => (
                <div key={item.id} className="relative">
                  {/* Status Dot */}
                  <div className="absolute top-0.5 -left-6 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    {item.status === "done" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : item.status === "active" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-slate-300 bg-white" />
                    )}
                  </div>

                  <div
                    className={`text-xs font-semibold ${item.status === "next" ? "text-slate-500" : "text-slate-900"
                      }`}
                  >
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {item.actor}
                    {item.timestamp ? ` • ${item.timestamp}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Timeline Modal */}
      {showTimelineModal && (
        <ModalPortal onBackdropClick={() => setShowTimelineModal(false)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Clock size={16} className="text-blue-600" />
                Full Activity Timeline — {folderData.prNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowTimelineModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="relative space-y-5 pl-6">
                <div className="absolute top-2 bottom-2 left-[9px] w-px bg-slate-200" />
                {timelineItems.map((item) => (
                  <div key={item.id} className="relative">
                    <div className="absolute top-0.5 -left-6 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      {item.status === "done" ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      ) : item.status === "active" ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-slate-300 bg-white" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {item.actor}
                      {item.timestamp ? ` • ${item.timestamp}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
