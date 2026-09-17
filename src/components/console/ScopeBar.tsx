"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Stage 1 of the reading path: the range that every figure below is measured
 * over. It sits above the numbers because scope has to be established before
 * the numbers mean anything.
 *
 * Writes to the query string, so a scoped board is a URL you can pin to a
 * second monitor and it survives the 30-second refresh.
 */
export default function ScopeBar({
  current,
  options,
}: {
  current: string;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const select = (key: string) => {
    const next = new URLSearchParams(params.toString());
    if (key === "24h") next.delete("range");
    else next.set("range", key);
    const qs = next.toString();
    router.push(qs ? `?${qs}` : "/console", { scroll: false });
  };

  return (
    <div className="scope-bar">
      <span className="scope-bar__label">Range</span>
      <div className="scope-bar__group" role="group" aria-label="Time range">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="scope-btn"
            aria-pressed={current === option.key}
            onClick={() => select(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="scope-bar__live">
        <i aria-hidden="true" />
        Live · 30s
      </span>
    </div>
  );
}
