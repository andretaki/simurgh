import { serial, varchar, text, boolean, timestamp, jsonb, integer, numeric, pgSchema, index } from "drizzle-orm/pg-core";

// Create a schema object
export const simurghSchema = pgSchema("simurgh");

// Use the schema for all tables
export const companyProfiles = simurghSchema.table("company_profiles", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  cageCode: varchar("cage_code", { length: 50 }),
  dunsNumber: varchar("duns_number", { length: 50 }),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  pocName: varchar("poc_name", { length: 255 }),
  pocTitle: varchar("poc_title", { length: 255 }),
  pocEmail: varchar("poc_email", { length: 255 }),
  pocPhone: varchar("poc_phone", { length: 50 }),
  
  // Certifications
  smallBusiness: boolean("small_business").default(false),
  womanOwned: boolean("woman_owned").default(false),
  veteranOwned: boolean("veteran_owned").default(false),
  hubZone: boolean("hub_zone").default(false),
  eightA: boolean("eight_a").default(false),
  
  // Business Details
  naicsCode: varchar("naics_code", { length: 50 }),
  taxId: varchar("tax_id", { length: 50 }),
  
  // Payment & Terms
  paymentTerms: varchar("payment_terms", { length: 100 }),
  shippingTerms: varchar("shipping_terms", { length: 100 }),
  
  // Additional Info
  websiteUrl: varchar("website_url", { length: 255 }),
  capabilities: text("capabilities"),
  
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

  // Tracking
  submittedAt: timestamp("submitted_at"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, completed, submitted

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  rfqDocumentIdIdx: index("idx_rfq_responses_rfq_document_id").on(table.rfqDocumentId),
  statusIdx: index("idx_rfq_responses_status").on(table.status),
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
// GOVERNMENT VERIFICATION TABLES
// ===============================

// Orders for Government Verification - main workflow table
export const governmentOrders = simurghSchema.table("government_orders", {
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
  status: varchar("status", { length: 50 }).default("pending"),
  // pending, quality_sheet_created, labels_generated, verified, shipped

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  poNumberIdx: index("idx_government_orders_po_number").on(table.poNumber),
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