-- Purchase Order Management System Migration
-- This migration adds comprehensive PO tracking capabilities

-- ==================== VENDORS TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.vendors (
  id SERIAL PRIMARY KEY,
  
  -- Basic Information
  vendor_name VARCHAR(255) NOT NULL,
  vendor_code VARCHAR(100) UNIQUE,
  vendor_type VARCHAR(50), -- supplier, contractor, service_provider
  
  -- Contact Information
  primary_contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  alternate_email VARCHAR(255),
  alternate_phone VARCHAR(50),
  
  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100),
  
  -- Business Details
  tax_id VARCHAR(50),
  duns_number VARCHAR(50),
  cage_code VARCHAR(50),
  
  -- Terms & Conditions
  payment_terms VARCHAR(100),
  shipping_terms VARCHAR(100),
  preferred_currency VARCHAR(10) DEFAULT 'USD',
  
  -- Performance Metrics
  rating DECIMAL(3,2),
  total_orders_count INTEGER DEFAULT 0,
  on_time_delivery_rate DECIMAL(5,2),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== PURCHASE ORDERS TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.purchase_orders (
  id SERIAL PRIMARY KEY,
  
  -- PO Identification
  po_number VARCHAR(100) NOT NULL UNIQUE,
  po_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  po_type VARCHAR(50),
  
  -- Relationships
  vendor_id INTEGER REFERENCES simurgh.vendors(id),
  rfq_document_id INTEGER REFERENCES simurgh.rfq_documents(id),
  company_profile_id INTEGER REFERENCES simurgh.company_profiles(id),
  
  -- Source Information
  email_id VARCHAR(500),
  email_sender VARCHAR(255),
  email_subject TEXT,
  email_received_at TIMESTAMP,
  
  -- Vendor Information
  vendor_name VARCHAR(255),
  vendor_contact VARCHAR(255),
  vendor_email VARCHAR(255),
  vendor_phone VARCHAR(50),
  
  -- Delivery Information
  delivery_address TEXT,
  delivery_date TIMESTAMP,
  ship_via VARCHAR(100),
  shipping_terms VARCHAR(100),
  
  -- Financial Information
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  shipping_amount DECIMAL(15,2),
  discount_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment Information
  payment_terms VARCHAR(100),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  
  -- Document Storage
  s3_key VARCHAR(500),
  s3_url TEXT,
  attachments JSONB,
  
  -- Extracted Data
  extracted_text TEXT,
  extracted_fields JSONB,
  custom_fields JSONB,
  
  -- Status & Workflow
  status VARCHAR(50) DEFAULT 'draft',
  approval_status VARCHAR(50),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  
  -- Fulfillment Tracking
  fulfillment_status VARCHAR(50) DEFAULT 'pending',
  received_quantity INTEGER,
  expected_quantity INTEGER,
  
  -- Notes
  internal_notes TEXT,
  vendor_notes TEXT,
  
  -- Audit Fields
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== PO LINE ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.po_line_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES simurgh.purchase_orders(id) ON DELETE CASCADE,
  
  -- Item Information
  line_number INTEGER NOT NULL,
  item_code VARCHAR(100),
  item_description TEXT NOT NULL,
  category VARCHAR(100),
  
  -- Specifications
  specifications JSONB,
  part_number VARCHAR(100),
  manufacturer_part_number VARCHAR(100),
  
  -- Quantity & Pricing
  quantity DECIMAL(15,3) NOT NULL,
  unit_of_measure VARCHAR(50),
  unit_price DECIMAL(15,4) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  
  -- Discounts & Tax
  discount_percent DECIMAL(5,2),
  discount_amount DECIMAL(15,2),
  tax_rate DECIMAL(5,2),
  tax_amount DECIMAL(15,2),
  
  -- Delivery
  requested_delivery_date TIMESTAMP,
  promised_delivery_date TIMESTAMP,
  actual_delivery_date TIMESTAMP,
  
  -- Fulfillment
  received_quantity DECIMAL(15,3) DEFAULT 0,
  accepted_quantity DECIMAL(15,3) DEFAULT 0,
  rejected_quantity DECIMAL(15,3) DEFAULT 0,
  fulfillment_status VARCHAR(50) DEFAULT 'pending',
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== PO HISTORY TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.po_history (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES simurgh.purchase_orders(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  
  changes JSONB,
  details JSONB,
  
  performed_by VARCHAR(255),
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  notes TEXT
);

-- ==================== RFQ TO PO MAPPING TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.rfq_to_po_mapping (
  id SERIAL PRIMARY KEY,
  
  rfq_document_id INTEGER NOT NULL REFERENCES simurgh.rfq_documents(id),
  purchase_order_id INTEGER NOT NULL REFERENCES simurgh.purchase_orders(id),
  
  conversion_type VARCHAR(50),
  awarded_amount DECIMAL(15,2),
  awarded_date TIMESTAMP,
  
  total_bidders INTEGER,
  winning_reason TEXT,
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INVOICES TABLE ====================
CREATE TABLE IF NOT EXISTS simurgh.invoices (
  id SERIAL PRIMARY KEY,
  
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  purchase_order_id INTEGER REFERENCES simurgh.purchase_orders(id),
  vendor_id INTEGER REFERENCES simurgh.vendors(id),
  
  invoice_date TIMESTAMP,
  due_date TIMESTAMP,
  
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  
  status VARCHAR(50) DEFAULT 'pending',
  
  s3_key VARCHAR(500),
  extracted_fields JSONB,
  
  email_id VARCHAR(500),
  email_received_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================
CREATE INDEX idx_purchase_orders_po_number ON simurgh.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_vendor_id ON simurgh.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON simurgh.purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_date ON simurgh.purchase_orders(po_date);
CREATE INDEX idx_purchase_orders_email_id ON simurgh.purchase_orders(email_id);

CREATE INDEX idx_po_line_items_purchase_order_id ON simurgh.po_line_items(purchase_order_id);
CREATE INDEX idx_po_history_purchase_order_id ON simurgh.po_history(purchase_order_id);
CREATE INDEX idx_po_history_performed_at ON simurgh.po_history(performed_at);

CREATE INDEX idx_vendors_vendor_code ON simurgh.vendors(vendor_code);
CREATE INDEX idx_vendors_status ON simurgh.vendors(status);

CREATE INDEX idx_invoices_invoice_number ON simurgh.invoices(invoice_number);
CREATE INDEX idx_invoices_purchase_order_id ON simurgh.invoices(purchase_order_id);
CREATE INDEX idx_invoices_status ON simurgh.invoices(status);

-- ==================== TRIGGERS ====================
-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON simurgh.vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON simurgh.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_po_line_items_updated_at BEFORE UPDATE ON simurgh.po_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON simurgh.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();