export const testData = {
  companyProfile: {
    name: 'Test Company Inc.',
    industry: 'Technology',
    size: 'Medium',
    location: 'San Francisco, CA',
    description: 'A test company for E2E testing purposes'
  },

  rfqData: {
    title: 'Test RFQ Request',
    description: 'This is a test RFQ for E2E testing',
    budget: '50000',
    deadline: '2025-12-31',
    requirements: 'Test requirements for the RFQ',
    attachments: []
  },

  searchQueries: {
    valid: 'test query',
    empty: '',
    special: 'test@#$%^&*()',
    long: 'a'.repeat(500)
  },

  apiResponses: {
    success: {
      status: 'success',
      data: { message: 'Operation completed successfully' }
    },
    error: {
      status: 'error',
      message: 'An error occurred'
    }
  },

  userSettings: {
    apiKey: 'test-api-key-12345',
    model: 'gpt-4',
    temperature: '0.7',
    maxTokens: '2000'
  },

  testFiles: {
    pdf: 'e2e/fixtures/sample.pdf',
    image: 'e2e/fixtures/sample.png',
    document: 'e2e/fixtures/sample.docx'
  },

  urls: {
    home: '/',
    rfq: '/rfq',
    rfqUpload: '/rfq/upload',
    settings: '/settings',
    history: '/history',
    analytics: '/analytics',
    rfqPro: '/rfq-pro'
  },

  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000
  },

  errorMessages: {
    required: 'This field is required',
    invalid: 'Invalid input',
    network: 'Network error occurred',
    authentication: 'Authentication failed'
  },

  successMessages: {
    saved: 'Successfully saved',
    uploaded: 'File uploaded successfully',
    processed: 'RFQ processed successfully',
    deleted: 'Successfully deleted'
  }
};

export const mockRfqList = [
  {
    id: '1',
    title: 'Software Development RFQ',
    status: 'pending',
    createdAt: new Date().toISOString(),
    budget: 100000
  },
  {
    id: '2',
    title: 'Cloud Infrastructure Setup',
    status: 'completed',
    createdAt: new Date().toISOString(),
    budget: 75000
  },
  {
    id: '3',
    title: 'Mobile App Development',
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    budget: 50000
  }
];

export const mockHistoryData = [
  {
    id: '1',
    action: 'RFQ Created',
    timestamp: new Date().toISOString(),
    details: 'Created new RFQ for software development'
  },
  {
    id: '2',
    action: 'File Uploaded',
    timestamp: new Date().toISOString(),
    details: 'Uploaded requirements document'
  },
  {
    id: '3',
    action: 'RFQ Processed',
    timestamp: new Date().toISOString(),
    details: 'AI processing completed'
  }
];

export const mockAnalyticsData = {
  totalRfqs: 150,
  completedRfqs: 120,
  pendingRfqs: 20,
  inProgressRfqs: 10,
  averageProcessingTime: '2.5 hours',
  successRate: '95%',
  monthlyData: [
    { month: 'Jan', count: 12 },
    { month: 'Feb', count: 15 },
    { month: 'Mar', count: 18 },
    { month: 'Apr', count: 22 },
    { month: 'May', count: 28 },
    { month: 'Jun', count: 25 }
  ]
};