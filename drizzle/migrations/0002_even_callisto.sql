CREATE INDEX "idx_government_orders_po_number" ON "simurgh"."government_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "idx_government_orders_status" ON "simurgh"."government_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_government_orders_nsn" ON "simurgh"."government_orders" USING btree ("nsn");--> statement-breakpoint
CREATE INDEX "idx_government_orders_created_at" ON "simurgh"."government_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rfq_documents_status" ON "simurgh"."rfq_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rfq_documents_rfq_number" ON "simurgh"."rfq_documents" USING btree ("rfq_number");--> statement-breakpoint
CREATE INDEX "idx_rfq_documents_due_date" ON "simurgh"."rfq_documents" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_rfq_documents_created_at" ON "simurgh"."rfq_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rfq_responses_rfq_document_id" ON "simurgh"."rfq_responses" USING btree ("rfq_document_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_responses_status" ON "simurgh"."rfq_responses" USING btree ("status");