-- Add unique constraint on file_name for checkpoint tracking
ALTER TABLE simurgh.rfq_documents 
ADD CONSTRAINT rfq_documents_file_name_unique UNIQUE (file_name);