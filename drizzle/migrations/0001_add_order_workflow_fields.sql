-- Add workflow stage fields to government_orders
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS stage VARCHAR(20) DEFAULT 'received';
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS vendor_id INTEGER;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS other_cost NUMERIC(10,2);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS sourcing_notes TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_passed BOOLEAN;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_checklist JSONB;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_notes TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS qc_completed_at TIMESTAMP;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE simurgh.government_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;

-- Create index on stage
CREATE INDEX IF NOT EXISTS idx_government_orders_stage ON simurgh.government_orders(stage);

-- Migrate existing status to stage
UPDATE simurgh.government_orders SET stage = 'received' WHERE stage IS NULL AND status = 'pending';
UPDATE simurgh.government_orders SET stage = 'qc' WHERE stage IS NULL AND status = 'quality_sheet_created';
UPDATE simurgh.government_orders SET stage = 'ship' WHERE stage IS NULL AND status = 'labels_generated';
UPDATE simurgh.government_orders SET stage = 'ship' WHERE stage IS NULL AND status = 'verified';
UPDATE simurgh.government_orders SET stage = 'closed' WHERE stage IS NULL AND status = 'shipped';

-- Create vendors table
CREATE TABLE IF NOT EXISTS simurgh.vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON simurgh.vendors(name);

-- Add foreign key constraint
ALTER TABLE simurgh.government_orders
ADD CONSTRAINT fk_government_orders_vendor
FOREIGN KEY (vendor_id) REFERENCES simurgh.vendors(id);
