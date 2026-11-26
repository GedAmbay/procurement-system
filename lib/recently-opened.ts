import { RecentlyOpenedItem, DocumentType } from "@/components/archives/types";

const STORAGE_KEY_PREFIX = "lgu_recently_opened_";

export function getLivePreviewUrl(documentType: string, documentId: string): string {
  if (!documentId) return "/purchase-requests";
  const type = (documentType || "").toUpperCase();
  if (type === "PR" || type === "PURCHASE_REQUEST" || type === "PURCHASE REQUEST") {
    return `/purchase-requests/${documentId}`;
  }
  if (type === "RFQ") {
    return `/rfqs/${documentId}`;
  }
  if (type === "ABSTRACT" || type === "ABSTRACT_OF_CANVASS" || type === "ABSTRACT OF CANVASS") {
    return `/abstract/${documentId}/print`;
  }
  if (type === "PO" || type === "PURCHASE_ORDER" || type === "PURCHASE ORDER") {
    return `/purchase-orders/${documentId}`;
  }
  if (type === "ACCEPTANCE" || type === "AIR") {
    return `/acceptances/${documentId}`;
  }
  return `/purchase-requests/${documentId}`;
}

export function formatRelativeTime(dateInput: string | Date | number): string {
  if (!dateInput) return "Opened recently";
  if (typeof dateInput === "string" && dateInput.startsWith("Opened")) {
    return dateInput;
  }

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Opened recently";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Opened just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Opened ${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Opened ${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "Opened yesterday";
  }
  if (diffInDays < 7) {
    return `Opened ${diffInDays}d ago`;
  }

  return `Opened on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function getDefaultRecentlyOpened(): RecentlyOpenedItem[] {
  return [];
}

function isSampleItem(item: RecentlyOpenedItem): boolean {
  return (
    typeof item?.documentId === "string" && item.documentId.endsWith("-sample")
  ) || (
    typeof item?.id === "string" && /^recent-[1-4]$/.test(item.id)
  );
}

export function getRecentlyOpened(userId: string = "current"): RecentlyOpenedItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed.filter((item) => !isSampleItem(item));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(cleaned));
      }
      return cleaned.slice(0, 20);
    }
    return [];
  } catch {
    return [];
  }
}

export function recordDocumentOpen(record: {
  userId?: string;
  documentId: string;
  documentType: DocumentType;
  title: string;
  officeName: string;
  url?: string;
  openedAt?: string;
}): void {
  if (typeof window === "undefined") return;

  const liveUrl = record.url || getLivePreviewUrl(record.documentType, record.documentId);
  const userId = record.userId || "current";
  const newItem: RecentlyOpenedItem = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    documentId: record.documentId,
    documentType: record.documentType,
    title: record.title,
    officeName: record.officeName,
    openedAt: record.openedAt || new Date().toISOString(),
    url: liveUrl,
  };

  try {
    const current = getRecentlyOpened(userId);
    // Remove if already exists with same documentId
    const filtered = current.filter((item) => item.documentId !== record.documentId);
    const updated = [newItem, ...filtered].slice(0, 20);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));

    // Dispatch custom event for real-time update across components
    window.dispatchEvent(new CustomEvent("lgu:recently-opened-changed", { detail: updated }));

    // Async server sync (fire and forget)
    fetch("/api/recently-opened", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: record.documentId,
        documentType: record.documentType,
        title: record.title,
        officeName: record.officeName,
        url: liveUrl,
      }),
    }).catch(() => {
      // ignore network errors for offline resiliency
    });
  } catch (err) {
    console.error("Failed to record document open:", err);
  }
}

