"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Severity and application filters.
 *
 * Writes to the query string rather than component state, so a filtered log is
 * a shareable URL that survives the 30-second refresh.
 */
export default function LogFilters({
  level,
  site,
  sites,
}: {
  level: string;
  site: string;
  sites: { id: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `?${qs}` : "/console/logs", { scroll: false });
  };

  return (
    <div className="log-filters">
      <div className="range-row" role="group" aria-label="Severity">
        {[
          { key: "all", label: "All" },
          { key: "warn", label: "Warnings +" },
          { key: "error", label: "Errors" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            className="range-btn"
            aria-pressed={level === option.key}
            onClick={() => set("level", option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sites.length > 1 && (
        <div className="range-row" role="group" aria-label="Application">
          <button
            type="button"
            className="range-btn"
            aria-pressed={site === "all"}
            onClick={() => set("site", "all")}
          >
            All apps
          </button>
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              className="range-btn"
              aria-pressed={site === s.id}
              onClick={() => set("site", s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
