import { Resend } from 'resend';

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface RFQNotificationData {
  rfqNumber?: string | null;
  title?: string | null;
  dueDate?: Date | null;
  contractingOffice?: string | null;
  fileName: string;
  emailSubject?: string;
  rfqId: number;
}

export async function sendRFQNotification(data: RFQNotificationData) {
  // Skip if no API key configured or resend not initialized
  if (!process.env.RESEND_API_KEY || !resend) {
    console.log('Resend API key not configured, skipping email notification');
    console.log('Would send notification for RFQ:', {
      rfqNumber: data.rfqNumber,
      fileName: data.fileName,
      rfqId: data.rfqId
    });
    return;
  }

  const notificationEmail = process.env.NOTIFICATION_EMAIL || 'andre@alliancechemical.com';
  
  try {
    const emailContent = `
      <h2>New RFQ Processed</h2>
      <p>A new RFQ has been successfully ingested and processed.</p>
      
      <h3>RFQ Details:</h3>
      <ul>
        ${data.rfqNumber ? `<li><strong>RFQ Number:</strong> ${data.rfqNumber}</li>` : ''}
        ${data.title ? `<li><strong>Title:</strong> ${data.title}</li>` : ''}
        ${data.dueDate ? `<li><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</li>` : ''}
        ${data.contractingOffice ? `<li><strong>Contracting Office:</strong> ${data.contractingOffice}</li>` : ''}
        <li><strong>File Name:</strong> ${data.fileName}</li>
        ${data.emailSubject ? `<li><strong>Email Subject:</strong> ${data.emailSubject}</li>` : ''}
        <li><strong>RFQ ID:</strong> ${data.rfqId}</li>
      </ul>
      
      <p>You can view and manage this RFQ in the Simurgh application.</p>
    `;

    const result = await resend.emails.send({
      from: 'Simurgh RFQ System <rfq@notifications.alliancechemical.com>',
      to: notificationEmail,
      subject: `New RFQ Processed: ${data.rfqNumber || data.fileName}`,
      html: emailContent,
    });

    console.log(`RFQ notification sent to ${notificationEmail}`, result);
    return result;
  } catch (error) {
    console.error('Failed to send RFQ notification:', error);
    // Don't throw - we don't want email failures to break the ingestion process
  }
}