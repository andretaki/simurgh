# Email Ingestion Setup Guide

## Overview
The system automatically ingests RFQ documents from emails sent by **noreply@asrcfederal.com** to **alliance@alliancechemical.com**.

## Architecture

### Components:
1. **Microsoft Graph API Integration** - Connects to Outlook/Exchange
2. **Email Filtering** - Only processes emails from `noreply@asrcfederal.com`
3. **PDF Extraction** - Extracts and processes PDF attachments
4. **AI Processing** - Uses OpenAI to extract structured RFQ data
5. **Database Storage** - Stores email metadata and extracted fields

## Setup Instructions

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory → App registrations
3. Create new registration with these permissions:
   - `Mail.Read` - Read user mail
   - `Mail.ReadWrite` - Mark emails as read
   - `User.Read` - Get user profile

### 2. Environment Variables

Add these to your `.env.local`:

```env
# Microsoft Graph API
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
BOSS_EMAIL=your-boss-email@example.com
RFQ_SENDER_EMAIL=noreply@example.com
GRAPH_SCOPE=https://graph.microsoft.com/.default

# Optional: Secure the polling endpoint
EMAIL_POLL_API_KEY=your-secret-key-here
```

### 3. API Endpoints

#### Manual Ingestion
Process all unread emails from the sender:
```bash
GET /api/email/ingest
```

#### Single Email Polling (Recommended)
Process one email at a time:
```bash
GET /api/email/poll
```

#### Webhook Setup
Register for real-time notifications:
```bash
GET /api/email/webhook  # Setup subscription
POST /api/email/webhook # Receive notifications
```

## Usage

### Option 1: Scheduled Polling (Recommended)

Add to your cron job or scheduler:
```bash
# Process 1 email every 5 minutes
*/5 * * * * curl https://yourdomain.com/api/email/poll

# With API key for security
*/5 * * * * curl -H "x-api-key: your-secret-key" https://yourdomain.com/api/email/poll
```

### Option 2: Real-time Webhook

1. Setup webhook subscription:
```bash
curl https://yourdomain.com/api/email/webhook
```

2. Microsoft will send notifications to `/api/email/webhook` when new emails arrive

### Option 3: Manual Trigger

Process emails on-demand:
```bash
curl https://yourdomain.com/api/email/ingest
```

## Processing Flow

1. **Email Arrives** from `noreply@asrcfederal.com`
2. **System Checks** for PDF attachments
3. **Uploads PDFs** to S3 bucket (`rfqs/email/` prefix)
4. **Extracts Text** using pdf-parse
5. **AI Processing** extracts RFQ fields:
   - RFQ Number
   - Due Date
   - Contact Information
   - Line Items
   - Terms & Conditions
6. **Stores in Database** with email metadata:
   - Sender information
   - Email subject
   - Received date/time
   - Attachment details
7. **Marks Email as Read** in inbox

## Email Metadata Stored

- `emailSource`: Sender's email address
- `emailSenderName`: Sender's display name
- `emailSubject`: Email subject line
- `emailReceivedAt`: Timestamp when received
- `emailBodyPreview`: First 255 chars of email body

## Configuration

### Modify Sender Email

To change the sender being monitored, update:

1. Environment variable:
```env
RFQ_SENDER_EMAIL=newemail@example.com
```

2. Or modify `/lib/microsoft-graph/config.ts`:
```typescript
RFQ_SENDER_EMAIL: "newemail@example.com"
```

### Add Multiple Senders

Edit `/lib/microsoft-graph/config.ts`:
```typescript
AUTHORIZED_SENDERS: [
  "noreply@asrcfederal.com",
  "rfq@anothervendor.com",
  // Add more as needed
]
```

## Monitoring

Check processing status:
```sql
-- View recently ingested RFQs from email
SELECT 
  id,
  fileName,
  extractedFields->>'emailSubject' as email_subject,
  extractedFields->>'emailSource' as sender,
  status,
  createdAt
FROM simurgh.rfq_documents
WHERE extractedFields->>'emailSource' IS NOT NULL
ORDER BY createdAt DESC
LIMIT 10;
```

## Troubleshooting

### Emails Not Processing

1. Check sender email matches exactly: `noreply@asrcfederal.com`
2. Verify email has PDF attachments
3. Check Microsoft Graph permissions
4. Review logs for authentication errors

### Authentication Issues

1. Verify Azure AD app registration
2. Check CLIENT_ID and CLIENT_SECRET
3. Ensure TENANT_ID is correct
4. Confirm app has Mail.Read permission

### Testing

Send test email:
1. From: Must be `noreply@asrcfederal.com` (or configured sender)
2. To: `alliance@alliancechemical.com`
3. Attachment: Include PDF file
4. Subject: Any subject (no keyword filtering)

Then trigger processing:
```bash
curl https://yourdomain.com/api/email/poll
```

## Security Notes

1. Emails are marked as read after processing
2. Only processes PDFs (ignores other attachments)
3. Stores first 10,000 chars of extracted text
4. Presigned S3 URLs expire after 7 days
5. Webhook subscriptions expire after 3 days (auto-renewable)