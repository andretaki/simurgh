# Simurgh - Government Order Verification System

## Overview

Simurgh is a web application for **Alliance Chemical** to digitize and streamline the government purchase order verification workflow. It replaces manual paper-based processes with a step-by-step digital workflow.

## Company Information

- **Company**: Alliance Chemical
- **CAGE Code**: 1LT50
- **Address**: 204 S. Edmond St, Taylor, Texas 76574
- **Phone**: 512-365-6838
- **Website**: www.alliancechemical.com

---

## Workflow Steps

### Step 1: Receive Purchase Order
- PO arrives via email (PDF attachment)
- User uploads PO to the system via drag-and-drop
- Claude AI extracts key fields from the PDF:
  - PO Number
  - Product Name
  - NSN (National Stock Number)
  - Quantity & Unit of Measure
  - Unit Price
  - Specification (MIL-STD, etc.)
  - Ship To Address

### Step 2: Review & Revise PO
- User reviews extracted data
- Verifies: Product, Quantity, Unit, NSN, Price
- Makes corrections if needed

### Step 3: Fill SAIC Quality Sheet
- **PO Number** - from extracted data
- **Lot Number** - manually entered (e.g., 50415AL)
- **NSN** - from extracted data
- **Quantity** - from extracted data
- **Product Type** - product description
- **Ship To** - delivery address
- **Assembly Date** - date product was assembled
- **Inspection Date** - date product was inspected
- **MHM Date** - manufactured date
- **CAGE Code** - always 1LT50
- **Container Type** - e.g., "12 X 1 QUART POLY BOTTLES"

### Step 4: Generate Labels

#### Box Label (4x6 inches)
- Product Name & Grade
- Specification (MIL-STD)
- NSN with Code 128 Barcode
- CAGE Code (1LT50)
- PO Number
- Lot Number
- Quantity (e.g., "12 QTS")
- Weight (e.g., "24.0 LBS")
- Assembly/Inspection/MHM Dates
- Container Type
- GHS Hazard Pictograms
- Alliance Chemical Info (address, phone, website)

#### Bottle Label (3x4 inches)
- Same info as box label
- Individual container quantity/weight
- e.g., "ONE QT" / "2.0 LBS"

### Step 5: Verify & Approve
Complete verification checklist:
- [ ] PO Number verified
- [ ] Product name matches
- [ ] NSN is correct
- [ ] Quantity verified
- [ ] Lot number assigned
- [ ] Ship to address verified
- [ ] Box label reviewed
- [ ] Bottle label reviewed
- [ ] Hazard symbols correct

**Digital Signature**: Verifier enters full name to approve

---

## GHS Hazard Pictograms

Available symbols for labels:
- Flammable (flamme)
- Corrosive (acid_red)
- Irritant (exclam)
- Toxic (skull)
- Health Hazard (silhouete)
- Oxidizer (rondflam)
- Environmental (aquatic)

---

## Technical Stack

### Frontend
- Next.js 14 (App Router)
- React
- Tailwind CSS
- shadcn/ui components

### Backend
- Next.js API Routes
- Drizzle ORM
- PostgreSQL (Neon)

### AI & Document Processing
- Anthropic Claude API (PDF extraction)
- jsPDF (label generation)
- jsbarcode (Code 128 barcodes)

### Storage
- AWS S3 (document storage)

### Deployment
- Vercel

---

## Database Schema

### `government_orders`
| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| poNumber | varchar(50) | Purchase order number |
| productName | varchar(255) | Product name |
| nsn | varchar(20) | National Stock Number |
| nsnBarcode | varchar(20) | NSN without dashes |
| quantity | integer | Order quantity |
| unitOfMeasure | varchar(20) | Unit (CN, QT, etc.) |
| unitPrice | numeric | Price per unit |
| spec | varchar(255) | Specification |
| shipToName | varchar(255) | Recipient name |
| shipToAddress | text | Delivery address |
| status | varchar(50) | pending/verified/shipped |
| originalPdfS3Key | varchar(500) | S3 key for uploaded PO |
| extractedData | jsonb | Raw AI extraction |

### `quality_sheets`
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
| assemblyDate | varchar(20) | Assembly date |
| inspectionDate | varchar(20) | Inspection date |
| mhmDate | varchar(20) | MHM date |
| cageCode | varchar(10) | CAGE code (1LT50) |
| verifiedBy | varchar(100) | Verifier name |
| verifiedAt | timestamp | Verification time |

### `generated_labels`
| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| orderId | integer | FK to government_orders |
| labelType | varchar(20) | box/bottle |
| labelSize | varchar(10) | 4x6 or 3x4 |
| pdfS3Key | varchar(500) | S3 key for PDF |
| printCount | integer | Times printed |

---

## API Endpoints

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create order
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]` - Update order
- `DELETE /api/orders/[id]` - Delete order
- `POST /api/orders/upload` - Upload PO PDF (with AI extraction)
- `POST /api/orders/[id]/quality-sheet` - Save quality sheet
- `POST /api/orders/[id]/labels` - Generate labels

---

## File Structure

```
app/
├── page.tsx                 # Dashboard
├── orders/
│   ├── page.tsx            # Orders list + upload
│   └── [id]/
│       └── page.tsx        # Order detail wizard
├── api/
│   ├── orders/
│   │   ├── route.ts        # GET/POST orders
│   │   ├── upload/
│   │   │   └── route.ts    # Upload with AI extraction
│   │   └── [id]/
│   │       ├── route.ts    # GET/PUT/DELETE order
│   │       ├── quality-sheet/
│   │       │   └── route.ts
│   │       └── labels/
│   │           └── route.ts
│   └── ...
├── settings/
│   └── page.tsx            # Company settings
components/
├── navigation/
│   └── sidebar.tsx         # Main navigation
├── ui/                     # shadcn components
lib/
├── label-generator.ts      # PDF label generation
├── config/
│   └── manufacturer.ts     # Alliance Chemical constants
drizzle/
└── migrations/
    └── schema.ts           # Database schema
public/
└── hazard-symbols/         # GHS pictogram PNGs
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=...
ANTHROPIC_API_KEY=...
```

---

## URLs

- **Production**: https://simurgh-delta.vercel.app
- **GitHub**: https://github.com/andretaki/simurgh
