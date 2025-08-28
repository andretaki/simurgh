import { Client } from "@microsoft/microsoft-graph-client";
import { Message, Attachment, FileAttachment } from "@microsoft/microsoft-graph-types";
import { createGraphClient, getMonitoredUserId } from "./auth";
import { downloadFromS3, uploadToS3 } from "@/lib/aws/s3";
import { EMAIL_CONFIG } from "./config";

export interface EmailWithAttachments {
  message: Message;
  attachments: FileAttachment[];
}

export interface ProcessedEmail {
  subject: string;
  sender: string;
  senderName: string;
  receivedDateTime: string;
  bodyPreview: string;
  attachments: {
    name: string;
    contentType: string;
    size: number;
    s3Key: string;
  }[];
}

/**
 * Fetches unread emails from the monitored inbox
 */
export async function fetchUnreadEmails(
  client: Client,
  userId: string,
  limit: number = 50
): Promise<Message[]> {
  try {
    // Simplified query - filter by sender only, then check isRead in code
    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .filter(`from/emailAddress/address eq '${EMAIL_CONFIG.RFQ_SENDER_EMAIL}'`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,body,isRead")
      .orderby("receivedDateTime asc") // Process oldest first
      .top(limit)
      .get();
    
    // Filter unread messages in code
    const unreadMessages = (messages.value || []).filter((m: any) => !m.isRead);

    return unreadMessages;
  } catch (error) {
    console.error("Error fetching unread emails:", error);
    throw error;
  }
}

/**
 * Fetches attachments for a specific email
 */
export async function fetchEmailAttachments(
  client: Client,
  userId: string,
  messageId: string
): Promise<FileAttachment[]> {
  try {
    const attachments = await client
      .api(`/users/${userId}/messages/${messageId}/attachments`)
      .filter("isInline eq false") // Exclude inline attachments (images in email body)
      .get();

    // Filter for PDF attachments
    return (attachments.value || []).filter(
      (att: Attachment) => 
        (att as any)["@odata.type"] === "#microsoft.graph.fileAttachment" &&
        (att.contentType === "application/pdf" || att.name?.toLowerCase().endsWith(".pdf"))
    ) as FileAttachment[];
  } catch (error) {
    console.error("Error fetching attachments:", error);
    throw error;
  }
}

/**
 * Marks an email as read
 */
export async function markEmailAsRead(
  client: Client,
  userId: string,
  messageId: string
): Promise<void> {
  try {
    await client
      .api(`/users/${userId}/messages/${messageId}`)
      .patch({ isRead: true });
  } catch (error) {
    console.error("Error marking email as read:", error);
    throw error;
  }
}

/**
 * Processes emails with RFQ attachments
 */
export async function processRFQEmails(limitToOne: boolean = false): Promise<ProcessedEmail[]> {
  const client = createGraphClient();
  const userId = await getMonitoredUserId(client);
  
  // If limitToOne is true, only fetch 1 email
  const unreadEmails = await fetchUnreadEmails(client, userId, limitToOne ? 1 : 50);
  const processedEmails: ProcessedEmail[] = [];

  for (const email of unreadEmails) {
    // Check if email has attachments (already filtered for noreply@asrcfederal.com)
    if (!email.hasAttachments) continue;

    try {
      // Fetch attachments
      const attachments = await fetchEmailAttachments(client, userId, email.id!);
      
      if (attachments.length === 0) continue;

      const processedAttachments = [];
      
      // Upload each PDF attachment to S3
      for (const attachment of attachments) {
        const timestamp = Date.now();
        const s3Key = `rfqs/email/${timestamp}-${attachment.name}`;
        
        // Decode base64 content
        const buffer = Buffer.from(attachment.contentBytes!, "base64");
        
        // Upload to S3
        await uploadToS3(s3Key, buffer, attachment.contentType || "application/pdf");
        
        processedAttachments.push({
          name: attachment.name!,
          contentType: attachment.contentType!,
          size: attachment.size!,
          s3Key,
        });
      }

      // Mark email as read
      await markEmailAsRead(client, userId, email.id!);

      processedEmails.push({
        subject: email.subject || "",
        sender: email.from?.emailAddress?.address || "",
        senderName: email.from?.emailAddress?.name || "",
        receivedDateTime: email.receivedDateTime || new Date().toISOString(),
        bodyPreview: email.bodyPreview || "",
        attachments: processedAttachments,
      });

    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
      // Continue processing other emails
    }
  }

  return processedEmails;
}

/**
 * Sets up a webhook subscription for new emails
 */
export async function createEmailSubscription(
  client: Client,
  userId: string,
  notificationUrl: string
): Promise<any> {
  const subscription = {
    changeType: "created",
    notificationUrl: notificationUrl,
    resource: `/users/${userId}/mailFolders/inbox/messages`,
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    clientState: "rfq-ingestion-webhook",
  };

  try {
    const result = await client.api("/subscriptions").post(subscription);
    return result;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

/**
 * Renews an existing webhook subscription
 */
export async function renewSubscription(
  client: Client,
  subscriptionId: string
): Promise<void> {
  const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    await client
      .api(`/subscriptions/${subscriptionId}`)
      .patch({ expirationDateTime: newExpiration });
  } catch (error) {
    console.error("Error renewing subscription:", error);
    throw error;
  }
}