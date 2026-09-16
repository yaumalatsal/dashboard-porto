"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server component on an interval.
 *
 * `router.refresh()` re-runs the server render and patches the result in — no
 * full reload, no client-side data layer, and scroll position is preserved.
 *
 * Pauses while the tab is hidden: a backgrounded status page should not keep
 * waking the server or the poller's SQLite reads.
 */
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), seconds * 1000);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Catch up immediately on return rather than waiting out the interval.
        router.refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
