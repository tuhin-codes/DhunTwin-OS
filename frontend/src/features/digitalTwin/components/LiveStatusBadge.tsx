import {
  Activity,
  AlertTriangle,
  CircleStop,
  Wrench,
} from "lucide-react";

interface LiveStatusBadgeProps {
  status?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

type Status =
  | "live"
  | "operational"
  | "maintenance"
  | "stopped"
  | "emergency"
  | "warning"
  | "unknown";

function getStatus(
  status?: string
): Status {
  const value = String(
    status ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    value.includes("emergency")
  ) {
    return "emergency";
  }

  if (
    value.includes("maintenance")
  ) {
    return "maintenance";
  }

  if (
    value.includes("stopped") ||
    value.includes("stop")
  ) {
    return "stopped";
  }

  if (
    value.includes("warning") ||
    value.includes("attention")
  ) {
    return "warning";
  }

  if (
    value.includes("operational") ||
    value.includes("running") ||
    value.includes("live")
  ) {
    return "operational";
  }

  return "unknown";
}

export default function LiveStatusBadge({
  status = "Operational",
  size = "sm",
  showLabel = true,
}: LiveStatusBadgeProps) {
  const current =
    getStatus(status);

  const styles = {
    live: {
      wrapper:
        "border-[#A7F3D0] bg-[#ECFDF5]",
      text:
        "text-[#047857]",
      dot:
        "bg-[#16A34A]",
    },

    operational: {
      wrapper:
        "border-[#A7F3D0] bg-[#ECFDF5]",
      text:
        "text-[#047857]",
      dot:
        "bg-[#16A34A]",
    },

    maintenance: {
      wrapper:
        "border-[#F3D49A] bg-[#FFF8E8]",
      text:
        "text-[#B45309]",
      dot:
        "bg-[#F59E0B]",
    },

    stopped: {
      wrapper:
        "border-[#DDE4DF] bg-[#F5F7F6]",
      text:
        "text-[#64736A]",
      dot:
        "bg-[#94A39A]",
    },

    emergency: {
      wrapper:
        "border-[#F3C2C2] bg-[#FEF2F2]",
      text:
        "text-[#B91C1C]",
      dot:
        "bg-[#EF4444]",
    },

    warning: {
      wrapper:
        "border-[#F3D49A] bg-[#FFF8E8]",
      text:
        "text-[#B45309]",
      dot:
        "bg-[#F59E0B]",
    },

    unknown: {
      wrapper:
        "border-[#DDE7E1] bg-[#F7FAF8]",
      text:
        "text-[#64736A]",
      dot:
        "bg-[#94A39A]",
    },
  }[current];

  const sizeStyles =
    size === "md"
      ? "px-2.5 py-1.5 text-[7px]"
      : "px-2 py-1 text-[6px]";

  const iconSize =
    size === "md"
      ? 12
      : 10;

  const label =
    current === "operational"
      ? "Operational"
      : current === "maintenance"
        ? "Maintenance"
        : current === "stopped"
          ? "Stopped"
          : current === "emergency"
            ? "Emergency"
            : current === "warning"
              ? "Attention"
              : current === "live"
                ? "Live"
                : "Unknown";

  function getIcon() {
    if (
      current === "emergency" ||
      current === "warning"
    ) {
      return (
        <AlertTriangle
          size={iconSize}
        />
      );
    }

    if (
      current === "maintenance"
    ) {
      return (
        <Wrench
          size={iconSize}
        />
      );
    }

    if (
      current === "stopped"
    ) {
      return (
        <CircleStop
          size={iconSize}
        />
      );
    }

    return (
      <Activity
        size={iconSize}
      />
    );
  }

  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-full border",
        "font-bold uppercase tracking-[0.06em]",
        sizeStyles,
        styles.wrapper,
        styles.text,
      ].join(" ")}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${
          current === "operational"
            ? "animate-pulse"
            : ""
        }`}
      />

      {showLabel && (
        <>
          {getIcon()}
          <span>
            {label}
          </span>
        </>
      )}
    </span>
  );
}