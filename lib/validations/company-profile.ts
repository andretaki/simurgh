import { z } from "zod";

export const CompanyProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  cageCode: z.string().max(50).optional().nullable(),
  dunsNumber: z.string().max(50).optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  pocName: z.string().max(255).optional().nullable(),
  pocTitle: z.string().max(255).optional().nullable(),
  pocEmail: z.string().email().max(255).optional().nullable(),
  pocPhone: z.string().max(50).optional().nullable(),
  
  // Certifications
  smallBusiness: z.boolean().default(false),
  womanOwned: z.boolean().default(false),
  veteranOwned: z.boolean().default(false),
  hubZone: z.boolean().default(false),
  eightA: z.boolean().default(false),
  
  // Business Details
  naicsCode: z.string().max(50).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  
  // Payment & Terms
  paymentTerms: z.string().max(100).optional().nullable(),
  shippingTerms: z.string().max(100).optional().nullable(),
  
  // Additional Info
  websiteUrl: z.string().url().max(255).optional().nullable(),
  capabilities: z.string().optional().nullable(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;