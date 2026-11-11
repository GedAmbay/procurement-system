"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isEditorRoute } from "@/lib/route-utils";

interface SidebarContextType {
  isEditor: boolean;
  isRail: boolean;
  isOverlayOpen: boolean;
  isPinned: boolean;
  canPin: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  toggleOverlay: () => void;
  togglePinned: () => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement | null>;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = "pe.sidebar.editorPinned";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditor = isEditorRoute(pathname);

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1280;
  });

  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  // Monitor window resize for 1280px breakpoint (below 1280px, pinned is disabled)
  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1280);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close overlay whenever pathname changes
  useEffect(() => {
    setIsOverlayOpen(false);
  }, [pathname]);

  const canPin = isEditor && isWideScreen;
  // In editor routes: rail by default, unless wide screen and user explicitly pinned it
  const isRail = isEditor && !(isWideScreen && isPinned);

  const openOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  const toggleOverlay = useCallback(() => {
    setIsOverlayOpen((prev) => !prev);
  }, []);

  const togglePinned = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch (e) {
        console.error("Failed to save sidebar pin preference", e);
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isEditor,
        isRail,
        isOverlayOpen,
        isPinned,
        canPin,
        openOverlay,
        closeOverlay,
        toggleOverlay,
        togglePinned,
        toggleButtonRef,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

