// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

// Setup Microsoft Graph client
function createGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.MICROSOFT_TENANT_ID,
    process.env.MICROSOFT_CLIENT_ID,
    process.env.MICROSOFT_CLIENT_SECRET
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });

  return Client.initWithMiddleware({
    authProvider
  });
}

async function testEmailFetch() {
  try {
    console.log('🔍 Testing email fetch...\n');
    
    const client = createGraphClient();
    
    // Get the user ID for the monitored email
    const emailToMonitor = process.env.MONITORED_EMAIL_ADDRESS;
    console.log('📧 Monitoring email:', emailToMonitor);
    console.log('🔎 Looking for emails from:', process.env.RFQ_SENDER_EMAIL || 'noreply@asrcfederal.com');
    
    // Try to get user ID
    let userId = 'me';
    try {
      const users = await client.api('/users')
        .filter(`mail eq '${emailToMonitor}'`)
        .select('id,mail,userPrincipalName')
        .get();
      
      if (users.value && users.value.length > 0) {
        userId = users.value[0].id;
        console.log('✅ Found user ID:', userId);
      }
    } catch (e) {
      console.log('ℹ️  Using "me" as user ID');
    }
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString();
    
    console.log('📅 Fetching emails since:', dateFilter);
    
    // Fetch emails
    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .filter(`receivedDateTime ge ${dateFilter}`)
      .select('id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead')
      .orderby('receivedDateTime desc')
      .top(50)
      .get();
    
    console.log(`\n📊 Found ${messages.value.length} total emails`);
    
    // Filter for RFQ emails
    const expectedSender = (process.env.RFQ_SENDER_EMAIL || 'noreply@asrcfederal.com').toLowerCase();
    const rfqEmails = messages.value.filter(email => {
      const senderEmail = email.from?.emailAddress?.address?.toLowerCase();
      return senderEmail === expectedSender;
    });
    
    console.log(`📨 Found ${rfqEmails.length} emails from RFQ sender`);
    
    // Show details of RFQ emails
    if (rfqEmails.length > 0) {
      console.log('\n📋 RFQ Email Details:');
      rfqEmails.slice(0, 5).forEach((email, i) => {
        console.log(`\n${i + 1}. ${email.subject}`);
        console.log(`   Date: ${new Date(email.receivedDateTime).toLocaleString()}`);
        console.log(`   Has Attachments: ${email.hasAttachments ? '✅' : '❌'}`);
        console.log(`   Read: ${email.isRead ? 'Yes' : 'No'}`);
        if (email.bodyPreview) {
          console.log(`   Preview: ${email.bodyPreview.substring(0, 100)}...`);
        }
      });
      
      // Count attachments
      const emailsWithAttachments = rfqEmails.filter(e => e.hasAttachments);
      console.log(`\n📎 ${emailsWithAttachments.length} emails have attachments`);
    } else {
      console.log('\n❌ No emails found from the specified sender');
      console.log('   Showing recent senders in inbox:');
      
      const senders = new Set();
      messages.value.slice(0, 20).forEach(email => {
        const sender = email.from?.emailAddress?.address;
        if (sender) senders.add(sender);
      });
      
      Array.from(senders).slice(0, 10).forEach(sender => {
        console.log(`   - ${sender}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.statusCode) {
      console.error('   Status:', error.statusCode);
    }
    if (error.code) {
      console.error('   Code:', error.code);
    }
  }
}

// Run the test
testEmailFetch()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });