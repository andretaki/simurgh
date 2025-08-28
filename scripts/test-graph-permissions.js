#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");

async function testGraphPermissions() {
  console.log("Testing Microsoft Graph API Permissions\n");
  console.log("Configuration:");
  console.log("- TENANT_ID:", process.env.TENANT_ID ? "✓ Set" : "✗ Missing");
  console.log("- CLIENT_ID:", process.env.CLIENT_ID ? "✓ Set" : "✗ Missing");
  console.log("- CLIENT_SECRET:", process.env.CLIENT_SECRET ? "✓ Set" : "✗ Missing");
  console.log("- BOSS_EMAIL:", process.env.BOSS_EMAIL || "alliance@alliancechemical.com");
  console.log("- GRAPH_SCOPE:", process.env.GRAPH_SCOPE || "https://graph.microsoft.com/.default");
  console.log("\n");

  try {
    // Create credential
    const credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );

    // Create auth provider
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: [process.env.GRAPH_SCOPE || "https://graph.microsoft.com/.default"],
    });

    // Create client
    const client = Client.initWithMiddleware({ authProvider });

    console.log("Step 1: Testing basic Graph API access...");
    try {
      const me = await client.api('/users').top(1).get();
      console.log("✓ Can access Graph API");
      console.log("  Found", me.value.length, "user(s)");
    } catch (e) {
      console.log("✗ Cannot access Graph API:", e.message);
      console.log("  You may need to grant User.Read.All permission to your app");
    }

    console.log("\nStep 2: Testing access to specific user...");
    const targetEmail = process.env.BOSS_EMAIL || "alliance@alliancechemical.com";
    try {
      const user = await client
        .api(`/users/${targetEmail}`)
        .select("id,mail,displayName,userPrincipalName")
        .get();
      console.log("✓ Can access user:", targetEmail);
      console.log("  User ID:", user.id);
      console.log("  Display Name:", user.displayName);
    } catch (e) {
      console.log("✗ Cannot access user:", targetEmail);
      console.log("  Error:", e.message);
      console.log("\nPossible solutions:");
      console.log("  1. Make sure the email address is correct");
      console.log("  2. Grant 'User.Read.All' permission to your app");
      console.log("  3. Check if the user exists in your Azure AD tenant");
    }

    console.log("\nStep 3: Testing mailbox access...");
    try {
      const messages = await client
        .api(`/users/${targetEmail}/messages`)
        .top(1)
        .get();
      console.log("✓ Can access mailbox for:", targetEmail);
      console.log("  Found", messages.value.length, "message(s)");
    } catch (e) {
      console.log("✗ Cannot access mailbox for:", targetEmail);
      console.log("  Error:", e.message);
      console.log("\nPossible solutions:");
      console.log("  1. Grant 'Mail.Read' permission to your app");
      console.log("  2. Grant 'Mail.ReadWrite' permission if you need to mark emails as read");
      console.log("  3. Make sure the mailbox exists and is accessible");
    }

    console.log("\nStep 4: Testing specific folder access...");
    try {
      const inbox = await client
        .api(`/users/${targetEmail}/mailFolders/inbox`)
        .get();
      console.log("✓ Can access inbox folder");
      console.log("  Total items:", inbox.totalItemCount);
      console.log("  Unread items:", inbox.unreadItemCount);
    } catch (e) {
      console.log("✗ Cannot access inbox folder");
      console.log("  Error:", e.message);
    }

    console.log("\n" + "=".repeat(50));
    console.log("PERMISSION REQUIREMENTS:");
    console.log("=".repeat(50));
    console.log("\nYour Azure AD app registration needs these API permissions:");
    console.log("1. Microsoft Graph > Application permissions:");
    console.log("   - User.Read.All (to read user information)");
    console.log("   - Mail.Read (to read emails)");
    console.log("   - Mail.ReadWrite (to mark emails as read)");
    console.log("\nTo grant these permissions:");
    console.log("1. Go to Azure Portal > Azure Active Directory");
    console.log("2. App registrations > Find your app");
    console.log("3. API permissions > Add permission > Microsoft Graph");
    console.log("4. Application permissions > Select the permissions above");
    console.log("5. Grant admin consent for your organization");

  } catch (error) {
    console.error("\nFatal error:", error.message);
    console.error("\nMake sure your Azure AD app registration is configured correctly.");
  }
}

testGraphPermissions().catch(console.error);