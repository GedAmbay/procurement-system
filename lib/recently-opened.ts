import { RecentlyOpenedItem, DocumentType } from "@/components/archives/types";

const STORAGE_KEY_PREFIX = "lgu_recently_opened_";

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
  return [
    {
      id: "recent-1",
      documentId: "abstract-sample",
      documentType: "Abstract",
      title: "Abstract of Canvass",
      officeName: "Bids and Awards Committee",
      openedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      url: "/abstract",
    },
    {
      id: "recent-2",
      documentId: "rfq-sample",
      documentType: "RFQ",
      title: "Request for Quotation",
      officeName: "Municipal Engineering Office",
      openedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      url: "/rfqs",
    },
    {
      id: "recent-3",
      documentId: "pr-sample",
      documentType: "PR",
      title: "Purchase Request",
      officeName: "Municipal Mayor/Supply",
      openedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      url: "/purchase-requests",
    },
    {
      id: "recent-4",
      documentId: "po-sample",
      documentType: "PO",
      title: "Purchase Order",
      officeName: "Municipal Engineering Office",
      openedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      url: "/purchase-orders",
    },
  ];
}

export function getRecentlyOpened(userId: string = "current"): RecentlyOpenedItem[] {
  if (typeof window === "undefined") {
    return getDefaultRecentlyOpened();
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) {
      // Store default records so they persist
      const initial = getDefaultRecentlyOpened();
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 8);
    }
    return [];
  } catch {
    return getDefaultRecentlyOpened();
  }
}

export function recordDocumentOpen(record: {
  userId?: string;
  documentId: string;
  documentType: DocumentType;
  title: string;
  officeName: string;
  url: string;
  openedAt?: string;
}): void {
  if (typeof window === "undefined") return;

  const userId = record.userId || "current";
  const newItem: RecentlyOpenedItem = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    documentId: record.documentId,
    documentType: record.documentType,
    title: record.title,
    officeName: record.officeName,
    openedAt: record.openedAt || new Date().toISOString(),
    url: record.url,
  };

  try {
    const current = getRecentlyOpened(userId);
    // Remove if already exists with same documentId
    const filtered = current.filter((item) => item.documentId !== record.documentId);
    const updated = [newItem, ...filtered].slice(0, 8);
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
        url: record.url,
      }),
    }).catch(() => {
      // ignore network errors for offline resiliency
    });
  } catch (err) {
    console.error("Failed to record document open:", err);
  }
}

