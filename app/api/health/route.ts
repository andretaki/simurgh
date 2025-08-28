import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

export async function GET() {
  const status = {
    database: "unknown",
    s3: "unknown", 
    openai: "unknown",
    server: "online"
  };

  // Check database connection
  try {
    // Just test connection without requiring specific tables
    await db.execute(sql`SELECT 1`);
    status.database = "online";
  } catch (error) {
    console.error("Database check failed:", error);
    status.database = "error";
  }

  // Check S3 configuration
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
    status.s3 = "configured";
    // Could do a test upload/delete here if we wanted to verify it's actually working
  } else {
    status.s3 = "not configured";
  }

  // Check OpenAI configuration
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Do a minimal API call to verify the key works
      const models = await openai.models.list();
      status.openai = "online";
    } catch (error) {
      console.error("OpenAI check failed:", error);
      status.openai = "error";
    }
  } else {
    status.openai = "not configured";
  }

  return NextResponse.json(status);
}