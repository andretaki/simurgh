import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

// Load env from .env.local
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  try {
    console.log("Dropping existing table...");
    await sql`DROP TABLE IF EXISTS simurgh.company_profiles CASCADE`;

    console.log("Creating new table...");
    await sql`
      CREATE TABLE simurgh.company_profiles (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        cage_code VARCHAR(50),
        sam_uei VARCHAR(50),
        sam_registered BOOLEAN DEFAULT FALSE,
        naics_code VARCHAR(50),
        naics_size VARCHAR(100),
        employee_count VARCHAR(50),
        business_type VARCHAR(50),
        small_disadvantaged BOOLEAN DEFAULT FALSE,
        woman_owned BOOLEAN DEFAULT FALSE,
        veteran_owned BOOLEAN DEFAULT FALSE,
        service_disabled_vet_owned BOOLEAN DEFAULT FALSE,
        hub_zone BOOLEAN DEFAULT FALSE,
        historically_underutilized BOOLEAN DEFAULT FALSE,
        alaska_native_corp BOOLEAN DEFAULT FALSE,
        default_payment_terms VARCHAR(100),
        default_payment_terms_other VARCHAR(255),
        default_fob VARCHAR(50),
        default_purchase_order_min NUMERIC(10,2),
        no_freight_adder BOOLEAN DEFAULT TRUE,
        default_ppa_by_vendor BOOLEAN DEFAULT FALSE,
        country_of_origin VARCHAR(50) DEFAULT 'USA',
        contact_person VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log("Inserting default Alliance Chemical profile...");
    await sql`
      INSERT INTO simurgh.company_profiles (
        company_name,
        cage_code,
        sam_registered,
        naics_code,
        naics_size,
        employee_count,
        business_type,
        default_payment_terms,
        default_fob,
        no_freight_adder,
        country_of_origin,
        contact_person,
        contact_email,
        contact_phone
      ) VALUES (
        'Alliance Chemical',
        '1LT50',
        TRUE,
        '324191',
        '<500 employees',
        '<500',
        'Small',
        'Net 30',
        'Origin',
        TRUE,
        'USA',
        'Hossein Taki',
        'alliance@alliancechemical.com',
        '512-784-3222'
      )
    `;

    const result = await sql`SELECT * FROM simurgh.company_profiles`;
    console.log("Migration complete! Profile:", JSON.stringify(result[0], null, 2));
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

migrate();
