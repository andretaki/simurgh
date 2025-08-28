-- Fix the unique constraint issue for email checkpoint tracking
-- First, remove any duplicate file_name entries if they exist
DELETE FROM simurgh.rfq_documents a
WHERE a.id > (
  SELECT MIN(b.id) 
  FROM simurgh.rfq_documents b 
  WHERE b.file_name = a.file_name
);

-- Add unique constraint on file_name
ALTER TABLE simurgh.rfq_documents 
ADD CONSTRAINT rfq_documents_file_name_unique UNIQUE (file_name);