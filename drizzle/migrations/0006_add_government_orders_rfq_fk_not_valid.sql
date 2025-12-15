-- Make legacy government_orders.rfq_document_id safer without blocking on existing data.
-- This enforces FK on new writes while allowing a later VALIDATE after backfill/cleanup.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'simurgh'
      AND table_name = 'government_orders'
      AND column_name = 'rfq_document_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_government_orders_rfq_document_id'
  ) THEN
    ALTER TABLE simurgh.government_orders
      ADD CONSTRAINT fk_government_orders_rfq_document_id
      FOREIGN KEY (rfq_document_id)
      REFERENCES simurgh.rfq_documents(id)
      NOT VALID;
  END IF;
END $$;

