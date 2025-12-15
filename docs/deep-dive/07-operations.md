# Deep Dive: Operations

## Local Setup

Install dependencies:

- `npm install`

Run dev server:

- `npm run dev`

## Environment Variables (High Level)

- Authoritative list: `docs/deep-dive/09-config.md`
- Email ingestion (optional): see `docs/EMAIL_INGESTION.md`

## Database Migrations

Drizzle config: `drizzle.config.ts`

Common commands:

- `npm run db:setup` — initial setup helper
- `npm run db:push` — apply schema changes (dev)
- `npm run db:generate` — generate migrations (when used)

Recent migrations to be aware of:

- `drizzle/migrations/0005_add_government_order_rfq_links.sql`
- `drizzle/migrations/0006_add_government_orders_rfq_fk_not_valid.sql`

## Backfills

- `scripts/backfill-po-rfq-links.ts`
  - Links existing `government_orders` to `rfq_documents`
  - Uses a safer matching strategy (time window + NSN extraction + scoring)

Run in dry-run mode first:

- `npx tsx scripts/backfill-po-rfq-links.ts --dry-run`

## Cleanup / Consolidation

If you previously created the deprecated PO-management tables (`simurgh.purchase_orders`, `simurgh.vendors`, etc.) and want to remove them:

- `npm run db:drop-po-management -- --dry-run --force` (preview)
- `npm run db:drop-po-management -- --force` (execute)

## PDF Field Inventory

In development:

- `GET /api/rfq/:id/pdf-fields`

In production:

- set `ENABLE_PDF_FIELDS_DEBUG=true` temporarily if you need it

## Safety Notes

- Avoid using `POST /api/setup` for production environments; prefer `drizzle/migrations/*.sql` to keep everything in the intended `simurgh` schema.
