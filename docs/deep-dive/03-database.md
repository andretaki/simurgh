# Deep Dive: Database

## Schema Location

Simurgh stores its main tables in the Postgres schema named `simurgh`.

The application’s runtime Drizzle binding imports:

- `drizzle/migrations/schema.ts`

This is what `lib/db.ts` binds to.

There are additional schema definitions in the repo:

- `db/schema.ts` — legacy definitions in the default `public` schema (not used by the current app)

New development should generally prefer `drizzle/migrations/schema.ts` unless/until the repo consolidates its PO models.

## Core Tables (simurgh schema)

### `rfq_documents`
Stores inbound RFQ PDFs and extracted data.

- `file_name`, `s3_key`, `s3_url`
- `extracted_text` (truncated)
- `extracted_fields` (JSON)
- `rfq_number` (normalized), `due_date`, `contracting_office`
- `status`: `uploaded | processing | processed | failed`

### `rfq_responses`
Stores boss-entered responseData and generated PDF location.

- `rfq_document_id` → `rfq_documents.id`
- `response_data` (JSON)
- `generated_pdf_s3_key`, `generated_pdf_url`
- `status`: `draft | completed | submitted`

### `government_orders`
Stores awarded government POs (for verification/fulfillment).

- `po_number`, product/NSN fields, shipping fields, `extracted_data` (JSON)
- Legacy link columns:
  - `rfq_number` (string)
  - `rfq_document_id` (nullable FK)

### `government_order_rfq_links` (many-to-many)
Junction table to support multiple RFQs per PO and multiple POs per RFQ.

- `government_order_id` → `government_orders.id`
- `rfq_document_id` → `rfq_documents.id`
- Unique on `(government_order_id, rfq_document_id)`

### Fulfillment tables

- `quality_sheets` — quality sheet per government order
- `generated_labels` — box/bottle labels per order

### `projects`
Lightweight grouping entity tying together RFQ/Response/PO.

## Migrations

Migrations live in `drizzle/migrations/*.sql`.

Recent additions:

- `drizzle/migrations/0005_add_government_order_rfq_links.sql`
  - Adds `government_order_rfq_links`
- `drizzle/migrations/0006_add_government_orders_rfq_fk_not_valid.sql`
  - Adds a **NOT VALID** FK for legacy `government_orders.rfq_document_id` (safer with existing data)

## Purchase Orders: Canonical Table

For the current product scope (“ASRC RFQ → Quote → ASRC PO → Fulfill”), the canonical awarded-PO table is:

- `simurgh.government_orders`

If older environments still have a separate `simurgh.purchase_orders` PO-management system, it is considered deprecated for this app. You can remove those tables with:

- `npm run db:drop-po-management -- --dry-run --force` (preview)
- `npm run db:drop-po-management -- --force` (execute)

## Caution: `/api/setup` vs `simurgh.*`

`POST /api/setup` creates tables without the `simurgh.` prefix (default schema). It’s useful for quick local bootstrapping, but it is not the authoritative migration path for the `simurgh` schema. Prefer Drizzle migrations for a consistent database shape.
