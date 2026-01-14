"use client";

import { PipelineCard } from "./PipelineCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ActionItem {
  type: "rfq" | "order";
  id: number;
  identifier: string;
  title: string;
  subtitle: string;
  value: string | null;
  dueDate: string | null;
  urgency: "urgent" | "attention" | "ready";
  meta: string[];
  actions: { label: string; href: string }[];
}

interface ActionGroup {
  id: string;
  label: string;
  items: ActionItem[];
}

interface ActionRequiredListProps {
  groups: ActionGroup[];
  loading?: boolean;
}

export function ActionRequiredList({ groups, loading }: ActionRequiredListProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">&#127881;</div>
        <h3 className="text-lg font-medium text-slate-900">All caught up!</h3>
        <p className="text-slate-500 mt-1">No items need your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.items.map((item) => (
              <PipelineCard
                key={`${item.type}-${item.id}`}
                id={item.id}
                href={item.type === "rfq" ? `/rfq/${item.id}/fill` : `/orders/${item.id}`}
                title={item.identifier}
                subtitle={item.subtitle}
                urgency={item.urgency}
                value={item.value || undefined}
                meta={[
                  ...item.meta,
                  item.dueDate ? formatDueDate(item.dueDate) : null,
                ].filter(Boolean) as string[]}
                actions={item.actions.map(a => ({
                  label: a.label,
                  href: a.href,
                  variant: a.label === "No Bid" ? "outline" as const : "default" as const,
                }))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${date.toLocaleDateString()}`;
}
