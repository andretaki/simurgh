import { db } from "@/lib/db";
import { companyProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

async function setupAllianceChemicalProfile() {
  try {
    // Check if profile already exists
    const existing = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyName, "Alliance Chemicals"))
      .limit(1);

    if (existing.length > 0) {
      console.log("Profile already exists, updating...");
    }

    const profileData = {
      // Basic Company Information
      companyName: "Alliance Chemicals",
      cageCode: "ALL510", // Using vendor code from PO as CAGE code
      
      // Contact Information
      contactPerson: "Hossein Taki",
      contactEmail: "alliance@alliancechemical.com",
      contactPhone: "512-365-6838",
      address: "204 S Edmond St, Taylor, TX 76574-0721",
      
      // Business Classifications
      naicsCode: "424690",
      naicsSize: "175", // Size standard from PO
      businessType: "Small", // Based on size standard
      
      // Default Terms
      defaultPaymentTerms: "Net 30",
      defaultFob: "Shipping Point",
      
      // Certifications (to be confirmed)
      samRegistered: false, // To be updated when confirmed
      smallDisadvantaged: false,
      womanOwned: false,
      veteranOwned: false,
      serviceDisabledVetOwned: false,
      hubZone: false,
      historicallyUnderutilized: false,
      alaskaNativeCorp: false,
      
      // Additional defaults
      defaultComplimentaryFreight: false,
      defaultPpaByVendor: false,
    };

    if (existing.length > 0) {
      // Update existing profile
      await db
        .update(companyProfiles)
        .set(profileData)
        .where(eq(companyProfiles.id, existing[0].id));
      
      console.log("✅ Alliance Chemicals profile updated successfully!");
    } else {
      // Insert new profile
      await db.insert(companyProfiles).values(profileData);
      console.log("✅ Alliance Chemicals profile created successfully!");
    }

    console.log("\n📋 Company Profile Summary:");
    console.log("================================");
    console.log(`Company: ${profileData.companyName}`);
    console.log(`CAGE Code: ${profileData.cageCode}`);
    console.log(`Contact: ${profileData.contactPerson}`);
    console.log(`Email: ${profileData.contactEmail}`);
    console.log(`Phone: ${profileData.contactPhone}`);
    console.log(`Address: ${profileData.address}`);
    console.log(`NAICS: ${profileData.naicsCode}`);
    console.log(`Payment Terms: ${profileData.defaultPaymentTerms}`);
    console.log(`FOB: ${profileData.defaultFob}`);
    console.log("================================\n");

    console.log("✨ Profile is ready to auto-fill RFQ responses!");

  } catch (error) {
    console.error("Error setting up company profile:", error);
    process.exit(1);
  }
}

// Run the setup
setupAllianceChemicalProfile();