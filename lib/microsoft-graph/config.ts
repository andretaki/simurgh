// Email configuration for RFQ and PO ingestion
export const EMAIL_CONFIG = {
  // The email account we're monitoring for incoming RFQs/POs
  MONITORED_EMAIL: process.env.BOSS_EMAIL || "alliance@alliancechemical.com",

  // The sender we're looking for RFQs/POs from
  RFQ_SENDER_EMAIL: "noreply@asrcfederal.com",

  // Optional: Additional authorized senders (can be extended)
  AUTHORIZED_SENDERS: [
    "noreply@asrcfederal.com",
    // Add more sender emails here if needed
  ],

  // Processing configuration
  PROCESS_SINGLE_EMAIL: true, // Process one email at a time
  MAX_ATTACHMENT_SIZE: 50 * 1024 * 1024, // 50MB max file size

  // Supported file types
  SUPPORTED_MIME_TYPES: [
    "application/pdf",
    "application/x-pdf",
  ],

  // Subject patterns for document type detection
  SUBJECT_PATTERNS: {
    RFQ: /request\s+for\s+quote\s*(\d+)/i,
    PO: /purchase\s+order\s*(\d+)/i,
  },

  // Email subject keywords (optional, currently filtering by sender only)
  RFQ_KEYWORDS: [
    "rfq",
    "request for quote",
    "quotation",
    "quote request",
    "rfp",
    "solicitation",
    "bid",
  ],

  PO_KEYWORDS: [
    "purchase order",
    "po",
    "award",
  ],
};

export type DocumentType = "rfq" | "po" | "unknown";

export interface DetectedDocument {
  type: DocumentType;
  documentNumber: string | null;
}

/**
 * Detects document type from email subject
 * - "Request For Quote 36240756" -> { type: "rfq", documentNumber: "36240756" }
 * - "ASRC Federal Purchase Order 45711465" -> { type: "po", documentNumber: "45711465" }
 */
export function detectDocumentType(subject: string): DetectedDocument {
  // Check for RFQ pattern
  const rfqMatch = subject.match(EMAIL_CONFIG.SUBJECT_PATTERNS.RFQ);
  if (rfqMatch) {
    return { type: "rfq", documentNumber: rfqMatch[1] };
  }

  // Check for PO pattern
  const poMatch = subject.match(EMAIL_CONFIG.SUBJECT_PATTERNS.PO);
  if (poMatch) {
    return { type: "po", documentNumber: poMatch[1] };
  }

  // Fallback to keyword detection
  const lowerSubject = subject.toLowerCase();
  if (EMAIL_CONFIG.PO_KEYWORDS.some(kw => lowerSubject.includes(kw))) {
    return { type: "po", documentNumber: null };
  }
  if (EMAIL_CONFIG.RFQ_KEYWORDS.some(kw => lowerSubject.includes(kw))) {
    return { type: "rfq", documentNumber: null };
  }

  return { type: "unknown", documentNumber: null };
}

export function isAuthorizedSender(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return EMAIL_CONFIG.AUTHORIZED_SENDERS.some(
    sender => sender.toLowerCase() === normalizedEmail
  );
}