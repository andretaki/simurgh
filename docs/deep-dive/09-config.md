# Deep Dive: Configuration (Env Vars)

This document lists the env vars Simurgh reads in code (via `process.env.*`). It’s intended to be an accurate “contract” for deployment and local setup.

## Required (Database)

- `DATABASE_URL` — Postgres connection string.

## Required (S3 Storage)

Most workflows assume RFQs and generated PDFs live in S3.

- `AWS_S3_BUCKET` — S3 bucket name used by server-side upload/download.
- `AWS_REGION` — AWS region for S3.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
  - Required by `lib/aws/s3.ts` as currently written (it passes these explicitly to the AWS SDK).
  - If you want to rely on IAM roles / default provider chain instead, this helper will need to be adjusted.

## Required (At Least One Extraction Path)

Simurgh has multiple extraction paths; you may not need all keys depending on which endpoints you use.

- `GEMINI_API_KEY` — required for `POST /api/rfq/process` and `POST /api/rfq/:id/reprocess`.
- `OPENAI_API_KEY` — required for email ingestion routes (Graph-based) and utility endpoints like `POST /api/rfq/analyze-fields` and `POST /api/summarizer`.
- `ANTHROPIC_API_KEY` — required for `POST /api/orders/upload` (PO extraction via Claude).

## Optional (PDF Field Debugging)

- `ENABLE_PDF_FIELDS_DEBUG` — when set to `true`, enables `GET /api/rfq/:id/pdf-fields` in production.

## Optional (Email Ingestion / Microsoft Graph)

Used by the Graph ingestion system (see `docs/EMAIL_INGESTION.md`):

- `TENANT_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `BOSS_EMAIL` — mailbox to monitor (defaults in code if unset).
- `GRAPH_SCOPE` — defaults to `https://graph.microsoft.com/.default`.
- `RFQ_SENDER_EMAIL` — sender filter (defaults to `noreply@asrcfederal.com` in code).

Security gating:

- `EMAIL_POLL_API_KEY` — if set, `GET /api/email/poll` requires header `x-api-key: <value>`.

## Optional (Notifications)

- `RESEND_API_KEY` — enables outbound email notifications via Resend.
- `NOTIFICATION_EMAIL` — recipient for notifications (defaults in code if unset).

## Optional (Manufacturer Defaults)

Used for defaults in generated artifacts:

- `MANUFACTURER_NAME`
- `MANUFACTURER_ADDRESS`
- `MANUFACTURER_PHONE`
- `MANUFACTURER_WEBSITE`
- `MANUFACTURER_CAGE_CODE`

## Client-Side (NEXT_PUBLIC_*)

Used in the RFQ fill UI when constructing “completed PDF” URLs:

- `NEXT_PUBLIC_AWS_S3_BUCKET`
- `NEXT_PUBLIC_AWS_REGION`

## Logging

- `LOG_LEVEL` — used by `lib/logger.ts` (defaults to `info`).
