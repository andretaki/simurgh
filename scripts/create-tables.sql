-- Create RFQ tables manually
CREATE TABLE IF NOT EXISTS company_profiles (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    cage_code VARCHAR(50),
    sam_uei VARCHAR(50),
    sam_registered BOOLEAN DEFAULT false,
    naics_code VARCHAR(10),
    naics_size VARCHAR(100),
    business_type VARCHAR(50) DEFAULT 'Small',
    small_disadvantaged BOOLEAN DEFAULT false,
    woman_owned BOOLEAN DEFAULT false,
    veteran_owned BOOLEAN DEFAULT false,
    service_disabled_vet_owned BOOLEAN DEFAULT false,
    hub_zone BOOLEAN DEFAULT false,
    historically_underutilized BOOLEAN DEFAULT false,
    alaska_native_corp BOOLEAN DEFAULT false,
    default_payment_terms VARCHAR(50) DEFAULT 'Net 30',
    default_payment_terms_other VARCHAR(100),
    default_fob VARCHAR(50) DEFAULT 'Destination',
    default_purchase_order_min VARCHAR(50),
    default_complimentary_freight BOOLEAN DEFAULT false,
    default_ppa_by_vendor BOOLEAN DEFAULT false,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rfq_documents (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    extracted_text TEXT,
    extracted_fields JSONB,
    s3_url TEXT,
    rfq_number VARCHAR(100),
    due_date TIMESTAMP,
    contracting_office VARCHAR(255),
    status VARCHAR(50) DEFAULT 'uploaded',
    processing_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rfq_responses (
    id SERIAL PRIMARY KEY,
    rfq_document_id INTEGER NOT NULL REFERENCES rfq_documents(id),
    response_data JSONB,
    pdf_url TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rfq_history (
    id SERIAL PRIMARY KEY,
    rfq_document_id INTEGER NOT NULL REFERENCES rfq_documents(id),
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);