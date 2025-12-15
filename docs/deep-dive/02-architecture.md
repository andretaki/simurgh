# Deep Dive: Architecture

## Runtime Stack

- **Next.js App Router** (`app/`)
  - UI routes (React client components)
  - API routes under `app/api/*`
- **Postgres** (schema: `simurgh`)
- **Drizzle ORM**
  - Runtime schema binding: `drizzle/migrations/schema.ts` (imported by `lib/db.ts`)
  - Legacy/unused: `db/schema.ts` (older definitions in the default `public` schema; not the source of truth)
- **S3** for storing PDFs (RFQs and generated responses)
- **AI Providers**
  - Gemini (RFQ extraction in `/api/rfq/process` and `/api/rfq/:id/reprocess`)
  - Anthropic (PO extraction in `/api/orders/upload`)
  - OpenAI (Graph/email ingestion routes and some legacy/utility extraction endpoints)
- **Microsoft Graph** (optional) for RFQ email ingestion
- **Resend** (optional) for RFQ notification emails

## Codebase Map (High Level)

- `app/` — UI pages and API routes
- `lib/` — business logic + shared services
  - `lib/db.ts` — Drizzle connection + schema binding
  - `lib/workflow-service.ts` — builds workflow records + status
  - `lib/pdf/*` — PDF helpers (AcroForm filling)
  - `lib/rfq-number.ts` — RFQ number normalization
- `drizzle/migrations/` — migrations + primary schema file
- `utils/` — legacy utilities (includes coordinate overlay PDF filler)
- `scripts/` — admin/backfill tasks

## Key UI Pages

- `app/rfq/[id]/fill/page.tsx`
  - Boss pricing / no-bid per item
  - Save draft (stores `rfqResponses.responseData`)
  - Generate filled PDF (calls `/api/rfq/:id/generate`)
- `app/workflow/page.tsx`
  - Pipeline dashboard based on `lib/workflow-service.ts`
- `app/projects/*`
  - Project grouping view (RFQ/Response/PO references)
- `app/orders/*`
  - Government order (PO) verification and downstream docs (labels/quality sheets)

## Key Server Components

- **RFQ processing**
  - `/api/rfq/process` ingests a PDF and extracts structured fields (Gemini)
  - RFQ number is normalized via `lib/rfq-number.ts`
- **Response drafting**
  - `/api/rfq/:id/response` stores draft responseData
  - `/api/rfq/:id/generate` generates a response PDF + stores URL in `rfq_responses`
- **PO upload**
  - `/api/orders/upload` extracts PO fields and links to RFQ when possible
  - Uses a DB transaction for consistency
- **Workflow aggregation**
  - `/api/workflow` and `/api/workflow/:identifier` expose computed workflow records

## Important Footnotes

- `POST /api/setup` creates tables in the default schema via raw SQL and is primarily a development helper; prefer applying `drizzle/migrations/*.sql` instead.
- `government_orders` is the canonical table for awarded customer/government POs and is what the workflow and fulfillment UI uses.
