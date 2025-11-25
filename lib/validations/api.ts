import { z } from "zod";

// Government Order validation
export const GovernmentOrderCreateSchema = z.object({
  poNumber: z.string().min(1, "PO number is required").max(50),
  productName: z.string().min(1, "Product name is required").max(255),
  productDescription: z.string().max(5000).optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  nsn: z.string().max(20).optional().nullable(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitOfMeasure: z.string().max(20).optional().nullable(),
  unitContents: z.string().max(100).optional().nullable(),
  unitPrice: z.string().or(z.number()).optional().nullable(),
  totalPrice: z.string().or(z.number()).optional().nullable(),
  spec: z.string().max(255).optional().nullable(),
  milStd: z.string().max(100).optional().nullable(),
  shipToName: z.string().max(255).optional().nullable(),
  shipToAddress: z.string().max(2000).optional().nullable(),
  deliveryDate: z.string().datetime().optional().nullable(),
  originalPdfS3Key: z.string().max(500).optional().nullable(),
  originalPdfUrl: z.string().url().optional().nullable(),
  extractedData: z.record(z.unknown()).optional().nullable(),
});

export const GovernmentOrderUpdateSchema = GovernmentOrderCreateSchema.partial().extend({
  status: z.enum(["pending", "quality_sheet_created", "labels_generated", "verified", "shipped"]).optional(),
});

// Quality Sheet validation
export const QualitySheetCreateSchema = z.object({
  orderId: z.number().int().positive(),
  poNumber: z.string().min(1).max(50),
  lotNumber: z.string().min(1).max(50),
  nsn: z.string().max(20).optional().nullable(),
  quantity: z.number().int().positive(),
  productType: z.string().max(100).optional().nullable(),
  shipTo: z.string().max(2000).optional().nullable(),
  assemblyDate: z.string().max(20).optional().nullable(),
  inspectionDate: z.string().max(20).optional().nullable(),
  mhmDate: z.string().max(20).optional().nullable(),
  cageCode: z.string().max(20).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

// Generated Label validation
export const GeneratedLabelCreateSchema = z.object({
  orderId: z.number().int().positive(),
  qualitySheetId: z.number().int().positive().optional().nullable(),
  labelType: z.enum(["box", "bottle"]),
  labelSize: z.enum(["4x6", "3x4"]),
  productName: z.string().min(1).max(255),
  grade: z.string().max(50).optional().nullable(),
  spec: z.string().max(255).optional().nullable(),
  nsn: z.string().max(20).optional().nullable(),
  nsnBarcode: z.string().max(20).optional().nullable(),
  cageCode: z.string().max(20).optional().nullable(),
  poNumber: z.string().max(50).optional().nullable(),
  lotNumber: z.string().max(50).optional().nullable(),
  quantity: z.string().max(50).optional().nullable(),
  weight: z.string().max(20).optional().nullable(),
  assemblyDate: z.string().max(20).optional().nullable(),
  inspectionDate: z.string().max(20).optional().nullable(),
  mhmDate: z.string().max(20).optional().nullable(),
  containerType: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(255).optional().nullable(),
  manufacturerAddress: z.string().max(255).optional().nullable(),
  manufacturerPhone: z.string().max(50).optional().nullable(),
  manufacturerWebsite: z.string().max(255).optional().nullable(),
  hazardClass: z.string().max(50).optional().nullable(),
  unNumber: z.string().max(20).optional().nullable(),
  hazardPictograms: z.array(z.string()).optional().nullable(),
});

// RFQ Response validation
export const RfqResponseCreateSchema = z.object({
  rfqDocumentId: z.number().int().positive(),
  companyProfileId: z.number().int().positive().optional().nullable(),
  responseData: z.record(z.unknown()),
  status: z.enum(["draft", "completed", "submitted"]).optional(),
});

// RFQ Search validation
export const RfqSearchSchema = z.object({
  query: z.string().max(500).optional(),
  filters: z.object({
    status: z.union([z.string(), z.array(z.string())]).optional(),
    dateRange: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    dueDate: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    contractingOffice: z.union([z.string(), z.array(z.string())]).optional(),
    extractedFields: z.record(z.string()).optional(),
    minConfidence: z.number().min(0).max(100).optional(),
  }).optional(),
  sort: z.object({
    field: z.enum(["createdAt", "dueDate", "fileName", "rfqNumber", "status"]),
    order: z.enum(["asc", "desc"]),
  }).optional(),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
  }).optional(),
  includeExtractedFields: z.boolean().optional(),
});

// S3 Upload validation
export const S3UploadSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  contentType: z.string().max(100).optional(),
});

// File Upload (PO) validation
export const PoUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  s3Key: z.string().min(1).max(500),
  s3Url: z.string().url().optional(),
  extractedData: z.record(z.unknown()).optional(),
});

// Helper function to validate request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; details: z.ZodError }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        error: "Validation failed",
        details: result.error,
      };
    }

    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      error: "Invalid JSON body",
      details: new z.ZodError([]),
    };
  }
}

// Type exports
export type GovernmentOrderCreate = z.infer<typeof GovernmentOrderCreateSchema>;
export type GovernmentOrderUpdate = z.infer<typeof GovernmentOrderUpdateSchema>;
export type QualitySheetCreate = z.infer<typeof QualitySheetCreateSchema>;
export type GeneratedLabelCreate = z.infer<typeof GeneratedLabelCreateSchema>;
export type RfqResponseCreate = z.infer<typeof RfqResponseCreateSchema>;
export type RfqSearch = z.infer<typeof RfqSearchSchema>;
