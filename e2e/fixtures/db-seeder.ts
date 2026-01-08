/**
 * Database Seeder for E2E Tests
 *
 * Creates and cleans up test data in the database.
 * Uses API endpoints to create data (safer than direct DB access in E2E).
 */

import { request } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export interface TestRfqData {
  id?: number;
  fileName: string;
  rfqNumber: string;
  contractingOffice: string;
  dueDate: string;
  extractedFields: {
    rfqSummary: {
      header: {
        rfqNumber: string;
        rfqDate: string;
        requestedReplyDate: string;
        deliveryBeforeDate: string;
      };
      buyer: {
        contractingOffice: string;
        pocName: string;
        pocEmail: string;
        pocPhone: string;
      };
      items: Array<{
        itemNumber: string;
        quantity: number;
        unit: string;
        nsn: string;
        partNumber?: string;
        productType: string;
        shortDescription: string;
      }>;
    };
  };
}

export interface TestCompanyProfile {
  companyName: string;
  cageCode: string;
  samUei: string;
  naicsCode: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  defaultPaymentTerms: string;
  defaultFob: string;
  businessType: string;
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
}

// Default test data
export const DEFAULT_TEST_RFQ: TestRfqData = {
  fileName: `e2e-test-rfq-${Date.now()}.pdf`,
  rfqNumber: `E2E-TEST-${Date.now()}`,
  contractingOffice: 'DLA Troop Support - E2E Test',
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  extractedFields: {
    rfqSummary: {
      header: {
        rfqNumber: `E2E-TEST-${Date.now()}`,
        rfqDate: new Date().toISOString().split('T')[0],
        requestedReplyDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        deliveryBeforeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      buyer: {
        contractingOffice: 'DLA Troop Support - E2E Test',
        pocName: 'E2E Test POC',
        pocEmail: 'e2e-test@dla.mil',
        pocPhone: '555-E2E-TEST',
      },
      items: [
        {
          itemNumber: '0001',
          quantity: 100,
          unit: 'BT',
          nsn: '6810-01-E2E-TEST',
          partNumber: 'E2E-001',
          productType: 'Test Chemical',
          shortDescription: 'E2E Test Item - 1 gallon bottles',
        },
        {
          itemNumber: '0002',
          quantity: 50,
          unit: 'DR',
          nsn: '6810-02-E2E-TEST',
          partNumber: 'E2E-002',
          productType: 'Test Compound',
          shortDescription: 'E2E Test Item 2 - 55 gallon drums',
        },
      ],
    },
  },
};

export const DEFAULT_TEST_COMPANY: TestCompanyProfile = {
  companyName: 'E2E Test Company',
  cageCode: 'E2E01',
  samUei: 'E2ETEST123456',
  naicsCode: '424690',
  contactPerson: 'E2E Test User',
  contactEmail: 'e2e-test@testcompany.com',
  contactPhone: '555-E2E-0000',
  defaultPaymentTerms: 'Net 30',
  defaultFob: 'origin',
  businessType: 'small',
  smallDisadvantaged: true,
  womanOwned: false,
  veteranOwned: false,
  serviceDisabledVetOwned: false,
  hubZone: false,
};

export class DbSeeder {
  private apiContext: Awaited<ReturnType<typeof request.newContext>> | null = null;
  private createdRfqIds: number[] = [];

  async init() {
    this.apiContext = await request.newContext({
      baseURL: BASE_URL,
    });
  }

  async cleanup() {
    // Clean up created RFQs via API
    if (this.apiContext) {
      for (const id of this.createdRfqIds) {
        try {
          await this.apiContext.delete(`/api/rfq/${id}`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      await this.apiContext.dispose();
    }
    this.createdRfqIds = [];
  }

  /**
   * Create an RFQ in the database via the API
   */
  async createTestRfq(data: Partial<TestRfqData> = {}): Promise<TestRfqData & { id: number }> {
    if (!this.apiContext) {
      throw new Error('DbSeeder not initialized. Call init() first.');
    }

    const rfqData = { ...DEFAULT_TEST_RFQ, ...data };

    // Use the internal seed endpoint (we'll create this)
    const response = await this.apiContext.post('/api/e2e/seed-rfq', {
      data: rfqData,
    });

    if (!response.ok()) {
      const text = await response.text();
      throw new Error(`Failed to create test RFQ: ${response.status()} - ${text}`);
    }

    const result = await response.json();
    this.createdRfqIds.push(result.id);

    return { ...rfqData, id: result.id };
  }

  /**
   * Update company profile via API
   * Handles both create (POST) and update (PUT) cases
   */
  async updateCompanyProfile(data: Partial<TestCompanyProfile> = {}): Promise<void> {
    if (!this.apiContext) {
      throw new Error('DbSeeder not initialized. Call init() first.');
    }

    const profileData = { ...DEFAULT_TEST_COMPANY, ...data };

    // First try to get existing profile
    const getResponse = await this.apiContext.get('/api/company-profile');

    if (getResponse.ok()) {
      // Profile exists, use PUT
      const existing = await getResponse.json();
      const response = await this.apiContext.put('/api/company-profile', {
        data: { ...profileData, id: existing.id },
      });
      if (!response.ok()) {
        const text = await response.text();
        console.warn(`Failed to update company profile: ${response.status()} - ${text}`);
      }
    } else {
      // No profile, use POST
      const response = await this.apiContext.post('/api/company-profile', {
        data: profileData,
      });
      if (!response.ok()) {
        const text = await response.text();
        console.warn(`Failed to create company profile: ${response.status()} - ${text}`);
      }
    }
  }

  /**
   * Get RFQ data via API
   */
  async getRfq(id: number): Promise<TestRfqData & { id: number }> {
    if (!this.apiContext) {
      throw new Error('DbSeeder not initialized. Call init() first.');
    }

    const response = await this.apiContext.get(`/api/rfq/${id}`);

    if (!response.ok()) {
      throw new Error(`Failed to get RFQ: ${response.status()}`);
    }

    return await response.json();
  }

  /**
   * Get saved response for an RFQ
   */
  async getRfqResponse(rfqId: number): Promise<{ response: unknown } | null> {
    if (!this.apiContext) {
      throw new Error('DbSeeder not initialized. Call init() first.');
    }

    const response = await this.apiContext.get(`/api/rfq/${rfqId}/response`);

    if (!response.ok()) {
      return null;
    }

    return await response.json();
  }

  /**
   * Delete an RFQ
   */
  async deleteRfq(id: number): Promise<void> {
    if (!this.apiContext) {
      throw new Error('DbSeeder not initialized. Call init() first.');
    }

    await this.apiContext.delete(`/api/rfq/${id}`);
    this.createdRfqIds = this.createdRfqIds.filter((rfqId) => rfqId !== id);
  }
}

// Singleton instance for tests
export const dbSeeder = new DbSeeder();
