import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "muted";

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  muted: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ children, variant = "default", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// RFQ stage to badge variant mapping
export function getRfqStageVariant(stage: string): BadgeVariant {
  switch (stage) {
    case "received":
      return "warning";
    case "reviewing":
    case "quoting":
      return "default";
    case "submitted":
      return "success";
    case "won":
      return "success";
    case "lost":
    case "expired":
      return "muted";
    default:
      return "default";
  }
}

// Order stage to badge variant mapping
export function getOrderStageVariant(stage: string): BadgeVariant {
  switch (stage) {
    case "received":
      return "warning";
    case "verified":
    case "sourcing":
    case "fulfilling":
      return "default";
    case "qc":
    case "ship":
      return "success";
    case "closed":
      return "muted";
    default:
      return "default";
  }
}

// Human-readable stage labels
export const ORDER_STAGE_LABELS: Record<string, string> = {
  received: "Received",
  verified: "Verified",
  sourcing: "Sourcing",
  fulfilling: "Fulfilling",
  qc: "QC",
  ship: "Ship",
  closed: "Closed",
};

export const RFQ_STAGE_LABELS: Record<string, string> = {
  received: "Received",
  reviewing: "Reviewing",
  quoting: "Quoting",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  expired: "Expired",
};
