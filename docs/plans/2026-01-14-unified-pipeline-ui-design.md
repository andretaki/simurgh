# Unified Pipeline UI Design

## Overview

Minimalist, action-focused UI for government RFQ processing and order fulfillment. Desktop-first design for Boss/Owner doing quick review, bid/no-bid decisions, and order tracking.

**Primary User:** Boss/Owner
**Primary Goal:** Quick scan, fast decisions, clear visibility into what needs attention
**Device:** Desktop-first

## Core Problems to Solve

1. **Too cluttered** - Hard to find what matters
2. **Too many clicks** - Takes too long to get to actions
3. **Poor visibility** - Can't quickly see what needs attention

## Design Approach: Unified Pipeline with Stage Tabs

Hybrid approach combining benefits of Kanban visibility with list efficiency.

```
┌─────────────────────────────────────────────────────────────┐
│  [Action Required (7)]  [RFQs (23)]  [Orders (12)]  [Archive] │
├─────────────────────────────────────────────────────────────┤
│  Stage: [All ▾]   Due: [This Week ▾]   Search: [________]   │
├─────────────────────────────────────────────────────────────┤
│  (List of items)                                            │
└─────────────────────────────────────────────────────────────┘
```

**Why this approach:**
- "Action Required" tab = Kanban "Now" column as filtered list
- Stage dropdown = see any pipeline stage without horizontal scroll
- Compact rows = see 15-20 items at once vs 5-6 Kanban cards
- Color dots = instant urgency recognition (red/yellow/green)

---

## Tab 1: Action Required (Home View)

The money tab. Shows ONLY items needing decisions or action, grouped by action type.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTION REQUIRED (7)                          Today: Jan 14     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DUE TODAY ──────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔴 SPE4A6-25-Q-0047        DLA Troop Support    $12,400   │ │
│  │    Bid/No-Bid?    3 items · Hazmat · Due 5:00 PM         │ │
│  │    [No Bid]  [Start Quote →]                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  NEEDS SOURCING ─────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟡 PO SPE4A6-25-P-0891                          $8,200    │ │
│  │    Waiting on vendor     2 items · Est. ship: Jan 18     │ │
│  │    [Add Vendor + Cost →]                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  READY TO SHIP ──────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 PO SPE4A6-25-P-0234                          $4,100    │ │
│  │    QC passed, label ready     1 item · Ship by: Jan 16   │ │
│  │    [Print Label]  [Mark Shipped →]                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Action Groups (in priority order)

1. **DUE TODAY** - RFQs with response due today
2. **DUE THIS WEEK** - RFQs due within 7 days
3. **NEEDS VERIFICATION** - New POs requiring review
4. **NEEDS SOURCING** - Verified POs awaiting vendor/cost
5. **READY FOR QC** - Sourced items ready for quality check
6. **READY TO SHIP** - QC passed, labels ready
7. **OVERDUE** - Anything past its deadline

### Design Principles

- **Grouped by action type** - Not mixed together
- **Inline actions** - No-Bid, Start Quote, Mark Shipped right on the card
- **One-click decisions** - No navigating for simple actions
- **Color = urgency** - 🔴 Red (today/overdue), 🟡 Yellow (soon/waiting), 🟢 Green (ready)

---

## Tab 2: RFQs

Full list of all RFQs with stage filtering.

### RFQ Stages

```
[Received] → [Reviewing] → [Quoting] → [Submitted] → [Won/Lost/Expired]
```

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  RFQs (23)                                                      │
├─────────────────────────────────────────────────────────────────┤
│  Stage: [All ▾]   Due: [All ▾]   Agency: [All ▾]   [+ Upload]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-Q-0047          Received    Due: Jan 14  $12.4K │ │
│  │ DLA Troop Support · 3 items · Hazmat                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-Q-0052          Quoting     Due: Jan 18  $8.2K  │ │
│  │ DLA Aviation · 2 items · Draft saved                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-Q-0038          Won         Closed      $15.1K  │ │
│  │ DLA Land · 5 items · PO received                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Row Information

- RFQ Number (clickable → detail view)
- Stage badge
- Due date (or closed date)
- Estimated value
- Agency/Customer
- Item count
- Flags (Hazmat, Draft saved, etc.)

### Quick Filters

- **Stage dropdown:** All, Received, Reviewing, Quoting, Submitted, Won, Lost, Expired
- **Due dropdown:** All, Today, This Week, This Month, Overdue
- **Agency dropdown:** All, DLA, ASRC Federal, etc.

---

## Tab 3: Orders

Full list of POs with workflow stage filtering.

### Order Workflow Stages

```
[Received] → [Verified] → [Sourcing] → [Fulfilling] → [QC] → [Ship] → [Closed]
```

### Stage Definitions

| Stage | Description | Exit Criteria |
|-------|-------------|---------------|
| **Received** | PO just came in | Boss reviews and confirms details |
| **Verified** | Details confirmed correct | Ready to source product |
| **Sourcing** | Finding vendor, getting quotes | Vendor selected, cost recorded |
| **Fulfilling** | Product ordered/in transit | Product received at warehouse |
| **QC** | Quality inspection | Checklist passed, label generated |
| **Ship** | Ready to ship | Tracking number entered |
| **Closed** | Delivered | Proof of delivery confirmed |

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ORDERS (12)                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Stage: [All ▾]   Ship By: [All ▾]   Search: [________]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-P-0891          Sourcing    Ship: Jan 18  $8.2K │ │
│  │ 2 items · Waiting on vendor quote                         │ │
│  │ [Add Vendor + Cost]                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-P-0234          QC          Ship: Jan 16  $4.1K │ │
│  │ 1 item · Ready for inspection                             │ │
│  │ [Start QC Checklist]                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SPE4A6-25-P-0567          Ship        Ship: Jan 15  $6.8K │ │
│  │ 3 items · Label printed, ready to ship                    │ │
│  │ [Mark Shipped]                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detail Views

### RFQ Detail View

Accessed by clicking an RFQ row. Slide-out panel or full page.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                          [View PDF]     │
├─────────────────────────────────────────────────────────────────┤
│  SPE4A6-25-Q-0047                                               │
│  DLA Troop Support                              Stage: Received │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DUE DATE        ESTIMATED VALUE       ITEMS                    │
│  Jan 14, 5:00 PM    $12,400            3                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LINE ITEMS                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 1. NSN 5340-01-234-5678                                   │ │
│  │    Hardware, Door Hinge · Qty: 100 · Est: $45.00/ea       │ │
│  │    ⚠️ Hazmat                                               │ │
│  │    [Bid] [No Bid]  Unit Price: [______]                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 2. NSN 5340-01-234-5679                                   │ │
│  │    Bracket, Mounting · Qty: 50 · Est: $82.00/ea           │ │
│  │    [Bid] [No Bid]  Unit Price: [______]                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ACTIONS                                                        │
│  [Save Draft]  [No Bid All]  [Generate Quote PDF →]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Order Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                          [View PO PDF]  │
├─────────────────────────────────────────────────────────────────┤
│  PO SPE4A6-25-P-0891                                            │
│  From RFQ: SPE4A6-25-Q-0052                     Stage: Sourcing │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SHIP BY          ORDER VALUE        MARGIN                     │
│  Jan 18           $8,200             TBD (need cost)            │
│                                                                 │
│  SHIP TO                                                        │
│  DLA Distribution Center                                        │
│  123 Military Way, Richmond, VA 23297                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  STAGE PROGRESS                                                 │
│  [✓ Received] [✓ Verified] [● Sourcing] [○ Fulfill] [○ QC] [○ Ship] │
├─────────────────────────────────────────────────────────────────┤
│  LINE ITEMS                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 1. NSN 5340-01-234-5679                                   │ │
│  │    Bracket, Mounting · Qty: 50 · Unit: $82.00             │ │
│  │                                                            │ │
│  │    SOURCING                                                │ │
│  │    Vendor: [________________]                              │ │
│  │    Unit Cost: [______]  Total Cost: [______]              │ │
│  │    Margin: --                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Save]  [Mark Sourced →]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## QC Checklist + Label Generation

When order reaches QC stage, show checklist and label generation.

### QC View

```
┌─────────────────────────────────────────────────────────────────┐
│  QC INSPECTION - PO SPE4A6-25-P-0234                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CHECKLIST                                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ □ Product matches NSN description                         │ │
│  │ □ Quantity matches PO (50 units)                          │ │
│  │ □ No visible damage or defects                            │ │
│  │ □ Packaging intact                                         │ │
│  │ □ Country of origin verified (if required)                │ │
│  │ □ Certifications/test reports attached (if required)      │ │
│  │ □ Hazmat packaging compliant (if applicable)              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  NOTES                                                          │
│  [___________________________________________________________] │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SHIPPING LABEL                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    [LABEL PREVIEW]                        │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │ FROM: Your Company                                  │ │ │
│  │  │ TO: DLA Distribution Center                         │ │ │
│  │  │     123 Military Way                                │ │ │
│  │  │     Richmond, VA 23297                              │ │ │
│  │  │                                                      │ │ │
│  │  │ PO: SPE4A6-25-P-0234                                │ │ │
│  │  │ NSN: 5340-01-234-5678                               │ │ │
│  │  │ QTY: 50                                              │ │ │
│  │  │                                                      │ │ │
│  │  │ [BARCODE]                                            │ │ │
│  │  │                                                      │ │ │
│  │  │ ⚠️ HAZMAT SYMBOL (if applicable)                     │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Generate Label]  [Print Label]                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Fail QC]  [Pass QC + Generate Label →]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Label Generation (Python Backend)

MIL-STD-129 compliant shipping labels with hazmat support.

**Label Data Required:**
- Ship From (company address, CAGE code)
- Ship To (destination address)
- PO Number
- Contract Number
- NSN(s)
- Quantity per NSN
- Weight
- Hazmat info (UN number, proper shipping name, hazard class, symbols)

**Label Output:**
- PDF format
- Standard label sizes (4x6", 8.5x11")
- Code 128 or Code 39 barcodes
- MIL-STD-129 compliant layout
- Hazmat diamond symbols when applicable

**Python Label Service:**
```
POST /api/labels/generate
{
  "orderId": "uuid",
  "format": "4x6" | "letter",
  "includeHazmat": true
}

Response:
{
  "labelUrl": "s3://...",
  "previewBase64": "..."
}
```

---

## Sourcing Flow

When order is in Sourcing stage:

```
┌─────────────────────────────────────────────────────────────────┐
│  SOURCING - PO SPE4A6-25-P-0891                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LINE ITEM 1 of 2                                               │
│  NSN 5340-01-234-5679 · Bracket, Mounting                       │
│  Qty: 50 · Sell Price: $82.00/ea · Total: $4,100                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ VENDOR                                                     │ │
│  │ [Acme Industrial Supply      ▾]  [+ Add New Vendor]       │ │
│  │                                                            │ │
│  │ COST                                                       │ │
│  │ Unit Cost: [$52.00    ]                                    │ │
│  │ Shipping:  [$150.00   ]                                    │ │
│  │ Other:     [$0.00     ]                                    │ │
│  │ ─────────────────────────                                  │ │
│  │ Total Cost: $2,750.00                                      │ │
│  │                                                            │ │
│  │ MARGIN                                                     │ │
│  │ Revenue:  $4,100.00                                        │ │
│  │ Cost:     $2,750.00                                        │ │
│  │ Margin:   $1,350.00 (32.9%)  ✓                            │ │
│  │                                                            │ │
│  │ NOTES                                                      │ │
│  │ [Lead time 5 days, ships from OH___________________]      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [← Previous Item]  [Save]  [Next Item →]                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ALL ITEMS SOURCED: [Mark Order Sourced →]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Color System

| Color | Meaning | Use Cases |
|-------|---------|-----------|
| 🔴 Red | Urgent/Overdue | Due today, overdue, failed QC |
| 🟡 Yellow | Attention needed | Due soon, waiting on action |
| 🟢 Green | Ready/Good | Ready to proceed, healthy margin |
| ⚪ Gray | Inactive/Done | Archived, closed |

---

## Navigation Structure

```
/                     → Redirects to /pipeline
/pipeline             → Action Required tab (default)
/pipeline?tab=rfqs    → RFQs tab
/pipeline?tab=orders  → Orders tab
/pipeline?tab=archive → Archive tab

/rfq/[id]             → RFQ detail view
/rfq/[id]/quote       → Quote builder

/order/[id]           → Order detail view
/order/[id]/source    → Sourcing view
/order/[id]/qc        → QC checklist + label

/settings             → App settings
/settings/company     → Company profile
/settings/vendors     → Vendor management
```

---

## Component Architecture

```
components/
├── pipeline/
│   ├── PipelineTabs.tsx        # Tab navigation
│   ├── ActionRequiredList.tsx   # Grouped action items
│   ├── RfqList.tsx             # RFQ list with filters
│   ├── OrderList.tsx           # Order list with filters
│   └── PipelineCard.tsx        # Reusable item card
│
├── rfq/
│   ├── RfqDetail.tsx           # RFQ detail view
│   ├── RfqLineItem.tsx         # Line item with bid/no-bid
│   └── QuoteBuilder.tsx        # Quote PDF generation
│
├── order/
│   ├── OrderDetail.tsx         # Order detail view
│   ├── OrderStageProgress.tsx  # Stage indicator bar
│   ├── SourcingForm.tsx        # Vendor + cost entry
│   ├── QcChecklist.tsx         # Quality checklist
│   └── LabelPreview.tsx        # Label preview component
│
└── shared/
    ├── StatusBadge.tsx         # Stage/status badges
    ├── UrgencyDot.tsx          # Color urgency indicator
    ├── QuickAction.tsx         # Inline action buttons
    └── FilterBar.tsx           # Dropdown filters
```

---

## API Endpoints Needed

### Pipeline
- `GET /api/pipeline/action-required` - Items needing attention
- `GET /api/pipeline/stats` - Counts by stage

### RFQs
- `GET /api/rfq` - List with filters
- `GET /api/rfq/[id]` - Detail
- `POST /api/rfq/[id]/no-bid` - Mark as no-bid
- `POST /api/rfq/[id]/quote` - Save/generate quote

### Orders
- `GET /api/orders` - List with filters
- `GET /api/orders/[id]` - Detail
- `POST /api/orders/[id]/verify` - Mark verified
- `POST /api/orders/[id]/source` - Save sourcing data
- `POST /api/orders/[id]/qc` - Save QC checklist
- `POST /api/orders/[id]/ship` - Mark shipped

### Labels
- `POST /api/labels/generate` - Generate MIL-STD-129 label
- `GET /api/labels/[id]` - Get label PDF

---

## Database Schema Changes

### New Fields on `government_orders`

```sql
ALTER TABLE government_orders ADD COLUMN stage VARCHAR(20) DEFAULT 'received';
-- Values: received, verified, sourcing, fulfilling, qc, ship, closed

ALTER TABLE government_orders ADD COLUMN vendor_id UUID REFERENCES vendors(id);
ALTER TABLE government_orders ADD COLUMN unit_cost DECIMAL(10,2);
ALTER TABLE government_orders ADD COLUMN shipping_cost DECIMAL(10,2);
ALTER TABLE government_orders ADD COLUMN other_cost DECIMAL(10,2);
ALTER TABLE government_orders ADD COLUMN sourcing_notes TEXT;

ALTER TABLE government_orders ADD COLUMN qc_passed BOOLEAN;
ALTER TABLE government_orders ADD COLUMN qc_checklist JSONB;
ALTER TABLE government_orders ADD COLUMN qc_notes TEXT;
ALTER TABLE government_orders ADD COLUMN qc_completed_at TIMESTAMP;

ALTER TABLE government_orders ADD COLUMN label_url TEXT;
ALTER TABLE government_orders ADD COLUMN tracking_number TEXT;
ALTER TABLE government_orders ADD COLUMN shipped_at TIMESTAMP;
```

### New `vendors` Table

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Implementation Priority

### Phase 1: Core Pipeline View
1. Create `/pipeline` page with tabs
2. Build ActionRequiredList component
3. Build PipelineCard component
4. Implement `GET /api/pipeline/action-required`

### Phase 2: RFQ Flow
1. RfqList with filters
2. RfqDetail view
3. Inline bid/no-bid actions
4. Quote generation (existing, refactor UI)

### Phase 3: Order Workflow
1. OrderList with stage filters
2. OrderDetail with stage progress
3. Verification flow
4. Sourcing form + vendor management

### Phase 4: QC + Shipping
1. QC checklist component
2. Python label generation service
3. Label preview + print
4. Ship marking + tracking

---

## Success Criteria

1. **Boss can see what needs action in < 5 seconds** from opening app
2. **Bid/no-bid decision in < 3 clicks** from Action Required
3. **Full order workflow visible** on single detail page
4. **QC + label generation** in one flow
5. **Zero horizontal scrolling** required for primary workflows
