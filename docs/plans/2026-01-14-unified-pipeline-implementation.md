# Unified Pipeline UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified pipeline dashboard with Action Required, RFQs, Orders, and Archive tabs - enabling quick scan, fast decisions, and clear visibility into what needs attention.

**Architecture:** Tab-based pipeline view at `/pipeline` becomes the primary dashboard. Uses existing drizzle-orm schema with new workflow stage fields. Action Required tab aggregates items from both RFQs and Orders that need attention, grouped by action type.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Drizzle ORM, PostgreSQL, shadcn/ui components

---

## Phase 1: Database Schema & Shared Components

### Task 1.1: Add Workflow Stage Fields to Government Orders

**Files:**
- Modify: `drizzle/migrations/schema.ts`
- Create: `drizzle/migrations/0001_add_order_workflow_fields.sql`

**Step 1: Update the schema.ts to add new fields**

Add after line 228 in `governmentOrders` table (before `createdAt`):

```typescript
  // Workflow stage (replaces simple status)
  stage: varchar("stage", { length: 20 }).default("received"),
  // Values: received, verified, sourcing, fulfilling, qc, ship, closed

  // Sourcing fields
  vendorId: integer("vendor_id"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }),
  otherCost: numeric("other_cost", { precision: 10, scale: 2 }),
  sourcingNotes: text("sourcing_notes"),

  // QC fields
  qcPassed: boolean("qc_passed"),
  qcChecklist: jsonb("qc_checklist"),
  qcNotes: text("qc_notes"),
  qcCompletedAt: timestamp("qc_completed_at"),

  // Shipping fields
  labelUrl: text("label_url"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  shippedAt: timestamp("shipped_at"),
```

**Step 2: Create migration SQL file**

```sql
-- Add workflow stage fields to government_orders
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS stage VARCHAR(20) DEFAULT 'received';
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS vendor_id INTEGER;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS other_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS sourcing_notes TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_passed BOOLEAN;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_checklist JSONB;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_notes TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_completed_at TIMESTAMP;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;

-- Create index on stage
CREATE INDEX IF NOT EXISTS idx_government_orders_stage ON simurgh.government_orders(stage);

-- Migrate existing status to stage
UPDATE simurgh.government_orders SET stage = 'received' WHERE stage IS NULL AND status = 'pending';
UPDATE simurgh.government_orders SET stage = 'qc' WHERE stage IS NULL AND status = 'quality_sheet_created';
UPDATE simurgh.government_orders SET stage = 'ship' WHERE stage IS NULL AND status = 'labels_generated';
UPDATE simurgh.government_orders SET stage = 'ship' WHERE stage IS NULL AND status = 'verified';
UPDATE simurgh.government_orders SET stage = 'closed' WHERE stage IS NULL AND status = 'shipped';
```

**Step 3: Run migration**

```bash
psql $DATABASE_URL -f drizzle/migrations/0001_add_order_workflow_fields.sql
```

**Step 4: Commit**

```bash
git add drizzle/migrations/schema.ts drizzle/migrations/0001_add_order_workflow_fields.sql
git commit -m "feat: add workflow stage fields to government_orders"
```

---

### Task 1.2: Create Vendors Table

**Files:**
- Modify: `drizzle/migrations/schema.ts`
- Modify: `drizzle/migrations/0001_add_order_workflow_fields.sql`

**Step 1: Add vendors table to schema.ts**

Add after `nsnCatalog` table:

```typescript
// Vendors - suppliers for order fulfillment
export const vendors = simurghSchema.table("vendors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("idx_vendors_name").on(table.name),
}));
```

**Step 2: Add vendors table to migration SQL**

Append to migration file:

```sql
-- Create vendors table
CREATE TABLE IF NOT EXISTS simurgh.vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON simurgh.vendors(name);

-- Add foreign key constraint
ALTER TABLE simurgh.government_orders
ADD CONSTRAINT fk_government_orders_vendor
FOREIGN KEY (vendor_id) REFERENCES simurgh.vendors(id);
```

**Step 3: Run migration**

```bash
psql $DATABASE_URL -f drizzle/migrations/0001_add_order_workflow_fields.sql
```

**Step 4: Commit**

```bash
git add drizzle/migrations/schema.ts drizzle/migrations/0001_add_order_workflow_fields.sql
git commit -m "feat: add vendors table for order sourcing"
```

---

### Task 1.3: Create Shared UrgencyDot Component

**Files:**
- Create: `components/shared/UrgencyDot.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/shared/UrgencyDot.tsx
git commit -m "feat: add UrgencyDot component for visual urgency indicators"
```

---

### Task 1.4: Create Shared StatusBadge Component

**Files:**
- Create: `components/shared/StatusBadge.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/shared/StatusBadge.tsx
git commit -m "feat: add StatusBadge component for stage/status display"
```

---

### Task 1.5: Create Shared FilterBar Component

**Files:**
- Create: `components/shared/FilterBar.tsx`

**Step 1: Create the component**

```typescript
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  filters: FilterConfig[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function FilterBar({
  filters,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {filters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{filter.label}:</span>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/shared/FilterBar.tsx
git commit -m "feat: add FilterBar component for list filtering"
```

---

### Task 1.6: Create Barrel Export for Shared Components

**Files:**
- Create: `components/shared/index.ts`

**Step 1: Create barrel export**

```typescript
export { UrgencyDot, getUrgencyFromDueDate, getUrgencyFromStage } from "./UrgencyDot";
export {
  StatusBadge,
  getRfqStageVariant,
  getOrderStageVariant,
  ORDER_STAGE_LABELS,
  RFQ_STAGE_LABELS,
} from "./StatusBadge";
export { FilterBar } from "./FilterBar";
```

**Step 2: Commit**

```bash
git add components/shared/index.ts
git commit -m "feat: add barrel export for shared components"
```

---

## Phase 2: Pipeline Page Foundation

### Task 2.1: Create Pipeline Tabs Component

**Files:**
- Create: `components/pipeline/PipelineTabs.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabConfig {
  id: string;
  label: string;
  count?: number;
}

interface PipelineTabsProps {
  tabs: TabConfig[];
  activeTab: string;
}

export function PipelineTabs({ tabs, activeTab }: PipelineTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "action-required") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    router.push(`/pipeline?${params.toString()}`);
  };

  return (
    <div className="border-b border-slate-200">
      <nav className="flex gap-1" aria-label="Pipeline tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-slate-900 border-b-2 border-slate-900 -mb-px"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-2 px-1.5 py-0.5 rounded text-xs",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/pipeline/PipelineTabs.tsx
git commit -m "feat: add PipelineTabs component for tab navigation"
```

---

### Task 2.2: Create PipelineCard Component

**Files:**
- Create: `components/pipeline/PipelineCard.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/pipeline/PipelineCard.tsx
git commit -m "feat: add PipelineCard component for action items"
```

---

### Task 2.3: Create Pipeline API - Action Required Endpoint

**Files:**
- Create: `app/api/pipeline/action-required/route.ts`

**Step 1: Create the API endpoint**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { sql, eq, and, or, lte, gte, isNull } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface ActionGroup {
  id: string;
  label: string;
  items: ActionItem[];
}

interface ActionItem {
  type: "rfq" | "order";
  id: number;
  identifier: string;
  title: string;
  subtitle: string;
  value: string | null;
  dueDate: Date | null;
  urgency: "urgent" | "attention" | "ready";
  meta: string[];
  actions: { label: string; href: string }[];
}

export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    // Fetch RFQs needing attention
    const rfqsNeedingAction = await db
      .select({
        id: rfqDocuments.id,
        rfqNumber: rfqDocuments.rfqNumber,
        dueDate: rfqDocuments.dueDate,
        contractingOffice: rfqDocuments.contractingOffice,
        extractedFields: rfqDocuments.extractedFields,
        status: rfqDocuments.status,
        hasResponse: sql<boolean>`EXISTS (
          SELECT 1 FROM ${rfqResponses}
          WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
          AND ${rfqResponses.status} != 'draft'
        )`.as('has_response'),
      })
      .from(rfqDocuments)
      .where(
        and(
          eq(rfqDocuments.status, "processed"),
          sql`NOT EXISTS (
            SELECT 1 FROM ${rfqResponses}
            WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
            AND ${rfqResponses.status} IN ('completed', 'submitted')
          )`
        )
      );

    // Fetch Orders by stage
    const ordersNeedingAction = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        productName: governmentOrders.productName,
        nsn: governmentOrders.nsn,
        quantity: governmentOrders.quantity,
        unitOfMeasure: governmentOrders.unitOfMeasure,
        totalPrice: governmentOrders.totalPrice,
        deliveryDate: governmentOrders.deliveryDate,
        stage: governmentOrders.stage,
        status: governmentOrders.status,
      })
      .from(governmentOrders)
      .where(
        sql`${governmentOrders.stage} NOT IN ('closed')`
      );

    // Group items by action type
    const groups: ActionGroup[] = [];

    // DUE TODAY - RFQs with response due today
    const dueTodayRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due.toDateString() === today.toDateString();
    });

    if (dueTodayRfqs.length > 0) {
      groups.push({
        id: "due-today",
        label: "DUE TODAY",
        items: dueTodayRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "urgent" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
            { label: "Start Quote", href: `/rfq/${rfq.id}/fill` },
          ],
        })),
      });
    }

    // DUE THIS WEEK - RFQs due within 7 days
    const dueThisWeekRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due > today && due <= endOfWeek;
    });

    if (dueThisWeekRfqs.length > 0) {
      groups.push({
        id: "due-this-week",
        label: "DUE THIS WEEK",
        items: dueThisWeekRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "attention" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
            { label: "Start Quote", href: `/rfq/${rfq.id}/fill` },
          ],
        })),
      });
    }

    // NEEDS VERIFICATION - Orders in received stage
    const needsVerification = ordersNeedingAction.filter(o => o.stage === "received");
    if (needsVerification.length > 0) {
      groups.push({
        id: "needs-verification",
        label: "NEEDS VERIFICATION",
        items: needsVerification.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "attention" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`, order.nsn || 'No NSN'],
          actions: [
            { label: "Verify Order", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // NEEDS SOURCING - Orders in verified or sourcing stage
    const needsSourcing = ordersNeedingAction.filter(o =>
      o.stage === "verified" || o.stage === "sourcing"
    );
    if (needsSourcing.length > 0) {
      groups.push({
        id: "needs-sourcing",
        label: "NEEDS SOURCING",
        items: needsSourcing.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "attention" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Add Vendor + Cost", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // READY FOR QC - Orders in fulfilling or qc stage
    const readyForQc = ordersNeedingAction.filter(o =>
      o.stage === "fulfilling" || o.stage === "qc"
    );
    if (readyForQc.length > 0) {
      groups.push({
        id: "ready-for-qc",
        label: "READY FOR QC",
        items: readyForQc.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "ready" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Start QC Checklist", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // READY TO SHIP - Orders in ship stage
    const readyToShip = ordersNeedingAction.filter(o => o.stage === "ship");
    if (readyToShip.length > 0) {
      groups.push({
        id: "ready-to-ship",
        label: "READY TO SHIP",
        items: readyToShip.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "ready" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Print Label", href: `/orders/${order.id}` },
            { label: "Mark Shipped", href: `/orders/${order.id}?action=ship` },
          ],
        })),
      });
    }

    // OVERDUE - RFQs past due date
    const overdueRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due < today;
    });

    if (overdueRfqs.length > 0) {
      groups.push({
        id: "overdue",
        label: "OVERDUE",
        items: overdueRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "urgent" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
          ],
        })),
      });
    }

    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

    return apiSuccess({
      groups,
      totalCount,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching action required items", error);
    return apiError("Failed to fetch action items", 500);
  }
}

function formatValue(extractedFields: unknown): string | null {
  if (!extractedFields || typeof extractedFields !== 'object') return null;
  const fields = extractedFields as Record<string, unknown>;
  if (fields.estimatedValue) {
    const val = Number(fields.estimatedValue);
    if (!isNaN(val)) {
      return `$${val.toLocaleString()}`;
    }
  }
  return null;
}

function getItemMeta(extractedFields: unknown): string[] {
  const meta: string[] = [];
  if (!extractedFields || typeof extractedFields !== 'object') return meta;
  const fields = extractedFields as Record<string, unknown>;

  if (fields.lineItems && Array.isArray(fields.lineItems)) {
    meta.push(`${fields.lineItems.length} items`);
  }
  if (fields.hazmat) {
    meta.push("Hazmat");
  }
  return meta;
}
```

**Step 2: Commit**

```bash
git add app/api/pipeline/action-required/route.ts
git commit -m "feat: add action-required API endpoint for pipeline"
```

---

### Task 2.4: Create Pipeline API - Stats Endpoint

**Files:**
- Create: `app/api/pipeline/stats/route.ts`

**Step 1: Create the API endpoint**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { sql, eq, and } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // Count action required items
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    // RFQs needing action (processed but not responded)
    const rfqsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments)
      .where(
        and(
          eq(rfqDocuments.status, "processed"),
          sql`NOT EXISTS (
            SELECT 1 FROM ${rfqResponses}
            WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
            AND ${rfqResponses.status} IN ('completed', 'submitted')
          )`
        )
      );

    // Total RFQs
    const totalRfqsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments);

    // Orders not closed
    const ordersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders)
      .where(sql`${governmentOrders.stage} != 'closed' OR ${governmentOrders.stage} IS NULL`);

    // Total orders
    const totalOrdersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders);

    // Count by order stage
    const ordersByStage = await db
      .select({
        stage: governmentOrders.stage,
        count: sql<number>`count(*)`,
      })
      .from(governmentOrders)
      .groupBy(governmentOrders.stage);

    const stageCountsMap = Object.fromEntries(
      ordersByStage.map(s => [s.stage || 'received', Number(s.count)])
    );

    return apiSuccess({
      actionRequired: Number(rfqsResult[0]?.count || 0) + Number(ordersResult[0]?.count || 0),
      rfqs: Number(totalRfqsResult[0]?.count || 0),
      orders: Number(totalOrdersResult[0]?.count || 0),
      ordersByStage: stageCountsMap,
    });
  } catch (error) {
    logger.error("Error fetching pipeline stats", error);
    return apiError("Failed to fetch stats", 500);
  }
}
```

**Step 2: Commit**

```bash
git add app/api/pipeline/stats/route.ts
git commit -m "feat: add pipeline stats API endpoint"
```

---

### Task 2.5: Create ActionRequiredList Component

**Files:**
- Create: `components/pipeline/ActionRequiredList.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/pipeline/ActionRequiredList.tsx
git commit -m "feat: add ActionRequiredList component"
```

---

### Task 2.6: Create Pipeline Page

**Files:**
- Create: `app/pipeline/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PipelineTabs } from "@/components/pipeline/PipelineTabs";
import { ActionRequiredList } from "@/components/pipeline/ActionRequiredList";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  actionRequired: number;
  rfqs: number;
  orders: number;
}

interface ActionGroup {
  id: string;
  label: string;
  items: ActionItem[];
}

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

function PipelineContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "action-required";

  const [stats, setStats] = useState<Stats>({ actionRequired: 0, rfqs: 0, orders: 0 });
  const [actionGroups, setActionGroups] = useState<ActionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, actionsRes] = await Promise.all([
        fetch("/api/pipeline/stats"),
        fetch("/api/pipeline/action-required"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (actionsRes.ok) {
        const data = await actionsRes.json();
        setActionGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch pipeline data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "action-required", label: "Action Required", count: stats.actionRequired },
    { id: "rfqs", label: "RFQs", count: stats.rfqs },
    { id: "orders", label: "Orders", count: stats.orders },
    { id: "archive", label: "Archive" },
  ];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
            <p className="text-slate-500">Quick overview of what needs attention</p>
          </div>
          <div className="text-sm text-slate-500">{today}</div>
        </div>

        {/* Tabs */}
        <Card className="mb-6">
          <PipelineTabs tabs={tabs} activeTab={activeTab} />
          <CardContent className="p-6">
            {activeTab === "action-required" && (
              <ActionRequiredList groups={actionGroups} loading={loading} />
            )}
            {activeTab === "rfqs" && (
              <div className="text-center py-12 text-slate-500">
                RFQs list coming soon...
              </div>
            )}
            {activeTab === "orders" && (
              <div className="text-center py-12 text-slate-500">
                Orders list coming soon...
              </div>
            )}
            {activeTab === "archive" && (
              <div className="text-center py-12 text-slate-500">
                Archive coming soon...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PipelineContent />
    </Suspense>
  );
}
```

**Step 2: Commit**

```bash
git add app/pipeline/page.tsx
git commit -m "feat: add pipeline page with action required tab"
```

---

### Task 2.7: Create Barrel Export for Pipeline Components

**Files:**
- Create: `components/pipeline/index.ts`

**Step 1: Create barrel export**

```typescript
export { PipelineTabs } from "./PipelineTabs";
export { PipelineCard } from "./PipelineCard";
export { ActionRequiredList } from "./ActionRequiredList";
```

**Step 2: Commit**

```bash
git add components/pipeline/index.ts
git commit -m "feat: add barrel export for pipeline components"
```

---

### Task 2.8: Update Root Page Redirect

**Files:**
- Modify: `app/page.tsx`

**Step 1: Check current root page and update if needed**

If the root page currently shows a dashboard, update it to redirect to `/pipeline`:

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/pipeline");
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redirect root to pipeline page"
```

---

## Phase 3: RFQs Tab

### Task 3.1: Create RfqList Component

**Files:**
- Create: `components/pipeline/RfqList.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { PipelineCard } from "./PipelineCard";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  StatusBadge,
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
```

**Step 2: Commit**

```bash
git add components/pipeline/RfqList.tsx
git commit -m "feat: add RfqList component with filtering"
```

---

### Task 3.2: Create RFQs API with Filtering

**Files:**
- Modify: `app/api/rfq/route.ts`

**Step 1: Update the GET endpoint to support filters**

Add query parameter handling for stage/due filtering. The existing endpoint likely just returns all RFQs - enhance it to return response status:

```typescript
// Add to the select query
const rfqsWithResponse = await db
  .select({
    id: rfqDocuments.id,
    rfqNumber: rfqDocuments.rfqNumber,
    fileName: rfqDocuments.fileName,
    s3Url: rfqDocuments.s3Url,
    dueDate: rfqDocuments.dueDate,
    contractingOffice: rfqDocuments.contractingOffice,
    extractedFields: rfqDocuments.extractedFields,
    status: rfqDocuments.status,
    createdAt: rfqDocuments.createdAt,
    responseStatus: sql<string>`(
      SELECT ${rfqResponses.status} FROM ${rfqResponses}
      WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
      ORDER BY ${rfqResponses.createdAt} DESC
      LIMIT 1
    )`.as('response_status'),
  })
  .from(rfqDocuments)
  .orderBy(desc(rfqDocuments.createdAt));
```

**Step 2: Commit**

```bash
git add app/api/rfq/route.ts
git commit -m "feat: enhance RFQ API with response status"
```

---

### Task 3.3: Update Pipeline Page with RFQs Tab

**Files:**
- Modify: `app/pipeline/page.tsx`

**Step 1: Add RfqList import and state**

```typescript
import { RfqList } from "@/components/pipeline/RfqList";

// Add to state
const [rfqs, setRfqs] = useState<RfqItem[]>([]);

// Add to fetchData
const rfqsRes = await fetch("/api/rfq");
if (rfqsRes.ok) {
  const data = await rfqsRes.json();
  setRfqs(data.documents || []);
}

// Update the rfqs tab content
{activeTab === "rfqs" && (
  <RfqList rfqs={rfqs} loading={loading} />
)}
```

**Step 2: Commit**

```bash
git add app/pipeline/page.tsx
git commit -m "feat: add RFQs tab to pipeline page"
```

---

### Task 3.4: Update Pipeline Components Barrel Export

**Files:**
- Modify: `components/pipeline/index.ts`

**Step 1: Add RfqList export**

```typescript
export { RfqList } from "./RfqList";
```

**Step 2: Commit**

```bash
git add components/pipeline/index.ts
git commit -m "feat: export RfqList from pipeline components"
```

---

## Phase 4: Orders Tab

### Task 4.1: Create OrderList Component

**Files:**
- Create: `components/pipeline/OrderList.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { PipelineCard } from "./PipelineCard";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  StatusBadge,
  getOrderStageVariant,
  ORDER_STAGE_LABELS
} from "@/components/shared/StatusBadge";
import { getUrgencyFromStage } from "@/components/shared/UrgencyDot";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface OrderItem {
  id: number;
  poNumber: string;
  productName: string;
  nsn: string | null;
  quantity: number;
  unitOfMeasure: string | null;
  totalPrice: string | null;
  deliveryDate: string | null;
  stage: string | null;
  status: string;
}

interface OrderListProps {
  orders: OrderItem[];
  loading?: boolean;
  onUpload?: () => void;
}

const STAGE_OPTIONS = [
  { value: "all", label: "All Stages" },
  { value: "received", label: "Received" },
  { value: "verified", label: "Verified" },
  { value: "sourcing", label: "Sourcing" },
  { value: "fulfilling", label: "Fulfilling" },
  { value: "qc", label: "QC" },
  { value: "ship", label: "Ship" },
  { value: "closed", label: "Closed" },
];

const SHIP_BY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "overdue", label: "Overdue" },
];

export function OrderList({ orders, loading, onUpload }: OrderListProps) {
  const [stageFilter, setStageFilter] = useState("all");
  const [shipByFilter, setShipByFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredOrders = orders.filter((order) => {
    // Stage filter
    if (stageFilter !== "all") {
      const stage = order.stage || mapOldStatusToStage(order.status);
      if (stage !== stageFilter) return false;
    }

    // Ship by filter
    if (shipByFilter !== "all" && order.deliveryDate) {
      const due = new Date(order.deliveryDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 7);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      switch (shipByFilter) {
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
      const matchesPo = order.poNumber?.toLowerCase().includes(term);
      const matchesProduct = order.productName?.toLowerCase().includes(term);
      const matchesNsn = order.nsn?.toLowerCase().includes(term);
      if (!matchesPo && !matchesProduct && !matchesNsn) return false;
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
              id: "shipBy",
              label: "Ship By",
              options: SHIP_BY_OPTIONS,
              value: shipByFilter,
              onChange: setShipByFilter,
            },
          ]}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search PO#, product, or NSN..."
        />
        {onUpload && (
          <Button onClick={onUpload} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Upload
          </Button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No orders match your filters
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const stage = order.stage || mapOldStatusToStage(order.status);
            const urgency = getUrgencyFromStage(stage);

            return (
              <PipelineCard
                key={order.id}
                id={order.id}
                href={`/orders/${order.id}`}
                title={`PO ${order.poNumber}`}
                subtitle={order.productName}
                urgency={urgency}
                badge={{
                  label: ORDER_STAGE_LABELS[stage] || stage,
                  variant: getOrderStageVariant(stage),
                }}
                value={order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : undefined}
                meta={[
                  `${order.quantity} ${order.unitOfMeasure || 'units'}`,
                  order.nsn || null,
                  order.deliveryDate ? `Ship by ${formatDate(order.deliveryDate)}` : null,
                ].filter(Boolean) as string[]}
                actions={getOrderActions(stage, order.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function mapOldStatusToStage(status: string): string {
  switch (status) {
    case "pending": return "received";
    case "quality_sheet_created": return "qc";
    case "labels_generated": return "ship";
    case "verified": return "ship";
    case "shipped": return "closed";
    default: return "received";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getOrderActions(stage: string, orderId: number): { label: string; href: string; variant?: "default" | "outline" }[] {
  switch (stage) {
    case "received":
      return [{ label: "Verify", href: `/orders/${orderId}` }];
    case "verified":
    case "sourcing":
      return [{ label: "Add Vendor + Cost", href: `/orders/${orderId}` }];
    case "fulfilling":
    case "qc":
      return [{ label: "Start QC", href: `/orders/${orderId}` }];
    case "ship":
      return [
        { label: "Print Label", href: `/orders/${orderId}`, variant: "outline" },
        { label: "Mark Shipped", href: `/orders/${orderId}?action=ship` },
      ];
    default:
      return [];
  }
}
```

**Step 2: Commit**

```bash
git add components/pipeline/OrderList.tsx
git commit -m "feat: add OrderList component with stage filtering"
```

---

### Task 4.2: Update Pipeline Page with Orders Tab

**Files:**
- Modify: `app/pipeline/page.tsx`

**Step 1: Add OrderList import and state**

```typescript
import { OrderList } from "@/components/pipeline/OrderList";

// Update the orders tab content
{activeTab === "orders" && (
  <OrderList orders={orders} loading={loading} />
)}
```

**Step 2: Commit**

```bash
git add app/pipeline/page.tsx
git commit -m "feat: add Orders tab to pipeline page"
```

---

### Task 4.3: Update Pipeline Components Barrel Export

**Files:**
- Modify: `components/pipeline/index.ts`

**Step 1: Add OrderList export**

```typescript
export { OrderList } from "./OrderList";
```

**Step 2: Commit**

```bash
git add components/pipeline/index.ts
git commit -m "feat: export OrderList from pipeline components"
```

---

## Phase 5: Order Stage Transitions

### Task 5.1: Create Order Stage Transition API

**Files:**
- Create: `app/api/orders/[id]/stage/route.ts`

**Step 1: Create the API endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { z } from "zod";

const StageTransitionSchema = z.object({
  stage: z.enum(["received", "verified", "sourcing", "fulfilling", "qc", "ship", "closed"]),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ["verified"],
  verified: ["sourcing"],
  sourcing: ["fulfilling"],
  fulfilling: ["qc"],
  qc: ["ship"],
  ship: ["closed"],
  closed: [],
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return apiError("Invalid order ID", 400);
    }

    const body = await request.json();
    const validation = StageTransitionSchema.safeParse(body);

    if (!validation.success) {
      return apiError("Invalid stage", 400);
    }

    const { stage: newStage } = validation.data;

    // Get current order
    const [order] = await db
      .select({ stage: governmentOrders.stage })
      .from(governmentOrders)
      .where(eq(governmentOrders.id, orderId));

    if (!order) {
      return apiError("Order not found", 404);
    }

    const currentStage = order.stage || "received";

    // Validate transition
    const allowedNextStages = VALID_TRANSITIONS[currentStage] || [];
    if (!allowedNextStages.includes(newStage)) {
      return apiError(
        `Cannot transition from ${currentStage} to ${newStage}. Allowed: ${allowedNextStages.join(", ")}`,
        400
      );
    }

    // Update stage
    const updateData: Record<string, unknown> = {
      stage: newStage,
      updatedAt: new Date(),
    };

    // Set timestamps for specific stages
    if (newStage === "closed") {
      updateData.shippedAt = new Date();
    }

    const [updated] = await db
      .update(governmentOrders)
      .set(updateData)
      .where(eq(governmentOrders.id, orderId))
      .returning();

    return apiSuccess({ order: updated });
  } catch (error) {
    logger.error("Error updating order stage", error);
    return apiError("Failed to update order stage", 500);
  }
}
```

**Step 2: Commit**

```bash
git add app/api/orders/[id]/stage/route.ts
git commit -m "feat: add order stage transition API"
```

---

### Task 5.2: Create OrderStageProgress Component

**Files:**
- Create: `components/order/OrderStageProgress.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STAGES = [
  { id: "received", label: "Received" },
  { id: "verified", label: "Verified" },
  { id: "sourcing", label: "Sourcing" },
  { id: "fulfilling", label: "Fulfilling" },
  { id: "qc", label: "QC" },
  { id: "ship", label: "Ship" },
  { id: "closed", label: "Closed" },
];

interface OrderStageProgressProps {
  currentStage: string;
  className?: string;
}

export function OrderStageProgress({ currentStage, className }: OrderStageProgressProps) {
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STAGES.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={stage.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                isCompleted && "bg-green-500 text-white",
                isCurrent && "bg-slate-900 text-white",
                !isCompleted && !isCurrent && "bg-slate-200 text-slate-500"
              )}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="sr-only">{stage.label}</span>
              )}
            </div>
            <span
              className={cn(
                "ml-1 text-xs hidden sm:inline",
                isCurrent && "font-medium text-slate-900",
                !isCurrent && "text-slate-500"
              )}
            >
              {stage.label}
            </span>
            {index < STAGES.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-1",
                  index < currentIndex ? "bg-green-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/order/OrderStageProgress.tsx
git commit -m "feat: add OrderStageProgress component"
```

---

### Task 5.3: Create Order Components Barrel Export

**Files:**
- Create: `components/order/index.ts`

**Step 1: Create barrel export**

```typescript
export { OrderStageProgress } from "./OrderStageProgress";
```

**Step 2: Commit**

```bash
git add components/order/index.ts
git commit -m "feat: add barrel export for order components"
```

---

## Phase 6: Verification & Testing

### Task 6.1: Run Database Migration

**Step 1: Apply the migration**

```bash
psql $DATABASE_URL -f drizzle/migrations/0001_add_order_workflow_fields.sql
```

**Step 2: Verify migration**

```bash
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_schema = 'simurgh' AND table_name = 'government_orders' AND column_name = 'stage';"
```

Expected: Returns `stage` row

---

### Task 6.2: Start Dev Server and Test

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Navigate to pipeline page**

Open browser to `http://localhost:3000/pipeline`

**Step 3: Verify tabs work**

- Click each tab (Action Required, RFQs, Orders, Archive)
- Verify counts show in tab badges
- Verify filtering works on RFQs and Orders tabs

---

### Task 6.3: Final Commit

```bash
git add -A
git commit -m "feat: complete Phase 1-5 of unified pipeline UI"
```

---

## Summary

This plan implements the core unified pipeline UI:

1. **Phase 1**: Database schema changes + shared components (UrgencyDot, StatusBadge, FilterBar)
2. **Phase 2**: Pipeline page foundation with tabs and Action Required list
3. **Phase 3**: RFQs tab with filtering
4. **Phase 4**: Orders tab with stage filtering
5. **Phase 5**: Order stage transitions

**Not included (future phases):**
- Sourcing form with vendor management
- QC checklist component
- Label generation enhancements
- Archive tab implementation
- RFQ detail view refinements
