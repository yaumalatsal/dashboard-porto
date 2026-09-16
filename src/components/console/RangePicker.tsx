"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Time-range control. Writes the range to the query string rather than to
 * component state, so the server re-renders with the new window and the
 * selection survives a refresh or a shared link.
 */
export default function RangePicker({
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
    next.set("range", key);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="range-row" role="group" aria-label="Time range">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className="range-btn"
          aria-pressed={current === option.key}
          onClick={() => select(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
