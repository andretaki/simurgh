/**
 * Unit tests for the Vendor Quote PDF Generator
 *
 * Tests cover:
 * - PDF generation with valid data
 * - Vendor quote ref generation
 * - Price formatting
 */

import { generateVendorQuotePDF, generateVendorQuoteRef, VendorQuoteData } from '../vendor-quote-generator';

describe('Vendor Quote Generator', () => {
  describe('generateVendorQuoteRef', () => {
    it('should generate quote ref with correct format', () => {
      const ref = generateVendorQuoteRef('FA8501-24-Q-0001', 0);
      expect(ref).toBe('ACQ-RFQ-FA8501-24-Q-0001-1');
    });

    it('should increment sequence number', () => {
      const ref1 = generateVendorQuoteRef('FA8501-24-Q-0001', 0);
      const ref2 = generateVendorQuoteRef('FA8501-24-Q-0001', 1);
      const ref3 = generateVendorQuoteRef('FA8501-24-Q-0001', 2);

      expect(ref1).toBe('ACQ-RFQ-FA8501-24-Q-0001-1');
      expect(ref2).toBe('ACQ-RFQ-FA8501-24-Q-0001-2');
      expect(ref3).toBe('ACQ-RFQ-FA8501-24-Q-0001-3');
    });

    it('should clean special characters from RFQ number', () => {
      const ref = generateVendorQuoteRef('RFQ #123/456', 0);
      expect(ref).toBe('ACQ-RFQ-RFQ123456-1');
    });

    it('should handle empty RFQ number', () => {
      const ref = generateVendorQuoteRef('', 0);
      expect(ref).toBe('ACQ-RFQ--1');
    });
  });

  describe('generateVendorQuotePDF', () => {
    const sampleQuoteData: VendorQuoteData = {
      vendorQuoteRef: 'ACQ-RFQ-FA8501-24-Q-0001-1',
      quoteDate: '2024-12-15',
      quoteValidUntil: '2025-01-15',
      rfqNumber: 'FA8501-24-Q-0001',
      buyerName: 'John Doe',
      buyerEmail: 'john.doe@example.com',
      contractingOffice: 'AFLCMC/HIB',
      fob: 'Origin',
      paymentTerms: 'Net 30',
      deliveryDays: '30',
      companyName: 'Alliance Chemical',
      companyAddress: '204 S. Edmond St., Taylor, TX 76574',
      companyPhone: '512-365-6838',
      companyWebsite: 'www.alliancechemical.com',
      cageCode: '12345',
      samUei: 'ABC123DEF456',
      naicsCode: '325199',
      certifications: ['SAM Registered', 'SDB'],
      countryOfOrigin: 'USA',
      lineItems: [
        {
          lineNumber: '0001',
          nsn: '6810-01-234-5678',
          description: 'Acetone, Technical Grade',
          unitOfMeasure: 'GL',
          quantity: 100,
          unitPrice: 25.50,
          deliveryDays: '30',
          countryOfOrigin: 'USA',
          isIawNsn: true,
        },
        {
          lineNumber: '0002',
          nsn: '6810-01-234-5679',
          description: 'Isopropyl Alcohol, 99%',
          unitOfMeasure: 'GL',
          quantity: 50,
          unitPrice: 35.75,
          deliveryDays: '45',
          countryOfOrigin: 'USA',
          isIawNsn: true,
          priceBreaks: [
            { fromQty: 100, toQty: 199, unitPrice: 32.50, deliveryDays: '45' },
            { fromQty: 200, toQty: 500, unitPrice: 29.99, deliveryDays: '60' },
          ],
        },
      ],
      notes: 'All prices are FOB Origin. Lead times are estimates.',
    };

    it('should generate a non-empty PDF buffer', () => {
      const pdfBuffer = generateVendorQuotePDF(sampleQuoteData);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should generate a valid PDF (starts with %PDF)', () => {
      const pdfBuffer = generateVendorQuotePDF(sampleQuoteData);
      const pdfStart = pdfBuffer.slice(0, 4).toString();

      expect(pdfStart).toBe('%PDF');
    });

    it('should handle minimal data', () => {
      const minimalData: VendorQuoteData = {
        vendorQuoteRef: 'ACQ-RFQ-TEST-1',
        quoteDate: '2024-12-15',
        quoteValidUntil: '2025-01-15',
        rfqNumber: 'TEST-001',
        companyName: 'Test Company',
        companyAddress: '123 Test St',
        companyPhone: '555-1234',
        lineItems: [
          {
            lineNumber: '1',
            description: 'Test Item',
            unitOfMeasure: 'EA',
            quantity: 10,
            unitPrice: 99.99,
          },
        ],
      };

      const pdfBuffer = generateVendorQuotePDF(minimalData);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle line items with price breaks', () => {
      const dataWithBreaks: VendorQuoteData = {
        vendorQuoteRef: 'ACQ-RFQ-BREAKS-1',
        quoteDate: '2024-12-15',
        quoteValidUntil: '2025-01-15',
        rfqNumber: 'BREAKS-001',
        companyName: 'Test Company',
        companyAddress: '123 Test St',
        companyPhone: '555-1234',
        lineItems: [
          {
            lineNumber: '1',
            description: 'Item with breaks',
            unitOfMeasure: 'EA',
            quantity: 50,
            unitPrice: 100.00,
            priceBreaks: [
              { fromQty: 100, toQty: 199, unitPrice: 90.00 },
              { fromQty: 200, toQty: 499, unitPrice: 80.00 },
              { fromQty: 500, toQty: 999, unitPrice: 70.00 },
              { fromQty: 1000, toQty: 9999, unitPrice: 60.00 },
            ],
          },
        ],
      };

      const pdfBuffer = generateVendorQuotePDF(dataWithBreaks);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle many line items', () => {
      const manyItems: VendorQuoteData = {
        vendorQuoteRef: 'ACQ-RFQ-MANY-1',
        quoteDate: '2024-12-15',
        quoteValidUntil: '2025-01-15',
        rfqNumber: 'MANY-001',
        companyName: 'Test Company',
        companyAddress: '123 Test St',
        companyPhone: '555-1234',
        lineItems: Array.from({ length: 20 }, (_, i) => ({
          lineNumber: String(i + 1).padStart(4, '0'),
          nsn: `6810-01-234-${String(5678 + i).padStart(4, '0')}`,
          description: `Test Chemical Product ${i + 1}`,
          unitOfMeasure: 'GL',
          quantity: 100 + i * 10,
          unitPrice: 25.00 + i * 5,
          deliveryDays: '30',
          countryOfOrigin: 'USA',
          isIawNsn: true,
        })),
      };

      const pdfBuffer = generateVendorQuotePDF(manyItems);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      // PDF with many items should be larger
      expect(pdfBuffer.length).toBeGreaterThan(5000);
    });

    it('should include vendorQuoteRef in PDF content', () => {
      const pdfBuffer = generateVendorQuotePDF(sampleQuoteData);
      const pdfContent = pdfBuffer.toString('latin1');

      // The vendor quote ref should appear in the PDF
      expect(pdfContent).toContain('ACQ-RFQ-FA8501-24-Q-0001-1');
    });
  });
});
