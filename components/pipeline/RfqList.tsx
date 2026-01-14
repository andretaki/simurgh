"use client";

import { useState } from "react";
import { PipelineCard } from "./PipelineCard";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  getRfqStageVariant,
  RFQ_STAGE_LABELS
} from "@/components/shared/StatusBadge";
import { getUrgencyFromDueDate } from "@/components/shared/UrgencyDot";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface RfqItem {
  id: number;
  rfqNumber: string | null;
  contractingOffice: string | null;
  dueDate: string | null;
  status: string;
  extractedFields: {
    estimatedValue?: number;
    lineItems?: unknown[];
    hazmat?: boolean;
  } | null;
  responseStatus: string | null;
}

interface RfqListProps {
  rfqs: RfqItem[];
  loading?: boolean;
  onUpload?: () => void;
}

const STAGE_OPTIONS = [
  { value: "all", label: "All Stages" },
  { value: "received", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "quoting", label: "Quoting" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "expired", label: "Expired" },
];

const DUE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "overdue", label: "Overdue" },
];

export function RfqList({ rfqs, loading, onUpload }: RfqListProps) {
  const [stageFilter, setStageFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredRfqs = rfqs.filter((rfq) => {
    // Stage filter
    if (stageFilter !== "all") {
      const stage = getRfqStage(rfq);
      if (stage !== stageFilter) return false;
    }

    // Due filter
    if (dueFilter !== "all" && rfq.dueDate) {
      const due = new Date(rfq.dueDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 7);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      switch (dueFilter) {
        case "today":
          if (due.toDateString() !== today.toDateString()) return false;
          break;
        case "week":
          if (due < today || due > endOfWeek) return false;
          break;
        case "month":
          if (due < today || due > endOfMonth) return false;
          break;
        case "overdue":
          if (due >= today) return false;
          break;
      }
    }

    // Search filter
    if (search) {
      const term = search.toLowerCase();
      const matchesRfqNumber = rfq.rfqNumber?.toLowerCase().includes(term);
      const matchesOffice = rfq.contractingOffice?.toLowerCase().includes(term);
      if (!matchesRfqNumber && !matchesOffice) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <FilterBar
          filters={[
            {
              id: "stage",
              label: "Stage",
              options: STAGE_OPTIONS,
              value: stageFilter,
              onChange: setStageFilter,
            },
            {
              id: "due",
              label: "Due",
              options: DUE_OPTIONS,
              value: dueFilter,
              onChange: setDueFilter,
            },
          ]}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search RFQ# or agency..."
        />
        {onUpload && (
          <Button onClick={onUpload} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Upload
          </Button>
        )}
      </div>

      {filteredRfqs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No RFQs match your filters
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRfqs.map((rfq) => {
            const stage = getRfqStage(rfq);
            const urgency = rfq.dueDate
              ? getUrgencyFromDueDate(new Date(rfq.dueDate))
              : "inactive";

            return (
              <PipelineCard
                key={rfq.id}
                id={rfq.id}
                href={`/rfq/${rfq.id}/fill`}
                title={rfq.rfqNumber || `RFQ-${rfq.id}`}
                subtitle={rfq.contractingOffice || "Unknown Agency"}
                urgency={urgency}
                badge={{
                  label: RFQ_STAGE_LABELS[stage] || stage,
                  variant: getRfqStageVariant(stage),
                }}
                value={formatValue(rfq.extractedFields?.estimatedValue)}
                meta={[
                  rfq.extractedFields?.lineItems?.length
                    ? `${rfq.extractedFields.lineItems.length} items`
                    : null,
                  rfq.extractedFields?.hazmat ? "Hazmat" : null,
                  rfq.dueDate ? `Due ${formatDate(rfq.dueDate)}` : null,
                ].filter(Boolean) as string[]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function getRfqStage(rfq: RfqItem): string {
  if (rfq.responseStatus === "submitted") return "submitted";
  if (rfq.responseStatus === "completed") return "quoting";
  if (rfq.responseStatus === "draft") return "quoting";
  if (rfq.status === "processed") return "received";
  return "received";
}

function formatValue(value?: number): string | undefined {
  if (!value) return undefined;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
