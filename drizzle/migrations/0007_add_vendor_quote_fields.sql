-- Add vendor quote fields to rfq_responses table
-- These fields support the branded vendor quote PDF feature

-- Add new columns for vendor quote tracking
ALTER TABLE simurgh.rfq_responses
ADD COLUMN IF NOT EXISTS vendor_quote_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS quote_valid_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS generated_branded_quote_s3_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS generated_branded_quote_url TEXT,
ADD COLUMN IF NOT EXISTS quote_notes TEXT;

-- Create unique index on vendor_quote_ref (allows nulls, unique when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfq_responses_vendor_quote_ref
ON simurgh.rfq_responses(vendor_quote_ref)
WHERE vendor_quote_ref IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN simurgh.rfq_responses.vendor_quote_ref IS 'Vendor quote reference number, format: ACQ-RFQ-{rfqNumber}-{seq}';
COMMENT ON COLUMN simurgh.rfq_responses.quote_valid_until IS 'Date until which the quoted prices are valid';
COMMENT ON COLUMN simurgh.rfq_responses.generated_branded_quote_s3_key IS 'S3 key for the branded Alliance Chemical quote PDF';
COMMENT ON COLUMN simurgh.rfq_responses.generated_branded_quote_url IS 'Presigned URL for the branded quote PDF';
COMMENT ON COLUMN simurgh.rfq_responses.quote_notes IS 'Optional notes/exceptions to include on the branded quote';
