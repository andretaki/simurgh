-- RFQ ↔ Government Order Linking (many-to-many)
-- Adds a junction table so one RFQ can map to many POs and vice versa.

CREATE TABLE IF NOT EXISTS simurgh.government_order_rfq_links (
  id SERIAL PRIMARY KEY,
  government_order_id INTEGER NOT NULL REFERENCES simurgh.government_orders(id) ON DELETE CASCADE,
  rfq_document_id INTEGER NOT NULL REFERENCES simurgh.rfq_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_government_order_rfq_links_government_order_id_rfq_document_id
    UNIQUE (government_order_id, rfq_document_id)
);

CREATE INDEX IF NOT EXISTS idx_government_order_rfq_links_government_order_id
  ON simurgh.government_order_rfq_links(government_order_id);

CREATE INDEX IF NOT EXISTS idx_government_order_rfq_links_rfq_document_id
  ON simurgh.government_order_rfq_links(rfq_document_id);

