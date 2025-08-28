import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import "isomorphic-fetch";

// Azure AD App Registration credentials from environment
const TENANT_ID = process.env.TENANT_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const GRAPH_SCOPE = process.env.GRAPH_SCOPE || "https://graph.microsoft.com/.default";

// Email account to monitor
const MONITORED_EMAIL = process.env.BOSS_EMAIL || "alliance@alliancechemical.com";

/**
 * Creates an authenticated Microsoft Graph client
 */
export function createGraphClient(): Client {
  // Create credential using client secret
  const credential = new ClientSecretCredential(
    TENANT_ID,
    CLIENT_ID,
    CLIENT_SECRET
  );

  // Create authentication provider
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: [GRAPH_SCOPE],
  });

  // Create and return Graph client
  return Client.initWithMiddleware({
    authProvider,
  });
}

/**
 * Get the user ID for the monitored email account
 * Falls back to using the email as the user ID if User.Read.All permission is not granted
 */
export async function getMonitoredUserId(client: Client): Promise<string> {
  try {
    const user = await client
      .api(`/users/${MONITORED_EMAIL}`)
      .select("id,mail,displayName")
      .get();
    
    return user.id;
  } catch (error: any) {
    // If we can't read user info but can read mail, use email as the user identifier
    // This works because the Graph API accepts both user ID and UPN for mail operations
    if (error?.statusCode === 403 || error?.code === 'Authorization_RequestDenied') {
      console.log(`Using email address as user identifier for ${MONITORED_EMAIL}`);
      return MONITORED_EMAIL;
    }
    console.error("Error getting user ID:", error);
    throw new Error(`Failed to get user ID for ${MONITORED_EMAIL}`);
  }
}

export { MONITORED_EMAIL };