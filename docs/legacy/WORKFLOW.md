# Legacy Document (Migrated)

This document was migrated from the repo root (`WORKFLOW.md`) into `docs/legacy/`.

- It may be **out of date** relative to the current RFQ → response → PO workflow implementation.
- For current behavior and architecture, use the deep-dive docs starting at `docs/README.md`.

---

# Simurgh - Government Order Verification System

## Overview

Simurgh is a web application for **Alliance Chemical** to digitize and streamline government purchase order workflows. It replaces manual paper-based processes with AI-powered document extraction, RFQ/PO correlation, quality sheets, and label generation.

**All work flows through Projects.** Every deal starts with an RFQ, proceeds to a quote, then PO receipt, and finally order verification/shipment.

---

## Company Information

| Field | Value |
|-------|-------|
| Company | Alliance Chemical |
| CAGE Code | 1LT50 |
| Address | 204 S. Edmond St, Taylor, Texas 76574 |
| Phone | 512-365-6838 |
| Website | www.alliancechemical.com |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SIMURGH                                  │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)                                          │
│  ├── Dashboard (/)                                              │
│  ├── Projects (/projects) ─── Full RFQ → Ship workflow          │
│  └── Settings (/settings)                                       │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Next.js API Routes)                                   │
│  ├── /api/projects/* ──────── Project CRUD + AI comparison      │
│  ├── /api/orders/* ────────── Order data (within projects)      │
│  ├── /api/rfq/* ───────────── RFQ processing                    │
│  └── /api/health ──────────── System status                     │
├─────────────────────────────────────────────────────────────────┤
│  Services                                                       │
│  ├── Claude AI ────────────── PDF extraction & comparison       │
│  ├── PostgreSQL (Neon) ────── Database                          │
│  ├── AWS S3 ───────────────── Document storage                  │
│  └── jsPDF + jsBarcode ────── Label generation                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow

Everything goes through **Projects**. One project = one deal from RFQ to shipment.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Upload  │───▶│   Send   │───▶│  Upload  │───▶│    AI    │───▶│  Verify  │───▶│   Ship   │
│   RFQ    │    │  Quote   │    │    PO    │    │ Compare  │    │  Order   │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Phase 1: RFQ Received
- Create new project
- Upload RFQ PDF
- AI extracts: RFQ#, NSN, product, quantity, customer, due date

### Phase 2: Quote Sent
- Review extracted RFQ data
- Generate and send quote response
- Mark project as "quoted"

### Phase 3: PO Received
- Upload PO PDF when customer responds
- AI extracts: PO#, NSN, product, quantity, price, ship-to address
- **AI Comparison** runs automatically:
  - ✅ **Matches** - Fields that align between RFQ and PO
  - ❌ **Mismatches** - Discrepancies (severity: high/medium/low)
  - ⚠️ **Missing** - Fields in one doc but not the other
  - 📋 **Recommendations** - Action items

### Phase 4: Order Verification
- **Quality Sheet (SAIC)**
  - PO Number (auto-filled)
  - Lot Number (manual entry, e.g., "50415AL")
  - NSN (auto-filled)
  - Quantity (auto-filled)
  - Product Type
  - Ship To Address
  - Assembly Date (MM/DD)
  - Inspection Date (MM/DD)
  - MHM Date (MM/DD)
  - CAGE Code (always 1LT50)
  - Container Type (e.g., "12 X 1 QUART POLY BOTTLES")

- **Generate Labels**

| Label Type | Size | Contents |
|------------|------|----------|
| Box Label | 4x6 inches | Product, Grade, Spec, NSN (barcode), CAGE, PO#, Lot#, Qty, Weight, Dates, Container Type, Hazard Symbols, Manufacturer Info |
| Bottle Label | 3x4 inches | Same as box, individual container qty/weight |

- **Verification Checklist**
  - [ ] PO Number verified
  - [ ] Product name matches
  - [ ] NSN is correct
  - [ ] Quantity verified
  - [ ] Lot number assigned
  - [ ] Ship to address verified
  - [ ] Box label reviewed
  - [ ] Bottle label reviewed
  - [ ] Hazard symbols correct

- **Digital Signature** - Verifier enters full name

### Phase 5: Shipped
- Mark as shipped
- Project complete

---

## GHS Hazard Pictograms

| Symbol | Name | File |
|--------|------|------|
| Flammable | flamme.png |
| Corrosive | acid_red.png |
| Irritant | exclam.png |
| Toxic | skull.png |
| Health Hazard | silhouete.png |
| Oxidizer | rondflam.png |
| Environmental | Aquatic-pollut-red.png |

---

## Database Schema

### `projects`
Main table - one row per deal.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| name | varchar(255) | Project name |
| customerName | varchar(255) | Customer/contracting office |
| rfqDocumentId | integer | FK to rfq_documents |
| rfqResponseId | integer | FK to rfq_responses |
| governmentOrderId | integer | FK to government_orders |
| rfqNumber | varchar(100) | RFQ number |
| poNumber | varchar(100) | PO number |
| nsn | varchar(20) | NSN |
| productName | varchar(255) | Product name |
| quantity | integer | Quantity |
| comparisonResults | jsonb | AI comparison results |
| comparisonStatus | varchar(50) | matched/mismatched/partial |
| status | varchar(50) | Workflow status |
| rfqReceivedAt | timestamp | RFQ received date |
| quoteSentAt | timestamp | Quote sent date |
| poReceivedAt | timestamp | PO received date |
| verifiedAt | timestamp | Verification date |
| shippedAt | timestamp | Ship date |

**Status flow:** `rfq_received` → `quoted` → `po_received` → `in_verification` → `verified` → `shipped`

### `government_orders`
PO data extracted from uploaded documents.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| poNumber | varchar(50) | Purchase order number |
| productName | varchar(255) | Product name |
| productDescription | text | Full description |
| grade | varchar(50) | TECHNICAL, ACS, etc. |
| nsn | varchar(20) | e.g., 6810-00-983-8551 |
| nsnBarcode | varchar(20) | e.g., 6810009838551 |
| quantity | integer | Order quantity |
| unitOfMeasure | varchar(20) | BOX, CN, QT, etc. |
| unitContents | varchar(100) | e.g., "12 x 1 QUART POLY BOTTLES" |
| unitPrice | numeric(10,2) | Price per unit |
| totalPrice | numeric(12,2) | Total price |
| spec | varchar(255) | e.g., "O-E-760D(2)" |
| milStd | varchar(100) | e.g., "MIL-STD-290H" |
| shipToName | varchar(255) | Recipient name |
| shipToAddress | text | Delivery address |
| deliveryDate | timestamp | Required delivery date |
| originalPdfS3Key | varchar(500) | S3 key for uploaded PO |
| extractedData | jsonb | Raw AI extraction |
| status | varchar(50) | Workflow status |

### `quality_sheets`
SAIC Quality Sheet data.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| orderId | integer | FK to government_orders |
| poNumber | varchar(50) | PO number |
| lotNumber | varchar(50) | Lot number |
| nsn | varchar(20) | NSN |
| quantity | integer | Quantity |
| productType | varchar(100) | Product type |
| shipTo | text | Ship to address |
| assemblyDate | varchar(20) | e.g., "11/25" |
| inspectionDate | varchar(20) | e.g., "11/29" |
| mhmDate | varchar(20) | Manufactured date |
| cageCode | varchar(20) | Default: 1LT50 |
| notes | text | Additional notes |
| verifiedBy | varchar(255) | Verifier name |
| verifiedAt | timestamp | Verification timestamp |

### `generated_labels`
Track generated box and bottle labels.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| orderId | integer | FK to government_orders |
| qualitySheetId | integer | FK to quality_sheets |
| labelType | varchar(20) | box / bottle |
| labelSize | varchar(10) | 4x6 / 3x4 |
| productName | varchar(255) | Product name |
| pdfS3Key | varchar(500) | S3 key for PDF |
| printCount | integer | Times printed |

### `rfq_documents`
Uploaded RFQ documents.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| fileName | varchar(255) | Original filename |
| s3Key | varchar(500) | S3 storage key |
| extractedText | text | Full extracted text |
| extractedFields | jsonb | Structured extracted data |
| rfqNumber | varchar(100) | RFQ number |
| dueDate | timestamp | Response due date |
| contractingOffice | varchar(255) | Contracting office |
| status | varchar(50) | uploaded/processing/processed/failed |

### `rfq_responses`
Quote responses to RFQs.

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| rfqDocumentId | integer | FK to rfq_documents |
| companyProfileId | integer | FK to company_profiles |
| responseData | jsonb | Response form data |
| generatedPdfS3Key | varchar(500) | S3 key for generated PDF |
| submittedAt | timestamp | Submission timestamp |
| status | varchar(50) | draft/completed/submitted |

---

## API Endpoints

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create new project |
| GET | /api/projects/[id] | Get project with related docs |
| PUT | /api/projects/[id] | Update project |
| DELETE | /api/projects/[id] | Delete project |
| POST | /api/projects/[id]/compare | Run AI RFQ vs PO comparison |

### Orders (within Projects)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orders/[id] | Get order details |
| PUT | /api/orders/[id] | Update order |
| POST | /api/orders/[id]/quality-sheet | Save quality sheet |
| POST | /api/orders/[id]/labels | Generate labels |

### RFQ
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/rfq/extract | Upload & extract RFQ |

---

## File Structure

```
simurgh/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── projects/
│   │   ├── page.tsx                # Projects list
│   │   └── [id]/page.tsx           # Project detail + verification
│   ├── settings/page.tsx           # Company settings
│   └── api/
│       ├── projects/
│       │   ├── route.ts            # GET/POST projects
│       │   └── [id]/
│       │       ├── route.ts        # GET/PUT/DELETE project
│       │       └── compare/route.ts # AI comparison
│       ├── orders/
│       │   └── [id]/
│       │       ├── route.ts        # GET/PUT order
│       │       ├── quality-sheet/route.ts
│       │       └── labels/route.ts
│       ├── rfq/
│       │   └── extract/route.ts    # RFQ extraction
│       └── health/route.ts         # System health
├── components/
│   ├── navigation/sidebar.tsx      # Main navigation
│   └── ui/                         # shadcn components
├── lib/
│   ├── db.ts                       # Database connection
│   ├── label-generator.ts          # PDF label generation
│   └── config/manufacturer.ts      # Alliance Chemical constants
├── drizzle/migrations/
│   └── schema.ts                   # Database schema
├── public/hazard-symbols/          # GHS pictogram PNGs
└── docs/legacy/WORKFLOW.md         # This file (migrated)
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Neon), Drizzle ORM |
| AI | Anthropic Claude API |
| Storage | AWS S3 |
| PDF Generation | jsPDF, jsBarcode |
| Deployment | Vercel |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=...

# AI
ANTHROPIC_API_KEY=...
```

---

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://simurgh-delta.vercel.app |
| GitHub | https://github.com/andretaki/simurgh |

---

## Quick Start

1. Go to `/projects`
2. Click **New Project**
3. Upload RFQ → Send Quote → Upload PO → AI Compare → Verify → Ship

---

## Project Status Legend

| Status | Description |
|--------|-------------|
| rfq_received | RFQ uploaded, awaiting quote |
| quoted | Quote sent to customer |
| po_received | PO received, AI comparison done |
| in_verification | Quality sheet/labels in progress |
| verified | All steps complete, ready to ship |
| shipped | Order shipped |

### Comparison Status

| Status | Description |
|--------|-------------|
| matched | RFQ and PO fields align |
| mismatched | Discrepancies found |
| partial | Some matches, some issues |

