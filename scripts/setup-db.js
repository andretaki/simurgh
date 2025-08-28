const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    // Create schema
    await sql`CREATE SCHEMA IF NOT EXISTS simurgh`;
    console.log('✓ Schema "simurgh" created');
    
    // Set search path
    await sql`SET search_path TO simurgh, public`;
    
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS simurgh.company_profiles (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        cage_code VARCHAR(50),
        duns_number VARCHAR(50),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),
        country VARCHAR(100),
        poc_name VARCHAR(255),
        poc_title VARCHAR(255),
        poc_email VARCHAR(255),
        poc_phone VARCHAR(50),
        small_business BOOLEAN DEFAULT false,
        woman_owned BOOLEAN DEFAULT false,
        veteran_owned BOOLEAN DEFAULT false,
        hub_zone BOOLEAN DEFAULT false,
        eight_a BOOLEAN DEFAULT false,
        naics_code VARCHAR(50),
        tax_id VARCHAR(50),
        payment_terms VARCHAR(100),
        shipping_terms VARCHAR(100),
        website_url VARCHAR(255),
        capabilities TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table "company_profiles" created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS simurgh.rfq_documents (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        s3_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        extracted_text TEXT,
        extracted_fields JSONB,
        rfq_number VARCHAR(100),
        due_date TIMESTAMP,
        contracting_office VARCHAR(255),
        status VARCHAR(50) DEFAULT 'uploaded',
        processing_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table "rfq_documents" created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS simurgh.rfq_responses (
        id SERIAL PRIMARY KEY,
        rfq_document_id INTEGER REFERENCES simurgh.rfq_documents(id),
        company_profile_id INTEGER REFERENCES simurgh.company_profiles(id),
        response_data JSONB NOT NULL,
        generated_pdf_s3_key VARCHAR(500),
        generated_pdf_url TEXT,
        submitted_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table "rfq_responses" created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS simurgh.rfq_history (
        id SERIAL PRIMARY KEY,
        rfq_document_id INTEGER REFERENCES simurgh.rfq_documents(id),
        rfq_response_id INTEGER REFERENCES simurgh.rfq_responses(id),
        action VARCHAR(100) NOT NULL,
        details JSONB,
        performed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table "rfq_history" created');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_rfq_documents_status ON simurgh.rfq_documents(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rfq_documents_rfq_number ON simurgh.rfq_documents(rfq_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rfq_responses_status ON simurgh.rfq_responses(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rfq_history_rfq_document_id ON simurgh.rfq_history(rfq_document_id)`;
    console.log('✓ Indexes created');
    
    console.log('\n✅ Database setup complete!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await sql.end();
  }
}

setupDatabase();