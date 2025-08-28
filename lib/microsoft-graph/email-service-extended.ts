import { Client } from "@microsoft/microsoft-graph-client";
import { Message, FileAttachment } from "@microsoft/microsoft-graph-types";
import { createGraphClient, getMonitoredUserId } from "./auth";
import { EMAIL_CONFIG } from "./config";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { eq, and, isNotNull } from "drizzle-orm";

/**
 * Fetches emails from a specific date range, regardless of read status
 * @param daysBack - Number of days to look back (default 14)
 * @param includeRead - Whether to include already read emails (default true)
 */
export async function fetchEmailsFromDateRange(
  client: Client,
  userId: string,
  daysBack: number = 14,
  includeRead: boolean = true,
  limit: number = 50
): Promise<Message[]> {
  try {
    // Calculate the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const isoStartDate = startDate.toISOString();

    // Simplify filter - remove date filter and orderby to avoid "InefficientFilter" error
    // We'll filter dates manually after fetching
    let filter = `from/emailAddress/address eq '${EMAIL_CONFIG.RFQ_SENDER_EMAIL}'`;
    
    if (!includeRead) {
      filter += ` and isRead eq false`;
    }

    console.log(`Fetching emails from past ${daysBack} days, includeRead: ${includeRead}`);
    console.log(`Filter: ${filter}`);

    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .filter(filter)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,body,isRead,conversationId")
      .top(limit * 2) // Get more to account for date filtering
      .get();

    // Manually filter by date and sort
    const filteredMessages = (messages.value || [])
      .filter((msg: Message) => {
        // Handle nullable receivedDateTime
        if (!msg.receivedDateTime) return false;
        const msgDate = new Date(msg.receivedDateTime);
        return msgDate >= startDate;
      })
      .sort((a: Message, b: Message) => {
        // Handle nullable receivedDateTime in sort
        const aTime = a.receivedDateTime ? new Date(a.receivedDateTime).getTime() : 0;
        const bTime = b.receivedDateTime ? new Date(b.receivedDateTime).getTime() : 0;
        return aTime - bTime;
      })
      .slice(0, limit);
    
    console.log(`Found ${filteredMessages.length} emails from ${EMAIL_CONFIG.RFQ_SENDER_EMAIL} after date filtering`);
    
    return filteredMessages;
  } catch (error) {
    console.error("Error fetching emails from date range:", error);
    throw error;
  }
}

/**
 * Checks if an email has already been processed by looking for its ID in the database
 */
export async function isEmailAlreadyProcessed(
  emailId: string,
  emailSubject: string,
  receivedDateTime: string
): Promise<boolean> {
  try {
    // Check if we already have this email in the database
    // Using multiple fields to ensure we don't miss it
    const existing = await db
      .select({ id: rfqDocuments.id })
      .from(rfqDocuments)
      .where(
        and(
          isNotNull(rfqDocuments.extractedFields),
        )
      )
      .limit(1);

    // Check extractedFields JSON for email metadata
    for (const record of existing) {
      const fields = record as any;
      if (fields?.extractedFields?.emailId === emailId) {
        return true;
      }
      if (fields?.extractedFields?.emailSubject === emailSubject && 
          fields?.extractedFields?.emailReceivedAt === receivedDateTime) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking if email processed:", error);
    return false;
  }
}

/**
 * Get statistics about emails in the date range
 */
export async function getEmailIngestionStats(daysBack: number = 14): Promise<{
  totalEmails: number;
  unreadEmails: number;
  readEmails: number;
  withAttachments: number;
  alreadyProcessed: number;
  toProcess: number;
}> {
  try {
    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);
    
    // Fetch all emails in range
    const allEmails = await fetchEmailsFromDateRange(client, userId, daysBack, true, 100);
    
    const stats = {
      totalEmails: allEmails.length,
      unreadEmails: 0,
      readEmails: 0,
      withAttachments: 0,
      alreadyProcessed: 0,
      toProcess: 0,
    };

    for (const email of allEmails) {
      if (!email.isRead) stats.unreadEmails++;
      else stats.readEmails++;
      
      if (email.hasAttachments) {
        stats.withAttachments++;
        
        // Check if already processed
        const processed = await isEmailAlreadyProcessed(
          email.id!,
          email.subject || "",
          email.receivedDateTime || ""
        );
        
        if (processed) {
          stats.alreadyProcessed++;
        } else {
          stats.toProcess++;
        }
      }
    }

    return stats;
  } catch (error) {
    console.error("Error getting email stats:", error);
    throw error;
  }
}