/**
 * Legacy schema file - contains tables in the public schema
 *
 * NOTE: The primary schema for the "simurgh" PostgreSQL schema is in:
 * drizzle/migrations/schema.ts
 *
 * This file contains additional tables that exist in the public schema:
 * - rfqSummaries, rfqExtractedFields, rfqSubmissions (legacy RFQ tables)
 * - vendors, purchaseOrders, poLineItems, poHistory (PO management)
 * - invoices, rfqToPOMapping (billing and mapping)
 *
 * For new development, prefer using drizzle/migrations/schema.ts
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// Company Profiles Table
export const companyProfiles = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  cageCode: varchar("cage_code", { length: 50 }),
  samUei: varchar("sam_uei", { length: 50 }),
  samRegistered: boolean("sam_registered").default(false),
  naicsCode: varchar("naics_code", { length: 50 }),
  naicsSize: varchar("naics_size", { length: 100 }),
  employeeCount: varchar("employee_count", { length: 50 }),
  businessType: varchar("business_type", { length: 50 }),
  smallDisadvantaged: boolean("small_disadvantaged").default(false),
  womanOwned: boolean("woman_owned").default(false),
  veteranOwned: boolean("veteran_owned").default(false),
  serviceDisabledVetOwned: boolean("service_disabled_vet_owned").default(false),
  hubZone: boolean("hub_zone").default(false),
  historicallyUnderutilized: boolean("historically_underutilized").default(false),
  alaskaNativeCorp: boolean("alaska_native_corp").default(false),
  defaultPaymentTerms: varchar("default_payment_terms", { length: 100 }),
  defaultPaymentTermsOther: varchar("default_payment_terms_other", { length: 255 }),
  defaultFob: varchar("default_fob", { length: 50 }),
  defaultPurchaseOrderMin: numeric("default_purchase_order_min", { precision: 10, scale: 2 }),
  noFreightAdder: boolean("no_freight_adder").default(true),
  defaultComplimentaryFreight: boolean("default_complimentary_freight").default(false),
  defaultPpaByVendor: boolean("default_ppa_by_vendor").default(false),
  countryOfOrigin: varchar("country_of_origin", { length: 50 }).default('USA'),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RFQ Summaries Table
export const rfqSummaries = pgTable("rfq_summaries", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  s3Url: text("s3_url").notNull(),
  summary: text("summary").notNull(),
  rfqNumber: varchar("rfq_number", { length: 50 }),
  vendor: varchar("vendor", { length: 255 }),
  requestDate: timestamp("request_date"),
  s3Key: varchar("s3_key", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// RFQ Extracted Fields Table
export const rfqExtractedFields = pgTable("rfq_extracted_fields", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => rfqSummaries.id, { onDelete: "cascade" }),
  hasUnitCost: boolean("has_unit_cost").default(false),
  hasDeliveryTime: boolean("has_delivery_time").default(false),
  hasPaymentTerms: boolean("has_payment_terms").default(false),
  hasFob: boolean("has_fob").default(false),
  hasCageCode: boolean("has_cage_code").default(false),
  hasSamUei: boolean("has_sam_uei").default(false),
  hasNaicsCode: boolean("has_naics_code").default(false),
  hasBusinessType: boolean("has_business_type").default(false),
  hasClassifications: boolean("has_classifications").default(false),
  hasMinimumOrder: boolean("has_minimum_order").default(false),
  hasComplimentaryFreight: boolean("has_complimentary_freight").default(false),
  hasPpaByVendor: boolean("has_ppa_by_vendor").default(false),
  extractedFieldsJson: jsonb("extracted_fields_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RFQ Submissions Table
export const rfqSubmissions = pgTable(
  "rfq_submissions",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    originalPdfUrl: text("original_pdf_url"),
    completedPdfUrl: text("completed_pdf_url"),
    createdAt: timestamp("created_at").defaultNow(),
    formData: jsonb("form_data"),
    rfqId: integer("rfq_id").notNull().references(() => rfqSummaries.id, { onDelete: "cascade" }),
    nsn: varchar("nsn", { length: 50 }),
    bidPrice: numeric("bid_price", { precision: 10, scale: 2 }),
    quantity: integer("quantity"),
    notes: text("notes"),
    s3Key: varchar("s3_key", { length: 255 }),
  },
  (table) => ({
    nsnIdx: index("idx_rfq_submissions_nsn").on(table.nsn),
  })
);

// Relations
export const rfqSummariesRelations = relations(rfqSummaries, ({ many, one }) => ({
  submissions: many(rfqSubmissions),
  extractedFields: one(rfqExtractedFields),
}));

export const rfqSubmissionsRelations = relations(rfqSubmissions, ({ one }) => ({
  rfqSummary: one(rfqSummaries, {
    fields: [rfqSubmissions.rfqId],
    references: [rfqSummaries.id],
  }),
}));

export const rfqExtractedFieldsRelations = relations(rfqExtractedFields, ({ one }) => ({
  rfqSummary: one(rfqSummaries, {
    fields: [rfqExtractedFields.rfqId],
    references: [rfqSummaries.id],
  }),
}));

// ===============================
// PO MANAGEMENT TABLES
// ===============================

// Vendors Table - Track vendors/suppliers
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  
  // Basic Information
  vendorCode: varchar("vendor_code", { length: 50 }).notNull().unique(),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  legalName: varchar("legal_name", { length: 255 }),
  
  // Contact Information
  primaryContactName: varchar("primary_contact_name", { length: 255 }),
  primaryContactEmail: varchar("primary_contact_email", { length: 255 }),
  primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
  
  // Address
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default('USA'),
  
  // Business Information
  taxId: varchar("tax_id", { length: 50 }),
  dunsNumber: varchar("duns_number", { length: 50 }),
  cageCode: varchar("cage_code", { length: 50 }),
  
  // Terms
  defaultPaymentTerms: varchar("default_payment_terms", { length: 100 }),
  defaultShippingTerms: varchar("default_shipping_terms", { length: 100 }),
  currency: varchar("currency", { length: 3 }).default('USD'),
  
  // Status
  status: varchar("status", { length: 50 }).default('active'), // active, inactive, blocked
  rating: integer("rating"), // 1-5 star rating
  notes: text("notes"),
  
  // Performance Metrics
  totalPOCount: integer("total_po_count").default(0),
  totalPOValue: numeric("total_po_value", { precision: 12, scale: 2 }).default('0'),
  onTimeDeliveryRate: numeric("on_time_delivery_rate", { precision: 5, scale: 2 }), // percentage
  qualityRating: numeric("quality_rating", { precision: 3, scale: 2 }), // 1-5 scale
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Orders Table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  
  // PO Identification
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  revision: integer("revision").default(0),
  
  // Vendor Information
  vendorId: integer("vendor_id").references(() => vendors.id),
  vendorName: varchar("vendor_name", { length: 255 }), // Denormalized for quick access
  vendorContact: varchar("vendor_contact", { length: 255 }),
  
  // Source Document
  sourceType: varchar("source_type", { length: 50 }), // email, manual, rfq_conversion
  sourceDocumentId: integer("source_document_id"), // Reference to rfq_documents or other source
  emailId: varchar("email_id", { length: 255 }), // MS Graph email ID if from email
  
  // PO Details
  orderDate: timestamp("order_date").notNull(),
  requestedDeliveryDate: timestamp("requested_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  
  // Financial
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default('0'),
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default('USD'),
  
  // Terms and Conditions
  paymentTerms: varchar("payment_terms", { length: 100 }),
  shippingTerms: varchar("shipping_terms", { length: 100 }),
  fobPoint: varchar("fob_point", { length: 100 }),
  shippingMethod: varchar("shipping_method", { length: 100 }),
  
  // Addresses
  billToAddress: jsonb("bill_to_address"),
  shipToAddress: jsonb("ship_to_address"),
  
  // Status Tracking
  status: varchar("status", { length: 50 }).default('draft'), 
  // draft, pending_approval, approved, sent, acknowledged, partial, fulfilled, cancelled
  approvalStatus: varchar("approval_status", { length: 50 }),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  // Fulfillment
  fulfillmentStatus: varchar("fulfillment_status", { length: 50 }).default('pending'),
  // pending, partial, complete
  percentFulfilled: integer("percent_fulfilled").default(0),
  
  // Documents
  originalPdfS3Key: varchar("original_pdf_s3_key", { length: 500 }),
  originalPdfUrl: text("original_pdf_url"),
  
  // Extracted and Additional Data
  extractedData: jsonb("extracted_data"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PO Line Items Table
export const poLineItems = pgTable("po_line_items", {
  id: serial("id").primaryKey(),
  
  poId: integer("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  
  // Item Details
  partNumber: varchar("part_number", { length: 100 }),
  manufacturerPartNumber: varchar("manufacturer_part_number", { length: 100 }),
  description: text("description").notNull(),
  
  // Categorization
  category: varchar("category", { length: 100 }),
  itemType: varchar("item_type", { length: 50 }), // product, service, freight, tax, discount
  
  // Quantities
  quantity: integer("quantity").notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
  quantityReceived: integer("quantity_received").default(0),
  quantityInvoiced: integer("quantity_invoiced").default(0),
  
  // Pricing
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  
  // Delivery
  requestedDeliveryDate: timestamp("requested_delivery_date"),
  promisedDeliveryDate: timestamp("promised_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  
  // Status
  status: varchar("status", { length: 50 }).default('pending'),
  // pending, ordered, partial, received, cancelled
  
  // Additional Info
  notes: text("notes"),
  specifications: jsonb("specifications"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PO History Table - Track all changes to POs
export const poHistory = pgTable("po_history", {
  id: serial("id").primaryKey(),
  
  poId: integer("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  
  action: varchar("action", { length: 100 }).notNull(),
  // created, updated, approved, rejected, sent, acknowledged, item_received, cancelled
  
  previousData: jsonb("previous_data"),
  newData: jsonb("new_data"),
  changedFields: jsonb("changed_fields"),
  
  notes: text("notes"),
  performedBy: varchar("performed_by", { length: 255 }),
  performedAt: timestamp("performed_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// RFQ to PO Mapping Table
export const rfqToPOMapping = pgTable("rfq_to_po_mapping", {
  id: serial("id").primaryKey(),
  
  rfqDocumentId: integer("rfq_document_id"), // From schema.ts rfq tables
  rfqNumber: varchar("rfq_number", { length: 100 }),
  
  poId: integer("po_id").notNull().references(() => purchaseOrders.id),
  poNumber: varchar("po_number", { length: 50 }),
  
  mappingType: varchar("mapping_type", { length: 50 }).default('converted'),
  // converted, referenced, related
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices Table (for future enhancement)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  poId: integer("po_id").references(() => purchaseOrders.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  
  status: varchar("status", { length: 50 }).default('pending'),
  // pending, approved, paid, partial, overdue, cancelled
  
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default('0'),
  paymentDate: timestamp("payment_date"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentReference: varchar("payment_reference", { length: 100 }),
  
  documentS3Key: varchar("document_s3_key", { length: 500 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PO Relations
export const vendorRelations = relations(vendors, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  invoices: many(invoices),
}));

export const purchaseOrderRelations = relations(purchaseOrders, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  lineItems: many(poLineItems),
  history: many(poHistory),
  rfqMappings: many(rfqToPOMapping),
  invoices: many(invoices),
}));

export const poLineItemRelations = relations(poLineItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [poLineItems.poId],
    references: [purchaseOrders.id],
  }),
}));

export const poHistoryRelations = relations(poHistory, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [poHistory.poId],
    references: [purchaseOrders.id],
  }),
}));

export const rfqToPOMappingRelations = relations(rfqToPOMapping, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [rfqToPOMapping.poId],
    references: [purchaseOrders.id],
  }),
}));

export const invoiceRelations = relations(invoices, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [invoices.poId],
    references: [purchaseOrders.id],
  }),
  vendor: one(vendors, {
    fields: [invoices.vendorId],
    references: [vendors.id],
  }),
}));

// ===============================
// GOVERNMENT VERIFICATION TABLES
// ===============================

// Orders for Government Verification - main workflow table
export const governmentOrders = pgTable("government_orders", {
  id: serial("id").primaryKey(),

  // PO Information (extracted from PDF)
  poNumber: varchar("po_number", { length: 50 }).notNull(),

  // Product Information
  productName: varchar("product_name", { length: 255 }).notNull(),
  productDescription: text("product_description"),
  grade: varchar("grade", { length: 50 }), // TECHNICAL, ACS, etc.

  // NSN Information
  nsn: varchar("nsn", { length: 20 }), // e.g., 6810-00-983-8551
  nsnBarcode: varchar("nsn_barcode", { length: 20 }), // e.g., 6810009838551 (no dashes)

  // Quantity & Units
  quantity: integer("quantity").notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 20 }), // BOX, CN, QT, etc.
  unitContents: varchar("unit_contents", { length: 100 }), // e.g., "12 x 1 QUART POLY BOTTLES"

  // Pricing
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),

  // Specification
  spec: varchar("spec", { length: 255 }), // e.g., "I/A/W SPEC NR O-E-760D(2) NOT 3"
  milStd: varchar("mil_std", { length: 100 }), // e.g., "MIL-STD-290H"

  // Shipping Information
  shipToName: varchar("ship_to_name", { length: 255 }),
  shipToAddress: text("ship_to_address"),
  deliveryDate: timestamp("delivery_date"),

  // Source Document
  originalPdfS3Key: varchar("original_pdf_s3_key", { length: 500 }),
  originalPdfUrl: text("original_pdf_url"),
  extractedData: jsonb("extracted_data"), // Full extracted JSON from PO

  // Workflow Status
  status: varchar("status", { length: 50 }).default('pending'),
  // pending, quality_sheet_created, labels_generated, verified, shipped

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quality Sheets - SAIC Quality Sheet data
export const qualitySheets = pgTable("quality_sheets", {
  id: serial("id").primaryKey(),

  orderId: integer("order_id").notNull().references(() => governmentOrders.id, { onDelete: "cascade" }),

  // Quality Sheet Fields
  poNumber: varchar("po_number", { length: 50 }).notNull(),
  lotNumber: varchar("lot_number", { length: 50 }).notNull(),
  nsn: varchar("nsn", { length: 20 }),
  quantity: integer("quantity").notNull(),
  productType: varchar("product_type", { length: 100 }),
  shipTo: text("ship_to"),

  // Manufacturing Info
  assemblyDate: varchar("assembly_date", { length: 20 }), // e.g., "11/25" or "4Q/24"
  inspectionDate: varchar("inspection_date", { length: 20 }), // e.g., "11/29" or "4Q/24"
  mhmDate: varchar("mhm_date", { length: 20 }), // Manufactured date

  // Additional Fields
  cageCode: varchar("cage_code", { length: 20 }).default('1LT50'),
  notes: text("notes"),

  // Verification
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated Labels - track box and bottle labels
export const generatedLabels = pgTable("generated_labels", {
  id: serial("id").primaryKey(),

  orderId: integer("order_id").notNull().references(() => governmentOrders.id, { onDelete: "cascade" }),
  qualitySheetId: integer("quality_sheet_id").references(() => qualitySheets.id),

  // Label Type
  labelType: varchar("label_type", { length: 20 }).notNull(), // 'box' or 'bottle'
  labelSize: varchar("label_size", { length: 10 }).notNull(), // '4x6' or '3x4'

  // Label Data (all fields needed for the label)
  productName: varchar("product_name", { length: 255 }).notNull(),
  grade: varchar("grade", { length: 50 }),
  spec: varchar("spec", { length: 255 }),
  nsn: varchar("nsn", { length: 20 }),
  nsnBarcode: varchar("nsn_barcode", { length: 20 }),
  cageCode: varchar("cage_code", { length: 20 }),
  poNumber: varchar("po_number", { length: 50 }),
  lotNumber: varchar("lot_number", { length: 50 }),
  quantity: varchar("quantity", { length: 50 }), // e.g., "12 QTS" or "ONE QT"
  weight: varchar("weight", { length: 20 }), // e.g., "24.0 LBS" or "2.0 LBS"
  assemblyDate: varchar("assembly_date", { length: 20 }),
  inspectionDate: varchar("inspection_date", { length: 20 }),
  mhmDate: varchar("mhm_date", { length: 20 }),

  // Container Info
  containerType: varchar("container_type", { length: 100 }), // e.g., "12 X 1 QUART POLY BOTTLES"

  // Manufacturer Info (Alliance Chemical defaults)
  manufacturer: varchar("manufacturer", { length: 255 }).default('ALLIANCE CHEMICAL'),
  manufacturerAddress: varchar("manufacturer_address", { length: 255 }).default('204 S. EDMOND ST. TAYLOR, TEXAS 76574'),
  manufacturerPhone: varchar("manufacturer_phone", { length: 50 }).default('512-365-6838'),
  manufacturerWebsite: varchar("manufacturer_website", { length: 255 }).default('www.alliancechemical.com'),

  // Hazard Info
  hazardClass: varchar("hazard_class", { length: 50 }), // e.g., "3" for flammable
  unNumber: varchar("un_number", { length: 20 }), // e.g., "UN1987"

  // Generated PDF
  pdfS3Key: varchar("pdf_s3_key", { length: 500 }),
  pdfUrl: text("pdf_url"),

  // Print tracking
  printCount: integer("print_count").default(0),
  lastPrintedAt: timestamp("last_printed_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Government Order Relations
export const governmentOrderRelations = relations(governmentOrders, ({ many }) => ({
  qualitySheets: many(qualitySheets),
  labels: many(generatedLabels),
}));

export const qualitySheetRelations = relations(qualitySheets, ({ one, many }) => ({
  order: one(governmentOrders, {
    fields: [qualitySheets.orderId],
    references: [governmentOrders.id],
  }),
  labels: many(generatedLabels),
}));

export const generatedLabelRelations = relations(generatedLabels, ({ one }) => ({
  order: one(governmentOrders, {
    fields: [generatedLabels.orderId],
    references: [governmentOrders.id],
  }),
  qualitySheet: one(qualitySheets, {
    fields: [generatedLabels.qualitySheetId],
    references: [qualitySheets.id],
  }),
}));