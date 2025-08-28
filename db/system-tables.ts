import {
  pgTable,
  serial,
  varchar,
  timestamp,
  jsonb,
  integer,
  unique,
} from "drizzle-orm/pg-core";

// System Checkpoints Table - For tracking system state like email ingestion
export const systemCheckpoints = pgTable("system_checkpoints", {
  id: serial("id").primaryKey(),
  
  // Unique key for the checkpoint
  checkpointKey: varchar("checkpoint_key", { length: 100 }).notNull().unique(),
  
  // Checkpoint data
  data: jsonb("data").notNull(),
  
  // Metadata
  lastSuccessfulRun: timestamp("last_successful_run"),
  lastAttemptedRun: timestamp("last_attempted_run"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email Processing Log - Track all processed emails
export const emailProcessingLog = pgTable("email_processing_log", {
  id: serial("id").primaryKey(),
  
  // Email identification
  emailId: varchar("email_id", { length: 255 }).notNull().unique(), // MS Graph email ID
  emailSubject: varchar("email_subject", { length: 500 }),
  senderEmail: varchar("sender_email", { length: 255 }),
  senderName: varchar("sender_name", { length: 255 }),
  receivedAt: timestamp("received_at").notNull(),
  
  // Processing status
  status: varchar("status", { length: 50 }).notNull(), // processed, skipped, failed
  documentType: varchar("document_type", { length: 50 }), // rfq, po, invoice, quote, other
  
  // References to created documents
  rfqDocumentId: integer("rfq_document_id"),
  purchaseOrderId: integer("purchase_order_id"),
  
  // Processing details
  attachmentCount: integer("attachment_count").default(0),
  processedAttachments: jsonb("processed_attachments"),
  errorMessage: varchar("error_message", { length: 1000 }),
  
  // Timestamps
  processedAt: timestamp("processed_at").defaultNow(),
});