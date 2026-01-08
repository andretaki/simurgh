import { serial, varchar, text, boolean, timestamp, jsonb, integer, numeric, pgSchema, index, uniqueIndex } from "drizzle-orm/pg-core";

// Create a schema object
export const simurghSchema = pgSchema("simurgh");

// Use the schema for all tables
export const companyProfiles = simurghSchema.table("company_profiles", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  cageCode: varchar("cage_code", { length: 50 }),
  samUei: varchar("sam_uei", { length: 50 }),
  samRegistered: boolean("sam_registered").default(false),
  naicsCode: varchar("naics_code", { length: 50 }),
  naicsSize: varchar("naics_size", { length: 100 }),
  employeeCount: varchar("employee_count", { length: 50 }),
  businessType: varchar("business_type", { length: 50 }),

  // Certifications
  smallDisadvantaged: boolean("small_disadvantaged").default(false),
  womanOwned: boolean("woman_owned").default(false),
  veteranOwned: boolean("veteran_owned").default(false),
  serviceDisabledVetOwned: boolean("service_disabled_vet_owned").default(false),
  hubZone: boolean("hub_zone").default(false),
  historicallyUnderutilized: boolean("historically_underutilized").default(false),
  alaskaNativeCorp: boolean("alaska_native_corp").default(false),

  // Payment & Terms
  defaultPaymentTerms: varchar("default_payment_terms", { length: 100 }),
  defaultPaymentTermsOther: varchar("default_payment_terms_other", { length: 255 }),
  defaultFob: varchar("default_fob", { length: 50 }),
  defaultPurchaseOrderMin: numeric("default_purchase_order_min", { precision: 10, scale: 2 }),
  noFreightAdder: boolean("no_freight_adder").default(true),
  defaultPpaByVendor: boolean("default_ppa_by_vendor").default(false),
  countryOfOrigin: varchar("country_of_origin", { length: 50 }).default('USA'),

  // Contact Info
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const rfqDocuments = simurghSchema.table("rfq_documents", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull().unique(),
  s3Key: varchar("s3_key", { length: 500 }).notNull(),
  s3Url: text("s3_url"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),

  // Extracted content
  extractedText: text("extracted_text"),
  extractedFields: jsonb("extracted_fields"),

  // Metadata
  rfqNumber: varchar("rfq_number", { length: 100 }),
  dueDate: timestamp("due_date"),
  contractingOffice: varchar("contracting_office", { length: 255 }),

  // Status
  status: varchar("status", { length: 50 }).default("uploaded"), // uploaded, processing, processed, failed
  processingError: text("processing_error"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  statusIdx: index("idx_rfq_documents_status").on(table.status),
  rfqNumberIdx: index("idx_rfq_documents_rfq_number").on(table.rfqNumber),
  dueDateIdx: index("idx_rfq_documents_due_date").on(table.dueDate),
  createdAtIdx: index("idx_rfq_documents_created_at").on(table.createdAt),
}));

export const rfqResponses = simurghSchema.table("rfq_responses", {
  id: serial("id").primaryKey(),
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id),
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id),

  // Response details
  responseData: jsonb("response_data").notNull(),
  generatedPdfS3Key: varchar("generated_pdf_s3_key", { length: 500 }),
  generatedPdfUrl: text("generated_pdf_url"),

  // Vendor quote fields (for branded quote PDF generation)
  vendorQuoteRef: varchar("vendor_quote_ref", { length: 100 }), // e.g., ACQ-RFQ-FA8501-24-0014-01
  quoteValidUntil: timestamp("quote_valid_until"),
  generatedBrandedQuoteS3Key: varchar("generated_branded_quote_s3_key", { length: 500 }),
  generatedBrandedQuoteUrl: text("generated_branded_quote_url"),
  quoteNotes: text("quote_notes"), // Optional notes for the branded quote

  // Tracking
  submittedAt: timestamp("submitted_at"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, completed, submitted

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  rfqDocumentIdIdx: index("idx_rfq_responses_rfq_document_id").on(table.rfqDocumentId),
  statusIdx: index("idx_rfq_responses_status").on(table.status),
  vendorQuoteRefIdx: uniqueIndex("idx_rfq_responses_vendor_quote_ref").on(table.vendorQuoteRef),
}));

export const rfqHistory = simurghSchema.table("rfq_history", {
  id: serial("id").primaryKey(),
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id),
  rfqResponseId: integer("rfq_response_id").references(() => rfqResponses.id),

  action: varchar("action", { length: 100 }).notNull(), // upload, extract, fill, generate, submit
  details: jsonb("details"),
  performedBy: varchar("performed_by", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow()
});

// ===============================
// PROJECTS / WORKSPACES
// ===============================

// Projects - groups RFQ, Quote, PO, Quality Sheet, Labels together
export const projects = simurghSchema.table("projects", {
  id: serial("id").primaryKey(),

  // Project Info
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Customer Info
  customerName: varchar("customer_name", { length: 255 }),
  contractingOffice: varchar("contracting_office", { length: 255 }),

  // Document References
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id),
  rfqResponseId: integer("rfq_response_id").references(() => rfqResponses.id),
  governmentOrderId: integer("government_order_id"), // Will reference governmentOrders

  // Key extracted data for quick reference
  rfqNumber: varchar("rfq_number", { length: 100 }),
  poNumber: varchar("po_number", { length: 100 }),
  nsn: varchar("nsn", { length: 20 }),
  productName: varchar("product_name", { length: 255 }),
  quantity: integer("quantity"),

  // AI Comparison Results
  comparisonResults: jsonb("comparison_results"), // Stores RFQ vs PO comparison
  comparisonStatus: varchar("comparison_status", { length: 50 }), // matched, mismatched, pending

  // Workflow Status
  status: varchar("status", { length: 50 }).default("rfq_received"),
  // rfq_received, quoted, po_received, in_verification, verified, shipped

  // Dates
  rfqReceivedAt: timestamp("rfq_received_at"),
  quoteSentAt: timestamp("quote_sent_at"),
  poReceivedAt: timestamp("po_received_at"),
  verifiedAt: timestamp("verified_at"),
  shippedAt: timestamp("shipped_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("idx_projects_status").on(table.status),
  customerIdx: index("idx_projects_customer").on(table.customerName),
  createdAtIdx: index("idx_projects_created_at").on(table.createdAt),
}));

// ===============================
// GOVERNMENT VERIFICATION TABLES
// ===============================

// Orders for Government Verification - main workflow table
export const governmentOrders = simurghSchema.table("government_orders", {
  id: serial("id").primaryKey(),

  // PO Information (extracted from PDF)
  poNumber: varchar("po_number", { length: 50 }).notNull(),

  // Link back to originating RFQ (for full workflow tracking)
  rfqNumber: varchar("rfq_number", { length: 100 }), // RFQ number referenced in the PO
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id), // FK to rfqDocuments

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
  packingListS3Key: varchar("packing_list_s3_key", { length: 500 }), // Packing list attachment
  extractedData: jsonb("extracted_data"), // Full extracted JSON from PO

  // Workflow Status
  status: varchar("status", { length: 50 }).default("pending"),
  // pending, quality_sheet_created, labels_generated, verified, shipped

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  poNumberIdx: index("idx_government_orders_po_number").on(table.poNumber),
  rfqNumberIdx: index("idx_government_orders_rfq_number").on(table.rfqNumber),
  rfqDocumentIdIdx: index("idx_government_orders_rfq_document_id").on(table.rfqDocumentId),
  statusIdx: index("idx_government_orders_status").on(table.status),
  nsnIdx: index("idx_government_orders_nsn").on(table.nsn),
  createdAtIdx: index("idx_government_orders_created_at").on(table.createdAt),
}));

// Quality Sheets - SAIC Quality Sheet data
export const qualitySheets = simurghSchema.table("quality_sheets", {
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
  cageCode: varchar("cage_code", { length: 20 }).default("1LT50"),
  notes: text("notes"),

  // Verification
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated Labels - track box and bottle labels
export const generatedLabels = simurghSchema.table("generated_labels", {
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
  manufacturer: varchar("manufacturer", { length: 255 }).default("ALLIANCE CHEMICAL"),
  manufacturerAddress: varchar("manufacturer_address", { length: 255 }).default("204 S. EDMOND ST. TAYLOR, TEXAS 76574"),
  manufacturerPhone: varchar("manufacturer_phone", { length: 50 }).default("512-365-6838"),
  manufacturerWebsite: varchar("manufacturer_website", { length: 255 }).default("www.alliancechemical.com"),

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

// ===============================
// RFQ ↔ Government Order Links (many-to-many)
// ===============================

export const governmentOrderRfqLinks = simurghSchema.table("government_order_rfq_links", {
  id: serial("id").primaryKey(),
  governmentOrderId: integer("government_order_id").notNull().references(() => governmentOrders.id, { onDelete: "cascade" }),
  rfqDocumentId: integer("rfq_document_id").notNull().references(() => rfqDocuments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  governmentOrderIdIdx: index("idx_government_order_rfq_links_government_order_id").on(table.governmentOrderId),
  rfqDocumentIdIdx: index("idx_government_order_rfq_links_rfq_document_id").on(table.rfqDocumentId),
  uniquePairIdx: uniqueIndex("uq_government_order_rfq_links_government_order_id_rfq_document_id").on(
    table.governmentOrderId,
    table.rfqDocumentId
  ),
}));
