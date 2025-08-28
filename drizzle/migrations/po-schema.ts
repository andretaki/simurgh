import { serial, varchar, text, boolean, timestamp, jsonb, integer, decimal, pgSchema } from "drizzle-orm/pg-core";
import { simurghSchema, rfqDocuments, companyProfiles } from "./schema";

// ==================== VENDOR MANAGEMENT ====================
export const vendors = simurghSchema.table("vendors", {
  id: serial("id").primaryKey(),
  
  // Basic Information
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  vendorCode: varchar("vendor_code", { length: 100 }).unique(),
  vendorType: varchar("vendor_type", { length: 50 }), // supplier, contractor, service_provider
  
  // Contact Information
  primaryContact: varchar("primary_contact", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  alternateEmail: varchar("alternate_email", { length: 255 }),
  alternatePhone: varchar("alternate_phone", { length: 50 }),
  
  // Address
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  
  // Business Details
  taxId: varchar("tax_id", { length: 50 }),
  dunsNumber: varchar("duns_number", { length: 50 }),
  cageCode: varchar("cage_code", { length: 50 }),
  
  // Terms & Conditions
  paymentTerms: varchar("payment_terms", { length: 100 }), // NET30, NET60, etc.
  shippingTerms: varchar("shipping_terms", { length: 100 }), // FOB, CIF, etc.
  preferredCurrency: varchar("preferred_currency", { length: 10 }).default("USD"),
  
  // Performance Metrics
  rating: decimal("rating", { precision: 3, scale: 2 }), // 0.00 to 5.00
  totalOrdersCount: integer("total_orders_count").default(0),
  onTimeDeliveryRate: decimal("on_time_delivery_rate", { precision: 5, scale: 2 }), // percentage
  
  // Status
  status: varchar("status", { length: 50 }).default("active"), // active, inactive, suspended, blacklisted
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// ==================== PURCHASE ORDERS ====================
export const purchaseOrders = simurghSchema.table("purchase_orders", {
  id: serial("id").primaryKey(),
  
  // PO Identification
  poNumber: varchar("po_number", { length: 100 }).notNull().unique(),
  poDate: timestamp("po_date").defaultNow(),
  poType: varchar("po_type", { length: 50 }), // standard, blanket, contract, planned
  
  // Relationships
  vendorId: integer("vendor_id").references(() => vendors.id),
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id), // Link to originating RFQ
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id),
  
  // Source Information (for email-ingested POs)
  emailId: varchar("email_id", { length: 500 }), // Microsoft Graph email ID
  emailSender: varchar("email_sender", { length: 255 }),
  emailSubject: text("email_subject"),
  emailReceivedAt: timestamp("email_received_at"),
  
  // Vendor Information (denormalized for history)
  vendorName: varchar("vendor_name", { length: 255 }),
  vendorContact: varchar("vendor_contact", { length: 255 }),
  vendorEmail: varchar("vendor_email", { length: 255 }),
  vendorPhone: varchar("vendor_phone", { length: 50 }),
  
  // Delivery Information
  deliveryAddress: text("delivery_address"),
  deliveryDate: timestamp("delivery_date"),
  shipVia: varchar("ship_via", { length: 100 }),
  shippingTerms: varchar("shipping_terms", { length: 100 }),
  
  // Financial Information
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  shippingAmount: decimal("shipping_amount", { precision: 15, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  
  // Payment Information
  paymentTerms: varchar("payment_terms", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 50 }), // check, wire, credit_card, ach
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"), // pending, partial, paid, overdue
  
  // Document Storage
  s3Key: varchar("s3_key", { length: 500 }), // Original PO PDF
  s3Url: text("s3_url"),
  attachments: jsonb("attachments"), // Array of {name, s3Key, mimeType, size}
  
  // Extracted/Additional Data
  extractedText: text("extracted_text"),
  extractedFields: jsonb("extracted_fields"), // AI-extracted fields
  customFields: jsonb("custom_fields"), // User-defined fields
  
  // Status & Workflow
  status: varchar("status", { length: 50 }).default("draft"), 
  // draft, pending_approval, approved, sent, acknowledged, partial_delivery, delivered, completed, cancelled
  approvalStatus: varchar("approval_status", { length: 50 }),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  // Fulfillment Tracking
  fulfillmentStatus: varchar("fulfillment_status", { length: 50 }).default("pending"),
  // pending, in_progress, partial, completed, cancelled
  receivedQuantity: integer("received_quantity"),
  expectedQuantity: integer("expected_quantity"),
  
  // Notes & Comments
  internalNotes: text("internal_notes"),
  vendorNotes: text("vendor_notes"),
  
  // Audit Fields
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// ==================== PO LINE ITEMS ====================
export const poLineItems = simurghSchema.table("po_line_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  
  // Item Information
  lineNumber: integer("line_number").notNull(),
  itemCode: varchar("item_code", { length: 100 }),
  itemDescription: text("item_description").notNull(),
  category: varchar("category", { length: 100 }),
  
  // Specifications
  specifications: jsonb("specifications"), // {color, size, material, etc.}
  partNumber: varchar("part_number", { length: 100 }),
  manufacturerPartNumber: varchar("manufacturer_part_number", { length: 100 }),
  
  // Quantity & Pricing
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }), // each, box, kg, etc.
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  
  // Discounts & Tax
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  
  // Delivery
  requestedDeliveryDate: timestamp("requested_delivery_date"),
  promisedDeliveryDate: timestamp("promised_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  
  // Fulfillment
  receivedQuantity: decimal("received_quantity", { precision: 15, scale: 3 }).default("0"),
  acceptedQuantity: decimal("accepted_quantity", { precision: 15, scale: 3 }).default("0"),
  rejectedQuantity: decimal("rejected_quantity", { precision: 15, scale: 3 }).default("0"),
  fulfillmentStatus: varchar("fulfillment_status", { length: 50 }).default("pending"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// ==================== PO HISTORY/AUDIT ====================
export const poHistory = simurghSchema.table("po_history", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  
  action: varchar("action", { length: 100 }).notNull(), 
  // created, updated, approved, rejected, sent, acknowledged, delivered, cancelled, payment_made
  
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }),
  
  changes: jsonb("changes"), // Track field changes
  details: jsonb("details"), // Additional action details
  
  performedBy: varchar("performed_by", { length: 255 }),
  performedAt: timestamp("performed_at").defaultNow(),
  
  notes: text("notes")
});

// ==================== RFQ TO PO MAPPING ====================
export const rfqToPOMapping = simurghSchema.table("rfq_to_po_mapping", {
  id: serial("id").primaryKey(),
  
  rfqDocumentId: integer("rfq_document_id").references(() => rfqDocuments.id).notNull(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  
  // Conversion Details
  conversionType: varchar("conversion_type", { length: 50 }), // won_bid, direct_award, sole_source
  awardedAmount: decimal("awarded_amount", { precision: 15, scale: 2 }),
  awardedDate: timestamp("awarded_date"),
  
  // Competition Details
  totalBidders: integer("total_bidders"),
  winningReason: text("winning_reason"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow()
});

// ==================== INVOICES (Future Enhancement) ====================
export const invoices = simurghSchema.table("invoices", {
  id: serial("id").primaryKey(),
  
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0"),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, paid, overdue, disputed
  
  // Document Storage
  s3Key: varchar("s3_key", { length: 500 }),
  extractedFields: jsonb("extracted_fields"),
  
  // Email Source
  emailId: varchar("email_id", { length: 500 }),
  emailReceivedAt: timestamp("email_received_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Export type definitions for TypeScript
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type POLineItem = typeof poLineItems.$inferSelect;
export type NewPOLineItem = typeof poLineItems.$inferInsert;
export type POHistory = typeof poHistory.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;