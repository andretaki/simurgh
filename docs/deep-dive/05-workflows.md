# Deep Dive: Workflows

## RFQ → Draft → Generated PDF

### 1) Ingest RFQ

Two entry points:

- Email ingestion (Graph): see `docs/EMAIL_INGESTION.md`
- Manual upload + process:
  - Upload to S3 via `/api/s3/upload`
  - Trigger extraction via `/api/rfq/process`

The result is an `rfq_documents` row with normalized `rfq_number` and `extracted_fields`.

### 2) Boss fills response

UI: `app/rfq/[id]/fill/page.tsx`

- Loads RFQ document and company profile
- Loads existing response draft if present (`GET /api/rfq/:id/response`)
- Boss enters:
  - per-item pricing (`unitCost`, `deliveryDays`)
  - per-item no-bid reason (optional)
  - global no-bid reason (optional)
  - certifications/boilerplate (from profile)
  - optional price breaks

### 3) Save draft

UI action: “Save Draft”

- Calls `POST /api/rfq/:id/response`
- Stores the current `responseData` in `rfq_responses.response_data` with `status="draft"`

### 4) Generate PDF

UI action: “Generate Filled PDF”

- Calls `POST /api/rfq/:id/generate`
- Server:
  - Downloads original RFQ PDF from S3
  - Fills fields (AcroForm by name, else overlays by coordinates)
  - Uploads generated PDF to S3 and stores `generated_pdf_*` on `rfq_responses`

### 5) Submit / Upload Completed (fallback)

If a buyer requires manual edits/signature, the UI can still upload a “completed” PDF:

- `/api/rfq/:id/upload-completed`

## PO → Fulfillment

### 1) Upload PO

- UI uploads PO PDF to `/api/orders/upload`
- Server extracts fields (Anthropic) and attempts to link RFQ by RFQ number
- Writes within a transaction
- Stores:
  - `government_orders`
  - `government_order_rfq_links` junction record (if linked)

### 2) Fulfillment artifacts

For a government order:

- Create/update quality sheet (`/api/orders/:id/quality-sheet`)
- Create labels (`/api/orders/:id/labels`)

## Workflow Dashboard

UI: `app/workflow/page.tsx`

Backed by `lib/workflow-service.ts`:

- Combines RFQ + Response + PO + Fulfillment docs into a `WorkflowRecord`
- Computes `WorkflowStatus` including:
  - `no_bid`, `expired`, `lost` (in addition to PO/fulfillment statuses)

