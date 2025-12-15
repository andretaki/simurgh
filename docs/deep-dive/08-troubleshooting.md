# Deep Dive: Troubleshooting

## “RFQ number is wrong / N/A”

RFQ numbers are normalized via `lib/rfq-number.ts`. If extraction returns garbage, it will be dropped instead of stored.

To debug:

- Inspect `rfq_documents.extracted_fields`
- Check logs in `/api/rfq/process` or email ingestion routes

## “Radio button didn’t select in the generated PDF”

Most often the option string doesn’t match the PDF’s actual radio options.

Steps:

1. Call `GET /api/rfq/:id/pdf-fields`
2. Find the radio group and its `options`
3. Update mapping logic in `lib/pdf/asrc-acroform.ts`

## “Generated PDF is blank / text in wrong place”

This typically means you’re in overlay mode on a template that differs from the coordinate mapping.

Steps:

1. Check server log: `PDF fill mode: overlay`
2. Use `/api/rfq/:id/pdf-fields` to see if the PDF is actually fillable
3. If non-fillable, update coordinate mapping in `app/api/rfq/:id/generate`

## “PO uploaded but not linked to RFQ”

Linking is based on normalized RFQ number extracted from the PO.

To debug:

- Confirm PO extraction returned an RFQ number
- Confirm `rfq_documents.rfq_number` matches normalized format
- Inspect `government_order_rfq_links` for link rows

## “Workflow looks wrong / missing PO”

The workflow view is computed in `lib/workflow-service.ts`.

Common causes:

- Missing junction links (`government_order_rfq_links`)
- Legacy-only links present (older records)
- RFQ extraction didn’t produce a normalized RFQ number

