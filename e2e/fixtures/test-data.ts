export const testData = {
  companyProfile: {
    companyName: 'Test Company Inc.',
    cageCode: '12345',
    samUei: 'TEST123456789',
    contactPerson: 'John Doe',
    contactEmail: 'john@testcompany.com',
    contactPhone: '555-123-4567',
    address: '123 Test St, Test City, TC 12345'
  },

  urls: {
    home: '/',
    projects: '/projects',
    settings: '/settings',
    history: '/history',
    workflow: '/workflow',
    orders: '/orders'
  },

  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000
  },

  errorMessages: {
    required: 'This field is required',
    invalid: 'Invalid input',
    network: 'Network error occurred'
  },

  successMessages: {
    saved: 'Successfully saved',
    deleted: 'Successfully deleted'
  }
};

export const mockProjectsData = {
  projects: [
    {
      id: 1,
      name: 'Project Alpha',
      status: 'rfq_received',
      customerName: 'AFLCMC',
      rfqNumber: 'FA8501-24-Q-0001',
      poNumber: null,
      productName: 'Chemical Compound',
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Project Beta',
      status: 'quoted',
      customerName: 'DLA',
      rfqNumber: 'SPE4A6-24-Q-0002',
      poNumber: null,
      productName: 'Lab Equipment',
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Project Gamma',
      status: 'verified',
      customerName: 'Navy',
      rfqNumber: 'N00024-24-Q-0003',
      poNumber: 'N00024-24-P-0003',
      productName: 'Safety Gear',
      createdAt: new Date().toISOString()
    }
  ]
};

export const mockHistoryData = {
  rfqs: [
    {
      id: 1,
      fileName: 'rfq-document-001.pdf',
      rfqNumber: 'FA8501-24-Q-0001',
      status: 'processed',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      contractingOffice: 'AFLCMC/HIB',
      s3Url: 'https://example.com/rfq-001.pdf',
      extractedFields: {
        pocName: 'Jane Smith',
        deliveryLocation: 'Wright-Patterson AFB',
        items: [{ description: 'Test Item', quantity: 100 }]
      }
    },
    {
      id: 2,
      fileName: 'rfq-document-002.pdf',
      rfqNumber: 'SPE4A6-24-Q-0002',
      status: 'processed',
      createdAt: new Date().toISOString(),
      dueDate: null,
      contractingOffice: 'DLA',
      s3Url: null,
      extractedFields: null
    }
  ],
  responses: []
};

export const mockWorkflowData = {
  workflows: [
    {
      rfqNumber: 'FA8501-24-Q-0001',
      poNumber: null,
      status: 'rfq_received',
      statusLabel: 'RFQ Received',
      rfq: {
        id: 1,
        fileName: 'rfq-001.pdf',
        rfqNumber: 'FA8501-24-Q-0001',
        contractingOffice: 'AFLCMC',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      },
      response: null,
      po: null,
      qualitySheet: null,
      labels: [],
      rfqReceivedAt: new Date().toISOString(),
      responseSubmittedAt: null,
      poReceivedAt: null,
      verifiedAt: null
    }
  ],
  stats: {
    total: 1,
    byStatus: { rfq_received: 1 }
  }
};

export const mockStatsData = {
  totalOpen: 5,
  dueToday: 1,
  dueSoon: 3,
  recentWins: 2
};
