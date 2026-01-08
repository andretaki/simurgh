import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/drizzle/migrations/schema";
import { desc } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - List all projects
export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    return apiSuccess({ projects: allProjects });
  } catch (error: unknown) {
    logger.error("Error fetching projects", error);
    return apiError("Failed to fetch projects", 500);
  }
}

// POST - Create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const [newProject] = await db
      .insert(projects)
      .values({
        name: body.name || "New Project",
        description: body.description,
        customerName: body.customerName,
        contractingOffice: body.contractingOffice,
        status: "rfq_received",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return apiSuccess({ project: newProject });
  } catch (error: unknown) {
    logger.error("Error creating project", error);
    return apiError("Failed to create project", 500);
  }
}
