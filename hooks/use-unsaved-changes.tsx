"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/confirm-modal";

export function useUnsavedChanges(
  snapshot: string,
  isReady: boolean,
  isReadOnly: boolean
) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingCleanRef = useRef(false);
  const allowLeaveRef = useRef(false);

  // Capture initial baseline once loaded, or re-capture after a save
  useEffect(() => {
    if (!isReady) {
      setBaseline(null);
      return;
    }
    if (pendingCleanRef.current) {
      pendingCleanRef.current = false;
      setBaseline(snapshot);
      return;
    }
    if (baseline === null) {
      setBaseline(snapshot);
    }
  }, [isReady, baseline, snapshot]);

  const isDirty = !isReadOnly && isReady && baseline !== null && snapshot !== baseline;

  const markClean = useCallback(() => {
    pendingCleanRef.current = true;
    setBaseline(snapshot);
  }, [snapshot]);

  // Warn on browser tab close / reload / external URL
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Intercept in-app <Link> / <a> clicks at capture phase when dirty
  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClick = (e: MouseEvent) => {
      if (allowLeaveRef.current) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (
        !hrefAttr ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:")
      ) {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);
        if (targetUrl.origin !== currentUrl.origin) return;
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        setPendingHref(targetUrl.pathname + targetUrl.search + targetUrl.hash);
      } catch {
        // Ignore malformed URLs
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [isDirty]);

  const handleStay = useCallback(() => {
    setPendingHref(null);
  }, []);

  const handleLeave = useCallback(() => {
    allowLeaveRef.current = true;
    const href = pendingHref;
    setPendingHref(null);
    if (href) {
      router.push(href);
    }
  }, [pendingHref, router]);

  const UnsavedChangesModal = (
    <ConfirmModal
      isOpen={Boolean(pendingHref)}
      onClose={handleStay}
      onConfirm={handleLeave}
      variant="warning"
      title="Unsaved Changes"
      message="You have unsaved changes on this document. If you leave now without saving, your edits will be lost."
      confirmText="Leave Without Saving"
      cancelText="Stay on Page"
    />
  );

  return { isDirty, markClean, UnsavedChangesModal };
}
