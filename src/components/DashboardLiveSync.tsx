"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function DashboardLiveSync() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    function refreshDashboard() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (now - lastRefreshAtRef.current < 1500) {
        return;
      }

      lastRefreshAtRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshDashboard();
      }
    }

    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return null;
}
