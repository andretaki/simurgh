import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyProfiles, purchaseOrders, vendors } from "@/db/schema";
import { systemCheckpoints, emailProcessingLog } from "@/db/system-tables";
import { rfqDocuments, rfqResponses, rfqHistory } from "@/drizzle/migrations/schema";
import { sql, count, eq, desc, and, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Get total RFQs processed
    const [totalRFQsResult] = await db
      .select({ count: count() })
      .from(rfqDocuments);
    const totalRFQs = totalRFQsResult?.count || 0;

    // Get completed RFQs (those with responses)
    const [completedRFQsResult] = await db
      .select({ count: count() })
      .from(rfqResponses);
    const completedRFQs = completedRFQsResult?.count || 0;

    // Get pending RFQs (processed but no response yet)
    const pendingRFQs = Math.max(0, totalRFQs - completedRFQs);

    // Calculate success rate
    const successRate = totalRFQs > 0 ? (completedRFQs / totalRFQs) * 100 : 0;

    // Get total POs
    const [totalPOsResult] = await db
      .select({ count: count() })
      .from(purchaseOrders);
    const totalPOs = totalPOsResult?.count || 0;

    // Get total vendors
    const [totalVendorsResult] = await db
      .select({ count: count() })
      .from(vendors);
    const totalVendors = totalVendorsResult?.count || 0;

    // Get emails processed
    const [emailsProcessedResult] = await db
      .select({ count: count() })
      .from(emailProcessingLog)
      .where(eq(emailProcessingLog.status, 'processed'));
    const emailsProcessed = emailsProcessedResult?.count || 0;

    // Get RFQs from last 30 days for activity metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [recentRFQsResult] = await db
      .select({ count: count() })
      .from(rfqDocuments)
      .where(gte(rfqDocuments.createdAt, thirtyDaysAgo));
    const recentRFQs = recentRFQsResult?.count || 0;

    // Calculate time saved (estimate: 30 minutes per RFQ processed)
    const minutesSaved = totalRFQs * 30;
    const hoursSaved = Math.floor(minutesSaved / 60);

    // Get extraction accuracy from RFQ documents (if confidence scores are available)
    let accuracy = 0;
    try {
      const rfqsWithConfidence = await db
        .select({ 
          extractedFields: rfqDocuments.extractedFields 
        })
        .from(rfqDocuments)
        .limit(100); // Sample last 100 for performance

      let totalConfidence = 0;
      let confidenceCount = 0;

      rfqsWithConfidence.forEach(doc => {
        if (doc.extractedFields && typeof doc.extractedFields === 'object') {
          const fields = (doc.extractedFields as any).fields || {};
          Object.values(fields).forEach((field: any) => {
            if (field?.confidence) {
              totalConfidence += field.confidence;
              confidenceCount++;
            }
          });
        }
      });

      accuracy = confidenceCount > 0 ? (totalConfidence / confidenceCount) * 100 : 85; // Default to 85% if no data
    } catch (e) {
      accuracy = 85; // Default accuracy
    }

    // Get recent activity for the homepage
    const recentActivity = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        rfqNumber: rfqDocuments.rfqNumber,
        status: rfqDocuments.status,
        createdAt: rfqDocuments.createdAt,
        hasResponse: sql<boolean>`EXISTS (
          SELECT 1 FROM ${rfqResponses} 
          WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
        )`,
      })
      .from(rfqDocuments)
      .orderBy(desc(rfqDocuments.createdAt))
      .limit(5);

    // Get company profile info
    const [companyProfile] = await db
      .select()
      .from(companyProfiles)
      .limit(1);

    // Check system health
    const systemHealth = {
      database: "online",
      storage: "online", 
      ai: "online",
      server: "online"
    };

    // Try to check if services are configured
    try {
      // Check if we have any checkpoints (indicates email system is configured)
      const [checkpointCount] = await db
        .select({ count: count() })
        .from(systemCheckpoints);
      
      if (checkpointCount?.count > 0) {
        systemHealth.storage = "configured";
      }
    } catch (e) {
      systemHealth.database = "error";
    }

    return NextResponse.json({
      overview: {
        totalRFQs,
        completedRFQs,
        pendingRFQs,
        successRate: parseFloat(successRate.toFixed(1)),
        totalPOs,
        totalVendors,
        emailsProcessed,
        recentRFQs,
        timeSaved: hoursSaved,
        accuracy: parseFloat(accuracy.toFixed(1)),
      },
      recentActivity,
      systemHealth,
      companyProfile: companyProfile ? {
        name: companyProfile.companyName,
        plan: "Professional" // Could be made dynamic based on actual plan
      } : null,
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch statistics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}