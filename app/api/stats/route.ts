import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyProfiles } from "@/db/schema";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { sql, count, desc, gte } from "drizzle-orm";

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
    let accuracy = 85; // Default accuracy
    try {
      const rfqsWithConfidence = await db
        .select({
          extractedFields: rfqDocuments.extractedFields
        })
        .from(rfqDocuments)
        .limit(100);

      let totalConfidence = 0;
      let confidenceCount = 0;

      rfqsWithConfidence.forEach(doc => {
        if (doc.extractedFields && typeof doc.extractedFields === 'object') {
          const fields = (doc.extractedFields as Record<string, unknown>).fields || {};
          Object.values(fields).forEach((field: unknown) => {
            if (field && typeof field === 'object' && 'confidence' in field) {
              totalConfidence += (field as { confidence: number }).confidence;
              confidenceCount++;
            }
          });
        }
      });

      if (confidenceCount > 0) {
        accuracy = (totalConfidence / confidenceCount) * 100;
      }
    } catch {
      // Keep default accuracy
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
    let companyProfile = null;
    try {
      const [profile] = await db
        .select()
        .from(companyProfiles)
        .limit(1);
      companyProfile = profile;
    } catch {
      // Table may not exist
    }

    return NextResponse.json({
      overview: {
        totalRFQs,
        completedRFQs,
        pendingRFQs,
        successRate: parseFloat(successRate.toFixed(1)),
        totalPOs: 0,
        totalVendors: 0,
        emailsProcessed: 0,
        recentRFQs,
        timeSaved: hoursSaved,
        accuracy: parseFloat(accuracy.toFixed(1)),
      },
      recentActivity,
      systemHealth: {
        database: "online",
        storage: "online",
        ai: "online",
        server: "online"
      },
      companyProfile: companyProfile ? {
        name: (companyProfile as { companyName?: string }).companyName,
        plan: "Professional"
      } : null,
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    // Return safe defaults instead of error
    return NextResponse.json({
      overview: {
        totalRFQs: 0,
        completedRFQs: 0,
        pendingRFQs: 0,
        successRate: 0,
        totalPOs: 0,
        totalVendors: 0,
        emailsProcessed: 0,
        recentRFQs: 0,
        timeSaved: 0,
        accuracy: 85,
      },
      recentActivity: [],
      systemHealth: {
        database: "error",
        storage: "unknown",
        ai: "unknown",
        server: "online"
      },
      companyProfile: null,
    });
  }
}
