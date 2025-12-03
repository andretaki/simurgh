import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, rfqDocuments, rfqResponses, governmentOrders, qualitySheets, generatedLabels } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@/lib/aws/s3";

// GET - Get project with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch related documents
    let rfqDocument = null;
    let rfqResponse = null;
    let governmentOrder = null;
    let qualitySheet = null;
    let labels: typeof generatedLabels.$inferSelect[] = [];

    if (project.rfqDocumentId) {
      const [doc] = await db
        .select()
        .from(rfqDocuments)
        .where(eq(rfqDocuments.id, project.rfqDocumentId));

      if (doc) {
        // Generate fresh presigned URL
        let s3Url = doc.s3Url;
        if (doc.s3Key) {
          try {
            s3Url = await getPresignedDownloadUrl(doc.s3Key);
          } catch (e) {
            console.error("Failed to generate presigned URL:", e);
          }
        }
        rfqDocument = { ...doc, s3Url };
      }
    }

    if (project.rfqResponseId) {
      const [resp] = await db
        .select()
        .from(rfqResponses)
        .where(eq(rfqResponses.id, project.rfqResponseId));
      rfqResponse = resp;
    }

    if (project.governmentOrderId) {
      const [order] = await db
        .select()
        .from(governmentOrders)
        .where(eq(governmentOrders.id, project.governmentOrderId));
      governmentOrder = order;

      if (order) {
        const [qs] = await db
          .select()
          .from(qualitySheets)
          .where(eq(qualitySheets.orderId, order.id));
        qualitySheet = qs;

        labels = await db
          .select()
          .from(generatedLabels)
          .where(eq(generatedLabels.orderId, order.id));
      }
    }

    return NextResponse.json({
      project,
      rfqDocument,
      rfqResponse,
      governmentOrder,
      qualitySheet,
      labels,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PUT - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const body = await request.json();

    const [updated] = await db
      .update(projects)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);

    await db.delete(projects).where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
