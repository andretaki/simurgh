# Deep Dive: Overview

## What Simurgh Does

Simurgh is a workflow app for handling government-style RFQs and POs end-to-end:

1. **Ingest RFQs** (upload or email ingestion)
2. **Extract structured data** (RFQ number, due date, line items, terms)
3. **Boss fills pricing / no-bid decisions** in-app
4. **Generate a filled response PDF** (AcroForm fill when possible; coordinate overlay fallback)
5. **Track follow-on PO and fulfillment artifacts** (quality sheet, labels, verification)
6. **Provide a single “workflow record” view** of RFQ → Response → PO → Fulfillment

## Core Entities (Human View)

- **RFQ Document**: the inbound request (PDF) + extracted text/fields.
- **RFQ Response**: draft data (pricing, certifications, no-bid) + generated response PDF URL.
- **Government Order (PO)**: the awarded purchase order (PDF) + extracted fields.
- **Workflow Record**: a computed view that ties the chain together and assigns a status.

## Key Concepts

### Two PDF Filling Modes

RFQ response PDFs can arrive in two shapes:

- **AcroForm PDFs (fillable)**: have named form fields like `unitCost-1`, `deliveryDays-1`.
- **Flat PDFs (non-fillable)**: require drawing text at fixed coordinates.

Simurgh supports both:

- Prefer **AcroForm fill by field name**
- Fall back to **coordinate overlay**

Details: `docs/deep-dive/06-pdf-filling.md`.

### Many-to-Many RFQ ↔ PO

Government procurement can map:

- One RFQ → multiple POs (partial awards)
- Multiple RFQs → one PO (consolidated awards)

Simurgh supports this via `government_order_rfq_links` while keeping legacy columns for compatibility. Details: `docs/deep-dive/03-database.md`.

