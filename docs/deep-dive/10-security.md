# Deep Dive: Security (Current State)

This doc describes what is (and is not) currently protected in the codebase, and what should be locked down before production use.

## Current Protections in Code

- `GET /api/email/poll`
  - If `EMAIL_POLL_API_KEY` is set, requires header `x-api-key` to match.
- `POST /api/email/webhook`
  - Validates Graph subscription handshake (`validationToken`).
  - Checks `clientState === "rfq-ingestion-webhook"` on notifications.
- `GET /api/rfq/:id/pdf-fields`
  - Returns 404 in production unless `ENABLE_PDF_FIELDS_DEBUG=true`.

## Endpoints That Should Be Protected (But Usually Aren’t Yet)

- `POST /api/setup` — creates tables via raw SQL (should be removed, disabled, or strongly authenticated in production).
- `POST /api/s3/upload` — can be abused to generate presigned upload URLs if exposed publicly.
- RFQ/PO upload and processing endpoints (`/api/rfq/process`, `/api/rfq/:id/generate`, `/api/orders/upload`) — can burn AI tokens and write data if unauthenticated.
- Email ingestion helpers (`/api/email/ingest`, `/api/email/test`, `/api/email/webhook` subscription `GET`) — should be admin-only.

## Recommended Next Hardening Steps

- Add a single auth layer (middleware) for `app/api/*` and require login/admin for write endpoints.
- Replace hard-coded webhook `clientState` with a secret env var (and reject missing/mismatch).
- Disable or remove `POST /api/setup` in production builds.
- Rate-limit token-expensive endpoints (AI extraction, PDF generation).
- Keep `ENABLE_PDF_FIELDS_DEBUG` off in production except when actively debugging.
