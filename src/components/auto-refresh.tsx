"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the current page from the server every few seconds while mounted (e.g. while a quiz is generating) */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    // Skip polling in background tabs, and catch up as soon as the tab is visible again
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refreshIfVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, intervalMs]);
  return null;
}
