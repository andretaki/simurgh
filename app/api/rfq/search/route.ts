import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { and, or, like, gte, lte, eq, desc, asc, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      filters = {},
      sort = { field: "createdAt", order: "desc" },
      pagination = { page: 1, limit: 20 },
      includeExtractedFields = false,
    } = body;

    // Build where conditions
    const conditions = [];
    
    // Always exclude checkpoint entries
    conditions.push(sql`${rfqDocuments.fileName} != 'email_ingestion_checkpoint'`);

    // Text search across multiple fields
    if (query) {
      conditions.push(
        or(
          like(rfqDocuments.fileName, `%${query}%`),
          like(rfqDocuments.rfqNumber, `%${query}%`),
          like(rfqDocuments.contractingOffice, `%${query}%`),
          sql`${rfqDocuments.extractedText} ILIKE '%${query}%'`
        )
      );
    }

    // Status filter
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(
          or(...filters.status.map((s: string) => eq(rfqDocuments.status, s)))
        );
      } else {
        conditions.push(eq(rfqDocuments.status, filters.status));
      }
    }

    // Date range filters
    if (filters.dateRange) {
      if (filters.dateRange.from) {
        conditions.push(gte(rfqDocuments.createdAt, new Date(filters.dateRange.from)));
      }
      if (filters.dateRange.to) {
        conditions.push(lte(rfqDocuments.createdAt, new Date(filters.dateRange.to)));
      }
    }

    // Due date filters
    if (filters.dueDate) {
      if (filters.dueDate.from) {
        conditions.push(gte(rfqDocuments.dueDate, new Date(filters.dueDate.from)));
      }
      if (filters.dueDate.to) {
        conditions.push(lte(rfqDocuments.dueDate, new Date(filters.dueDate.to)));
      }
    }

    // Contracting office filter
    if (filters.contractingOffice) {
      if (Array.isArray(filters.contractingOffice)) {
        conditions.push(
          or(...filters.contractingOffice.map((office: string) => 
            like(rfqDocuments.contractingOffice, `%${office}%`)
          ))
        );
      } else {
        conditions.push(like(rfqDocuments.contractingOffice, `%${filters.contractingOffice}%`));
      }
    }

    // Advanced filters on extracted fields
    if (filters.extractedFields) {
      Object.entries(filters.extractedFields).forEach(([key, value]) => {
        conditions.push(
          sql`${rfqDocuments.extractedFields}->>'${key}' = ${value}`
        );
      });
    }

    // Confidence threshold filter
    if (filters.minConfidence) {
      conditions.push(
        sql`
          (SELECT AVG((confidence->>'confidence')::float) 
           FROM jsonb_each(${rfqDocuments.extractedFields}->'fields') AS field(key, confidence)
           WHERE confidence->>'confidence' IS NOT NULL) >= ${filters.minConfidence}
        `
      );
    }

    // Build the query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort order
    const sortFieldMap: Record<string, any> = {
      createdAt: rfqDocuments.createdAt,
      dueDate: rfqDocuments.dueDate,
      fileName: rfqDocuments.fileName,
      rfqNumber: rfqDocuments.rfqNumber,
      status: rfqDocuments.status,
    };
    
    const orderByColumn = sortFieldMap[sort.field] || rfqDocuments.createdAt;
    const orderDirection = sort.order === "asc" ? asc : desc;

    // Execute main query
    const offset = (pagination.page - 1) * pagination.limit;
    
    const [results, totalCountResult] = await Promise.all([
      db
        .select({
          id: rfqDocuments.id,
          fileName: rfqDocuments.fileName,
          rfqNumber: rfqDocuments.rfqNumber,
          dueDate: rfqDocuments.dueDate,
          contractingOffice: rfqDocuments.contractingOffice,
          status: rfqDocuments.status,
          createdAt: rfqDocuments.createdAt,
          updatedAt: rfqDocuments.updatedAt,
          s3Key: rfqDocuments.s3Key,
          extractedFields: includeExtractedFields ? rfqDocuments.extractedFields : sql`NULL`,
          hasResponse: sql<boolean>`EXISTS (
            SELECT 1 FROM ${rfqResponses} 
            WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
          )`,
        })
        .from(rfqDocuments)
        .where(whereClause)
        .orderBy(orderDirection(orderByColumn))
        .limit(pagination.limit)
        .offset(offset),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(rfqDocuments)
        .where(whereClause)
    ]);

    const totalCount = Number(totalCountResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / pagination.limit);

    // Calculate analytics
    const analytics = {
      avgConfidence: 0,
      documentTypes: {} as Record<string, number>,
      statusBreakdown: {} as Record<string, number>,
    };

    if (results.length > 0) {
      // Get status breakdown
      results.forEach(r => {
        const status = r.status || 'unknown';
        analytics.statusBreakdown[status] = (analytics.statusBreakdown[status] || 0) + 1;
      });

      // Calculate average confidence if extracted fields included
      if (includeExtractedFields) {
        let totalConfidence = 0;
        let confidenceCount = 0;

        results.forEach(r => {
          if (r.extractedFields && typeof r.extractedFields === 'object') {
            const fields = (r.extractedFields as any).fields || {};
            Object.values(fields).forEach((field: any) => {
              if (field.confidence) {
                totalConfidence += field.confidence;
                confidenceCount++;
              }
            });

            // Count document types
            const docType = (r.extractedFields as any).documentType || 'Unknown';
            analytics.documentTypes[docType] = (analytics.documentTypes[docType] || 0) + 1;
          }
        });

        analytics.avgConfidence = confidenceCount > 0 
          ? Math.round(totalConfidence / confidenceCount) 
          : 0;
      }
    }

    // Get facets for filtering
    const [contractingOffices, statuses] = await Promise.all([
      db
        .selectDistinct({ office: rfqDocuments.contractingOffice })
        .from(rfqDocuments)
        .where(sql`${rfqDocuments.contractingOffice} IS NOT NULL`)
        .limit(20),
      
      db
        .selectDistinct({ status: rfqDocuments.status })
        .from(rfqDocuments)
    ]);

    return NextResponse.json({
      results,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalPages,
        totalCount,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
      facets: {
        contractingOffices: contractingOffices.map(o => o.office).filter(Boolean),
        statuses: statuses.map(s => s.status).filter(Boolean),
      },
      analytics,
      query: {
        searchTerm: query,
        filters,
        sort,
      },
    });

  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search RFQs" },
      { status: 500 }
    );
  }
}