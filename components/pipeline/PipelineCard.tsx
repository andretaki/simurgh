"use client";

import Link from "next/link";
import { UrgencyDot } from "@/components/shared";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Urgency = "urgent" | "attention" | "ready" | "inactive";

interface QuickAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
}

interface PipelineCardProps {
  id: string | number;
  href: string;
  title: string;
  subtitle: string;
  urgency: Urgency;
  badge?: {
    label: string;
    variant?: "default" | "success" | "warning" | "error" | "muted";
  };
  value?: string;
  meta?: string[];
  actions?: QuickAction[];
  className?: string;
}

export function PipelineCard({
  href,
  title,
  subtitle,
  urgency,
  badge,
  value,
  meta = [],
  actions = [],
  className,
}: PipelineCardProps) {
  return (
    <div
      className={cn(
        "border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors bg-white",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <UrgencyDot urgency={urgency} className="mt-1.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={href}
                className="font-semibold text-slate-900 hover:text-slate-700 truncate"
              >
                {title}
              </Link>
              {badge && (
                <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            {meta.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {meta.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {value && (
          <div className="text-right flex-shrink-0">
            <span className="font-semibold text-slate-900">{value}</span>
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pl-5">
          {actions.map((action, index) => (
            action.href ? (
              <Button
                key={index}
                variant={action.variant === "outline" ? "outline" : "default"}
                size="sm"
                asChild
              >
                <Link href={action.href}>
                  {action.label}
                  {action.variant !== "outline" && (
                    <ArrowRight className="ml-1 h-3 w-3" />
                  )}
                </Link>
              </Button>
            ) : (
              <Button
                key={index}
                variant={action.variant === "outline" ? "outline" : "default"}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
