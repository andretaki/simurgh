CREATE SCHEMA "simurgh";
--> statement-breakpoint
CREATE TABLE "simurgh"."company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"cage_code" varchar(50),
	"duns_number" varchar(50),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"country" varchar(100),
	"poc_name" varchar(255),
	"poc_title" varchar(255),
	"poc_email" varchar(255),
	"poc_phone" varchar(50),
	"small_business" boolean DEFAULT false,
	"woman_owned" boolean DEFAULT false,
	"veteran_owned" boolean DEFAULT false,
	"hub_zone" boolean DEFAULT false,
	"eight_a" boolean DEFAULT false,
	"naics_code" varchar(50),
	"tax_id" varchar(50),
	"payment_terms" varchar(100),
	"shipping_terms" varchar(100),
	"website_url" varchar(255),
	"capabilities" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simurgh"."rfq_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"s3_key" varchar(500) NOT NULL,
	"s3_url" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"extracted_text" text,
	"extracted_fields" jsonb,
	"rfq_number" varchar(100),
	"due_date" timestamp,
	"contracting_office" varchar(255),
	"status" varchar(50) DEFAULT 'uploaded',
	"processing_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rfq_documents_file_name_unique" UNIQUE("file_name")
);
--> statement-breakpoint
CREATE TABLE "simurgh"."rfq_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_document_id" integer,
	"rfq_response_id" integer,
	"action" varchar(100) NOT NULL,
	"details" jsonb,
	"performed_by" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simurgh"."rfq_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_document_id" integer,
	"company_profile_id" integer,
	"response_data" jsonb NOT NULL,
	"generated_pdf_s3_key" varchar(500),
	"generated_pdf_url" text,
	"submitted_at" timestamp,
	"status" varchar(50) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "simurgh"."rfq_history" ADD CONSTRAINT "rfq_history_rfq_document_id_rfq_documents_id_fk" FOREIGN KEY ("rfq_document_id") REFERENCES "simurgh"."rfq_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simurgh"."rfq_history" ADD CONSTRAINT "rfq_history_rfq_response_id_rfq_responses_id_fk" FOREIGN KEY ("rfq_response_id") REFERENCES "simurgh"."rfq_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simurgh"."rfq_responses" ADD CONSTRAINT "rfq_responses_rfq_document_id_rfq_documents_id_fk" FOREIGN KEY ("rfq_document_id") REFERENCES "simurgh"."rfq_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simurgh"."rfq_responses" ADD CONSTRAINT "rfq_responses_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "simurgh"."company_profiles"("id") ON DELETE no action ON UPDATE no action;