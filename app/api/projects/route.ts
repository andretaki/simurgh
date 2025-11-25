import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/drizzle/migrations/schema";
import { desc } from "drizzle-orm";

// GET - List all projects
export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ projects: [] });
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

    return NextResponse.json({ project: newProject });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
