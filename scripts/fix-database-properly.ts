#!/usr/bin/env tsx

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function fixDatabase() {
  console.log("🔧 Starting database cleanup and migration...");

  try {
    // Step 1: Create system tables for proper checkpoint tracking
    console.log("1. Creating system checkpoint table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_checkpoints (
        id SERIAL PRIMARY KEY,
        checkpoint_key VARCHAR(100) NOT NULL UNIQUE,
        data JSONB NOT NULL,
        last_successful_run TIMESTAMP,
        last_attempted_run TIMESTAMP,
        consecutive_failures INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("2. Creating email processing log table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_processing_log (
        id SERIAL PRIMARY KEY,
        email_id VARCHAR(255) NOT NULL UNIQUE,
        email_subject VARCHAR(500),
        sender_email VARCHAR(255),
        sender_name VARCHAR(255),
        received_at TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL,
        document_type VARCHAR(50),
        rfq_document_id INTEGER,
        purchase_order_id INTEGER,
        attachment_count INTEGER DEFAULT 0,
        processed_attachments JSONB,
        error_message VARCHAR(1000),
        processed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Step 2: Migrate checkpoint data from rfq_documents to system_checkpoints
    console.log("3. Migrating checkpoint data...");
    const checkpointRecords = await db.execute(sql`
      SELECT * FROM simurgh.rfq_documents 
      WHERE file_name = 'email_ingestion_checkpoint' 
      AND status = 'checkpoint'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (checkpointRecords.length > 0) {
      const checkpoint = checkpointRecords[0];
      const data = checkpoint.extracted_fields as any;
      
      await db.execute(sql`
        INSERT INTO system_checkpoints (
          checkpoint_key,
          data,
          last_successful_run,
          last_attempted_run,
          consecutive_failures
        ) VALUES (
          'email_ingestion_checkpoint',
          ${JSON.stringify(data)}::jsonb,
          ${data?.lastSuccessfulRun ? new Date(data.lastSuccessfulRun) : null},
          ${data?.lastAttemptedRun ? new Date(data.lastAttemptedRun) : null},
          ${data?.consecutiveFailures || 0}
        )
        ON CONFLICT (checkpoint_key) 
        DO UPDATE SET
          data = EXCLUDED.data,
          last_successful_run = EXCLUDED.last_successful_run,
          last_attempted_run = EXCLUDED.last_attempted_run,
          consecutive_failures = EXCLUDED.consecutive_failures,
          updated_at = NOW()
      `);
      
      console.log("   ✅ Checkpoint data migrated");
    }

    // Step 3: Clean up duplicate file_name entries in rfq_documents
    console.log("4. Cleaning up duplicate file names...");
    
    // First, delete checkpoint records (they're now in system_checkpoints)
    await db.execute(sql`
      DELETE FROM simurgh.rfq_documents 
      WHERE status = 'checkpoint'
    `);
    
    // Then handle actual duplicates - keep the most recent one
    const duplicates = await db.execute(sql`
      SELECT file_name, COUNT(*) as count, MAX(id) as keep_id
      FROM simurgh.rfq_documents
      GROUP BY file_name
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      console.log(`   Cleaning duplicate: ${dup.file_name} (keeping ID: ${dup.keep_id})`);
      await db.execute(sql`
        DELETE FROM simurgh.rfq_documents
        WHERE file_name = ${dup.file_name}
        AND id != ${dup.keep_id}
      `);
    }

    // Step 4: Now we can safely add the unique constraint
    console.log("5. Adding unique constraint to file_name...");
    try {
      await db.execute(sql`
        ALTER TABLE simurgh.rfq_documents
        ADD CONSTRAINT rfq_documents_file_name_unique UNIQUE (file_name)
      `);
      console.log("   ✅ Unique constraint added");
    } catch (e: any) {
      if (e.code === '42P07') { // Constraint already exists
        console.log("   ℹ️  Unique constraint already exists");
      } else {
        throw e;
      }
    }

    // Step 5: Create PO management tables
    console.log("6. Creating PO management tables...");
    
    // Create vendors table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        vendor_code VARCHAR(50) NOT NULL UNIQUE,
        vendor_name VARCHAR(255) NOT NULL,
        legal_name VARCHAR(255),
        primary_contact_name VARCHAR(255),
        primary_contact_email VARCHAR(255),
        primary_contact_phone VARCHAR(50),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'USA',
        tax_id VARCHAR(50),
        duns_number VARCHAR(50),
        cage_code VARCHAR(50),
        default_payment_terms VARCHAR(100),
        default_shipping_terms VARCHAR(100),
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(50) DEFAULT 'active',
        rating INTEGER,
        notes TEXT,
        total_po_count INTEGER DEFAULT 0,
        total_po_value NUMERIC(12,2) DEFAULT 0,
        on_time_delivery_rate NUMERIC(5,2),
        quality_rating NUMERIC(3,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create purchase_orders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        po_number VARCHAR(50) NOT NULL UNIQUE,
        revision INTEGER DEFAULT 0,
        vendor_id INTEGER REFERENCES vendors(id),
        vendor_name VARCHAR(255),
        vendor_contact VARCHAR(255),
        source_type VARCHAR(50),
        source_document_id INTEGER,
        email_id VARCHAR(255),
        order_date TIMESTAMP NOT NULL,
        requested_delivery_date TIMESTAMP,
        actual_delivery_date TIMESTAMP,
        subtotal NUMERIC(12,2) NOT NULL,
        tax_amount NUMERIC(10,2) DEFAULT 0,
        shipping_amount NUMERIC(10,2) DEFAULT 0,
        total_amount NUMERIC(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        payment_terms VARCHAR(100),
        shipping_terms VARCHAR(100),
        fob_point VARCHAR(100),
        shipping_method VARCHAR(100),
        bill_to_address JSONB,
        ship_to_address JSONB,
        status VARCHAR(50) DEFAULT 'draft',
        approval_status VARCHAR(50),
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        fulfillment_status VARCHAR(50) DEFAULT 'pending',
        percent_fulfilled INTEGER DEFAULT 0,
        original_pdf_s3_key VARCHAR(500),
        original_pdf_url TEXT,
        extracted_data JSONB,
        notes TEXT,
        internal_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create po_line_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS po_line_items (
        id SERIAL PRIMARY KEY,
        po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        line_number INTEGER NOT NULL,
        part_number VARCHAR(100),
        manufacturer_part_number VARCHAR(100),
        description TEXT NOT NULL,
        category VARCHAR(100),
        item_type VARCHAR(50),
        quantity INTEGER NOT NULL,
        unit_of_measure VARCHAR(20),
        quantity_received INTEGER DEFAULT 0,
        quantity_invoiced INTEGER DEFAULT 0,
        unit_price NUMERIC(10,4) NOT NULL,
        total_price NUMERIC(12,2) NOT NULL,
        discount_percent NUMERIC(5,2),
        discount_amount NUMERIC(10,2),
        requested_delivery_date TIMESTAMP,
        promised_delivery_date TIMESTAMP,
        actual_delivery_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        specifications JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for better performance
    console.log("7. Creating indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
      CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_line_items_po_id ON po_line_items(po_id);
      CREATE INDEX IF NOT EXISTS idx_email_log_email_id ON email_processing_log(email_id);
      CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_processing_log(status);
    `);

    console.log("✅ Database cleanup and migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Error during database migration:", error);
    throw error;
  }
}

// Run the migration
fixDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });