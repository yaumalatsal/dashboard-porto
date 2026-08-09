import type { ReactNode } from "react";

type RuneCornersProps = {
  children: ReactNode;
  className?: string;
};

export default function RuneCorners({ children, className = "" }: RuneCornersProps) {
  return (
    <div className={`relic-frame ${className}`}>
      <span className="relic-frame__corner relic-frame__corner--tl" aria-hidden="true" />
      <span className="relic-frame__corner relic-frame__corner--tr" aria-hidden="true" />
      <span className="relic-frame__corner relic-frame__corner--bl" aria-hidden="true" />
      <span className="relic-frame__corner relic-frame__corner--br" aria-hidden="true" />
      {children}
    </div>
  );
}
