-- Workflow Tracking Migration
-- Adds RFQ linking fields to government_orders for unified RFQ → Response → PO tracking

-- Add rfq_number column to government_orders
ALTER TABLE simurgh.government_orders
ADD COLUMN IF NOT EXISTS rfq_number VARCHAR(100);

-- Add rfq_document_id foreign key to government_orders
ALTER TABLE simurgh.government_orders
ADD COLUMN IF NOT EXISTS rfq_document_id INTEGER REFERENCES simurgh.rfq_documents(id);

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_government_orders_rfq_number
ON simurgh.government_orders(rfq_number);

CREATE INDEX IF NOT EXISTS idx_government_orders_rfq_document_id
ON simurgh.government_orders(rfq_document_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN simurgh.government_orders.rfq_number IS 'RFQ number referenced in the PO document, used for auto-linking';
COMMENT ON COLUMN simurgh.government_orders.rfq_document_id IS 'Foreign key to rfq_documents table, links PO back to originating RFQ';
