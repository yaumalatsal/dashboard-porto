import type { Health } from "@/lib/monitor/types";
import { HEALTH_LABEL } from "@/lib/monitor/format";

/**
 * Status is always shape + colour + word.
 *
 * The reserved status palette is distinct from the series slots, but distinct
 * is not the same as separable under CVD or in grayscale — so `operational` is
 * a filled disc, `down` a ring, `unknown` a dashed ring, and the word is always
 * rendered. Colour never carries the state on its own.
 */
export default function Status({
  health,
  showLabel = true,
}: {
  health: Health;
  showLabel?: boolean;
}) {
  return (
    <span className={`status status--${health}`}>
      <span className="status__icon" aria-hidden="true" />
      {showLabel ? (
        HEALTH_LABEL[health]
      ) : (
        <span className="sr-only">{HEALTH_LABEL[health]}</span>
      )}
    </span>
  );
}
