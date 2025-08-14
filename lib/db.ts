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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Use environment variable for database connection
const connectionString = process.env.DATABASE_URL!;

// Create connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export { db };

// This function can be used to end the pool when your application is shutting down
export async function closeDbConnection() {
  await client.end();
}
