import { cn } from "@/lib/utils";

type Urgency = "urgent" | "attention" | "ready" | "inactive";

interface UrgencyDotProps {
  urgency: Urgency;
  className?: string;
}

const urgencyColors: Record<Urgency, string> = {
  urgent: "bg-red-500",      // Due today, overdue
  attention: "bg-amber-500", // Due soon, waiting
  ready: "bg-green-500",     // Ready to proceed
  inactive: "bg-slate-400",  // Archived, closed
};

export function UrgencyDot({ urgency, className }: UrgencyDotProps) {
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        urgencyColors[urgency],
        className
      )}
    />
  );
}

export function getUrgencyFromDueDate(dueDate: Date | null): Urgency {
  if (!dueDate) return "inactive";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "urgent";  // Overdue
  if (diffDays === 0) return "urgent"; // Due today
  if (diffDays <= 7) return "attention"; // Due this week
  return "ready";
}

export function getUrgencyFromStage(stage: string): Urgency {
  switch (stage) {
    case "received":
    case "verified":
      return "attention"; // Needs action
    case "sourcing":
    case "fulfilling":
      return "attention"; // In progress
    case "qc":
    case "ship":
      return "ready"; // Ready for next step
    case "closed":
      return "inactive";
    default:
      return "attention";
  }
}
