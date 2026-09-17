"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reports a page view once per path.
 *
 * Deliberately tiny and deliberately client-side: the pages it measures are
 * statically rendered or incrementally regenerated, so the server does not run
 * on every visit and cannot count them.
 *
 * `sendBeacon` where available — it survives the page being closed immediately
 * after load, which is exactly the visit most worth counting, and it never
 * delays navigation. Only the referrer's hostname is derived, server-side.
 */
export default function PageViewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || undefined,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/collect",
          new Blob([payload], { type: "application/json" }),
        );
        return;
      }
      void fetch("/api/analytics/collect", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
    } catch {
      // Analytics must never be the reason a page misbehaves.
    }
  }, [pathname]);

  return null;
}
