import { z } from "zod";

export const CompanyProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  cageCode: z.string().max(50).optional().nullable(),
  samUei: z.string().max(50).optional().nullable(),
  samRegistered: z.boolean().default(false),
  naicsCode: z.string().max(50).optional().nullable(),
  naicsSize: z.string().max(100).optional().nullable(),
  employeeCount: z.string().max(50).optional().nullable(),
  businessType: z.string().max(50).optional().nullable(),

  // Certifications
  smallDisadvantaged: z.boolean().default(false),
  womanOwned: z.boolean().default(false),
  veteranOwned: z.boolean().default(false),
  serviceDisabledVetOwned: z.boolean().default(false),
  hubZone: z.boolean().default(false),
  historicallyUnderutilized: z.boolean().default(false),
  alaskaNativeCorp: z.boolean().default(false),

  // Payment & Terms
  defaultPaymentTerms: z.string().max(100).optional().nullable(),
  defaultPaymentTermsOther: z.string().max(255).optional().nullable(),
  defaultFob: z.string().max(50).optional().nullable(),
  defaultPurchaseOrderMin: z.string().max(50).optional().nullable(),
  noFreightAdder: z.boolean().default(true),
  defaultPpaByVendor: z.boolean().default(false),
  countryOfOrigin: z.string().max(50).optional().nullable(),

  // Contact Info
  contactPerson: z.string().max(255).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;