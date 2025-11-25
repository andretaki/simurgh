// Common types used throughout the application

// Activity and History types
export interface ActivityItem {
  id: number;
  type: "upload" | "process" | "generate" | "submit" | "error";
  title: string;
  description?: string;
  timestamp: string;
  status?: "success" | "pending" | "error";
  metadata?: Record<string, unknown>;
}

// RFQ Document types
export interface RfqDocument {
  id: number;
  fileName: string;
  s3Key: string;
  s3Url?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  extractedText?: string | null;
  extractedFields?: ExtractedFields | null;
  rfqNumber?: string | null;
  dueDate?: string | null;
  contractingOffice?: string | null;
  status: "uploaded" | "processing" | "processed" | "failed";
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedFields {
  fields?: Record<string, ExtractedField>;
  documentType?: string;
  confidence?: number;
  // Additional extracted fields used in RFQ processing
  pocName?: string;
  pocEmail?: string;
  pocPhone?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  items?: ExtractedItem[];
  rfqNumber?: string;
  dueDate?: string;
}

export interface ExtractedField {
  value: string;
  confidence: number;
  source?: string;
}

export interface ExtractedItem {
  description?: string;
  quantity?: number;
  unit?: string;
  partNumber?: string;
  nsn?: string;
}

// Government Order types
export interface GovernmentOrder {
  id: number;
  poNumber: string;
  productName: string;
  productDescription?: string | null;
  grade?: string | null;
  nsn?: string | null;
  nsnBarcode?: string | null;
  quantity: number;
  unitOfMeasure?: string | null;
  unitContents?: string | null;
  unitPrice?: string | null;
  totalPrice?: string | null;
  spec?: string | null;
  milStd?: string | null;
  shipToName?: string | null;
  shipToAddress?: string | null;
  deliveryDate?: string | null;
  originalPdfS3Key?: string | null;
  originalPdfUrl?: string | null;
  extractedData?: Record<string, unknown> | null;
  status: "pending" | "quality_sheet_created" | "labels_generated" | "verified" | "shipped";
  createdAt: string;
  updatedAt: string;
}

// Quality Sheet types
export interface QualitySheet {
  id: number;
  orderId: number;
  poNumber: string;
  lotNumber: string;
  nsn?: string | null;
  quantity: number;
  productType?: string | null;
  shipTo?: string | null;
  assemblyDate?: string | null;
  inspectionDate?: string | null;
  mhmDate?: string | null;
  cageCode?: string | null;
  notes?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Generated Label types
export interface GeneratedLabel {
  id: number;
  orderId: number;
  qualitySheetId?: number | null;
  labelType: "box" | "bottle";
  labelSize: "4x6" | "3x4";
  productName: string;
  grade?: string | null;
  spec?: string | null;
  nsn?: string | null;
  nsnBarcode?: string | null;
  cageCode?: string | null;
  poNumber?: string | null;
  lotNumber?: string | null;
  quantity?: string | null;
  weight?: string | null;
  assemblyDate?: string | null;
  inspectionDate?: string | null;
  mhmDate?: string | null;
  containerType?: string | null;
  manufacturer?: string | null;
  manufacturerAddress?: string | null;
  manufacturerPhone?: string | null;
  manufacturerWebsite?: string | null;
  hazardClass?: string | null;
  unNumber?: string | null;
  pdfS3Key?: string | null;
  pdfUrl?: string | null;
  printCount?: number;
  lastPrintedAt?: string | null;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  results: T[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// System Health types
export interface SystemHealth {
  database: "online" | "error" | "checking";
  s3: "online" | "error" | "checking";
  openai: "online" | "error" | "checking";
  server: "online" | "offline" | "error";
}

// Stats types
export interface DashboardStats {
  documentsToday: number;
  pendingActions: number;
  processingQueue: number;
  successRate: number;
}

// Company Profile types
export interface CompanyProfile {
  id?: number;
  companyName: string;
  cageCode?: string | null;
  dunsNumber?: string | null;
  samUei?: string | null;
  samRegistered?: boolean;
  naicsCode?: string | null;
  naicsSize?: string | null;
  businessType?: string | null;
  smallDisadvantaged?: boolean;
  womanOwned?: boolean;
  veteranOwned?: boolean;
  serviceDisabledVetOwned?: boolean;
  hubZone?: boolean;
  historicallyUnderutilized?: boolean;
  alaskaNativeCorp?: boolean;
  defaultPaymentTerms?: string | null;
  defaultPaymentTermsOther?: string | null;
  defaultFob?: string | null;
  defaultPurchaseOrderMin?: string | null;
  defaultComplimentaryFreight?: boolean;
  defaultPpaByVendor?: boolean;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  pocName?: string | null;
  pocTitle?: string | null;
  pocEmail?: string | null;
  pocPhone?: string | null;
  smallBusiness?: boolean;
  eightA?: boolean;
  taxId?: string | null;
  paymentTerms?: string | null;
  shippingTerms?: string | null;
  websiteUrl?: string | null;
  capabilities?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
