// Company Profile Service for Alliance Chemicals
import profileData from '@/data/alliance-chemical-profile.json';

export interface CompanyProfile {
  companyName: string;
  vendorCode: string;
  cageCode: string;
  samUei?: string;
  samRegistered: boolean;
  naicsCode: string;
  naicsSize: string;
  businessType: string;
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
  historicallyUnderutilized: boolean;
  alaskaNativeCorp: boolean;
  defaultPaymentTerms: string;
  defaultPaymentTermsOther?: string;
  defaultFob: string;
  defaultPurchaseOrderMin?: string;
  defaultComplimentaryFreight: boolean;
  defaultPpaByVendor: boolean;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  contactFax?: string;
  address: string;
  taxExemptions?: Record<string, string>;
}

export interface RFQAutoFillData {
  // Vendor Information
  vendorName: string;
  vendorCode: string;
  cageCode: string;
  samUei?: string;
  
  // Contact Information
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactFax?: string;
  vendorAddress: string;
  
  // Business Classifications
  businessType: string;
  naicsCode: string;
  certifications: string[];
  
  // Terms & Conditions
  paymentTerms: string;
  fobTerms: string;
  minimumOrder?: string;
  
  // Additional Fields
  taxExemptionNumber?: string;
  deliveryTerms?: string;
}

class CompanyProfileService {
  private profile: CompanyProfile;

  constructor() {
    this.profile = profileData.companyProfile as CompanyProfile;
  }

  /**
   * Get the full company profile
   */
  getProfile(): CompanyProfile {
    return this.profile;
  }

  /**
   * Get auto-fill data for RFQ responses
   */
  getAutoFillData(state?: string): RFQAutoFillData {
    const certifications: string[] = [];
    
    // Build certifications list
    if (this.profile.smallDisadvantaged) certifications.push("Small Disadvantaged Business");
    if (this.profile.womanOwned) certifications.push("Woman-Owned Business");
    if (this.profile.veteranOwned) certifications.push("Veteran-Owned Business");
    if (this.profile.serviceDisabledVetOwned) certifications.push("Service-Disabled Veteran-Owned");
    if (this.profile.hubZone) certifications.push("HUBZone Business");
    if (this.profile.historicallyUnderutilized) certifications.push("Historically Underutilized Business");
    if (this.profile.alaskaNativeCorp) certifications.push("Alaska Native Corporation");
    
    // If no certifications, add business type
    if (certifications.length === 0) {
      certifications.push(`${this.profile.businessType} Business`);
    }

    return {
      // Vendor Information
      vendorName: this.profile.companyName,
      vendorCode: this.profile.vendorCode,
      cageCode: this.profile.cageCode,
      samUei: this.profile.samUei,
      
      // Contact Information
      contactName: this.profile.contactPerson,
      contactEmail: this.profile.contactEmail,
      contactPhone: this.profile.contactPhone,
      contactFax: this.profile.contactFax,
      vendorAddress: this.profile.address,
      
      // Business Classifications
      businessType: this.profile.businessType,
      naicsCode: this.profile.naicsCode,
      certifications,
      
      // Terms & Conditions
      paymentTerms: this.profile.defaultPaymentTerms,
      fobTerms: this.profile.defaultFob,
      minimumOrder: this.profile.defaultPurchaseOrderMin,
      
      // Additional Fields
      taxExemptionNumber: state && this.profile.taxExemptions ? 
        this.profile.taxExemptions[state] : undefined,
      deliveryTerms: this.profile.defaultComplimentaryFreight ? 
        "Complimentary Freight Available" : "Standard Freight Terms",
    };
  }

  /**
   * Update company profile
   */
  async updateProfile(updates: Partial<CompanyProfile>): Promise<void> {
    this.profile = { ...this.profile, ...updates };
    // In production, this would save to database
    console.log("Profile updated:", this.profile);
  }

  /**
   * Format profile for display
   */
  formatForDisplay(): string {
    return `
${this.profile.companyName}
${this.profile.address}

Contact: ${this.profile.contactPerson}
Phone: ${this.profile.contactPhone}
Email: ${this.profile.contactEmail}

CAGE Code: ${this.profile.cageCode}
NAICS: ${this.profile.naicsCode}
Business Type: ${this.profile.businessType}
    `.trim();
  }

  /**
   * Check if profile is complete
   */
  isProfileComplete(): boolean {
    const requiredFields = [
      'companyName',
      'contactPerson',
      'contactEmail',
      'contactPhone',
      'address',
      'cageCode',
    ];

    return requiredFields.every(field => 
      this.profile[field as keyof CompanyProfile]
    );
  }
}

// Export singleton instance
export const companyProfileService = new CompanyProfileService();

// Export default for easy import
export default companyProfileService;