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
  defaultComplimentaryFreight: boolean("default_complimentary_freight").default(false),
  defaultPpaByVendor: boolean("default_ppa_by_vendor").default(false),
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