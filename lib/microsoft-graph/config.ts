// Email configuration for RFQ ingestion
export const EMAIL_CONFIG = {
  // The email account we're monitoring for incoming RFQs
  MONITORED_EMAIL: process.env.BOSS_EMAIL || "alliance@alliancechemical.com",
  
  // The sender we're looking for RFQs from
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
};

export function isAuthorizedSender(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return EMAIL_CONFIG.AUTHORIZED_SENDERS.some(
    sender => sender.toLowerCase() === normalizedEmail
  );
}