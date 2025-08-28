import { serial, varchar, text, boolean, timestamp, jsonb, integer, pgSchema } from "drizzle-orm/pg-core";

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
});

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
});

export const rfqHistory = simurghSchema.table("rfq_history", {
  id: serial("id").primaryKey(),
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id),
  rfqResponseId: integer("rfq_response_id").references(() => rfqResponses.id),
  
  action: varchar("action", { length: 100 }).notNull(), // upload, extract, fill, generate, submit
  details: jsonb("details"),
  performedBy: varchar("performed_by", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow()
});