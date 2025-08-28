/// <reference types="@types/pg" />

// Add this check to prevent client-side execution
if (typeof window !== "undefined") {
  throw new Error(
    "Database connection should not be initialized on the client side",
  );
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/migrations/schema";

// During build time, we don't need a real database connection
// Check if we're in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;

if (!process.env.DATABASE_URL && !isBuildTime) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Use environment variable for database connection or a dummy URL during build
const connectionString = process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy';

// Create connection with schema search path
const client = postgres(connectionString, {
  prepare: false,
  onnotice: () => {}, // Suppress notices
});

// Set the search path to use our schema
const db = drizzle(client, { 
  schema,
  logger: false 
});

export { db };

// This function can be used to end the pool when your application is shutting down
export async function closeDbConnection() {
  await client.end();
}
