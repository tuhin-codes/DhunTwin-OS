import type { AssetStatus } from "../types";

const STATUS_LABEL: Record<AssetStatus, string> = {
  healthy: "Within range",
  watch: "Watch",
  attention: "Needs attention",
};

export default function StatusMark({
  status,
  showLabel = true,
  className = "",
}: {
  status: AssetStatus;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={`status-label ${className}`}>
      <span
        className={`status-dot status-${status}`}
        aria-hidden="true"
      />
      {showLabel ? (
        <span className="text-ink-soft">
          {STATUS_LABEL[status]}
        </span>
      ) : (
        <span className="sr-only">
          {STATUS_LABEL[status]}
        </span>
      )}
    </span>
  );
}
