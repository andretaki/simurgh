import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { CompanyProfileSchema } from "@/lib/validations/company-profile";
import { z } from "zod";

// GET - Fetch the company profile (assuming single company for now)
export async function GET() {
  try {
    // Try to fetch profiles, handle if table doesn't exist
    try {

      const profiles = await db.select().from(companyProfiles).limit(1);
    
      if (profiles.length === 0) {
        return NextResponse.json(null, { status: 404 });
      }
      
      return NextResponse.json(profiles[0]);
    } catch (innerError) {
      // Table doesn't exist yet
      console.log("Company profiles table does not exist yet");
      return NextResponse.json(null, { status: 404 });
    }
  } catch (error) {
    console.error("Error fetching company profile:", error);
    // Return 404 if table doesn't exist yet
    if (error instanceof Error && error.message.includes("does not exist")) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to fetch company profile" },
      { status: 500 }
    );
  }
}

// POST - Create a new company profile
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = CompanyProfileSchema.parse(body);
    
    // The table will be created by Drizzle migrations
    // Just proceed with the insert
    
    // Check if a profile already exists
    const existingProfiles = await db.select().from(companyProfiles).limit(1);
    
    if (existingProfiles.length > 0) {
      return NextResponse.json(
        { error: "Company profile already exists. Use PUT to update." },
        { status: 400 }
      );
    }
    
    const [newProfile] = await db.insert(companyProfiles).values({
      companyName: validatedData.companyName,
      cageCode: validatedData.cageCode || null,
      samUei: validatedData.samUei || null,
      samRegistered: validatedData.samRegistered,
      naicsCode: validatedData.naicsCode || null,
      naicsSize: validatedData.naicsSize || null,
      employeeCount: validatedData.employeeCount || null,
      businessType: validatedData.businessType || null,
      smallDisadvantaged: validatedData.smallDisadvantaged,
      womanOwned: validatedData.womanOwned,
      veteranOwned: validatedData.veteranOwned,
      serviceDisabledVetOwned: validatedData.serviceDisabledVetOwned,
      hubZone: validatedData.hubZone,
      historicallyUnderutilized: validatedData.historicallyUnderutilized,
      alaskaNativeCorp: validatedData.alaskaNativeCorp,
      defaultPaymentTerms: validatedData.defaultPaymentTerms || null,
      defaultPaymentTermsOther: validatedData.defaultPaymentTermsOther || null,
      defaultFob: validatedData.defaultFob || null,
      defaultPurchaseOrderMin: validatedData.defaultPurchaseOrderMin || null,
      noFreightAdder: validatedData.noFreightAdder,
      defaultPpaByVendor: validatedData.defaultPpaByVendor,
      countryOfOrigin: validatedData.countryOfOrigin || 'USA',
      contactPerson: validatedData.contactPerson || null,
      contactEmail: validatedData.contactEmail || null,
      contactPhone: validatedData.contactPhone || null,
      address: validatedData.address || null,
    }).returning();
    
    return NextResponse.json(newProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating company profile:", error);
    return NextResponse.json(
      { error: "Failed to create company profile" },
      { status: 500 }
    );
  }
}

// PUT - Update the existing company profile
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    // Ensure we have an ID to update
    if (!body.id) {
      return NextResponse.json(
        { error: "Profile ID is required for update" },
        { status: 400 }
      );
    }
    
    // Validate input (excluding id from validation)
    const { id, ...dataToValidate } = body;
    const validatedData = CompanyProfileSchema.parse(dataToValidate);
    
    const [updatedProfile] = await db
      .update(companyProfiles)
      .set({
        companyName: validatedData.companyName,
        cageCode: validatedData.cageCode || null,
        samUei: validatedData.samUei || null,
        samRegistered: validatedData.samRegistered,
        naicsCode: validatedData.naicsCode || null,
        naicsSize: validatedData.naicsSize || null,
        employeeCount: validatedData.employeeCount || null,
        businessType: validatedData.businessType || null,
        smallDisadvantaged: validatedData.smallDisadvantaged,
        womanOwned: validatedData.womanOwned,
        veteranOwned: validatedData.veteranOwned,
        serviceDisabledVetOwned: validatedData.serviceDisabledVetOwned,
        hubZone: validatedData.hubZone,
        historicallyUnderutilized: validatedData.historicallyUnderutilized,
        alaskaNativeCorp: validatedData.alaskaNativeCorp,
        defaultPaymentTerms: validatedData.defaultPaymentTerms || null,
        defaultPaymentTermsOther: validatedData.defaultPaymentTermsOther || null,
        defaultFob: validatedData.defaultFob || null,
        defaultPurchaseOrderMin: validatedData.defaultPurchaseOrderMin || null,
        noFreightAdder: validatedData.noFreightAdder,
        defaultPpaByVendor: validatedData.defaultPpaByVendor,
        countryOfOrigin: validatedData.countryOfOrigin || 'USA',
        contactPerson: validatedData.contactPerson || null,
        contactEmail: validatedData.contactEmail || null,
        contactPhone: validatedData.contactPhone || null,
        address: validatedData.address || null,
        updatedAt: new Date(),
      })
      .where(eq(companyProfiles.id, id))
      .returning();
    
    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating company profile:", error);
    return NextResponse.json(
      { error: "Failed to update company profile" },
      { status: 500 }
    );
  }
}