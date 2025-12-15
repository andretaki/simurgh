# Deep Dive: PDF Filling (ASRC RFQs)

## Two Kinds of RFQ PDFs

### 1) AcroForm (fillable)

The PDF includes named fields like:

- `priceFirmUntil`, `quoteRefNum`
- `unitCost-1`, `deliveryDays-1`
- `madeIn-1` (radio), `madeInOther-1`
- `noBidReason-1` (radio), `noBidOther-1`

These can be filled reliably by **field name**, regardless of visible placement.

Implementation:

- `lib/pdf/asrc-acroform.ts` — best-effort field-by-name filling for known ASRC patterns

### 2) Flat PDFs (non-fillable)

No form fields exist; the only option is drawing text/marks at fixed coordinates.

Implementation:

- `app/api/rfq/[id]/generate/route.ts` — coordinate overlay fallback
- `utils/overlayPDFText.ts` — legacy overlay tool (also prefers AcroForm if present)

## How the Generator Chooses Mode

`POST /api/rfq/:id/generate`:

1. Downloads the original RFQ PDF
2. Tries `fillAsrcAcroFormIfPresent(pdfDoc, responseData)`
3. If AcroForm fields aren’t present, uses coordinate overlay

It logs:

- `PDF fill mode: acroform` or `PDF fill mode: overlay`

## Debugging Field Names and Radio Options

When radio selections don’t “stick”, it’s usually because the PDF’s option values aren’t what you assumed.

Use:

- `GET /api/rfq/:id/pdf-fields`
- Optional: `GET /api/rfq/:id/pdf-fields?includeGeometry=true`

This returns:

- full field inventory
- radio option strings for radio groups
- best-effort widget rectangles (geometry mode)

Production safety:

- In production this route returns 404 unless `ENABLE_PDF_FIELDS_DEBUG=true`.

## Price Breaks and Signature Fields

Not all templates expose these as AcroForm fields.

Current behavior:

- AcroForm mode fills standard fields by name.
- Price-break rows and signature may still use overlay if fields aren’t present.

If your template exposes these as AcroForm fields, use `/pdf-fields` to capture names and wire them into `lib/pdf/asrc-acroform.ts`.

